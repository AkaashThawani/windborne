// Import getPressureLevel from trajectoryEngine
import { getPressureLevel } from '../utils/trajectoryEngine';

// Global weather cache - shared across all components
const weatherCache = new Map();
let lastApiCall = 0;
const API_RATE_LIMIT = 1000; // 1 call per second max

// Validate coordinates for weather API
function isValidWeatherLocation(lat, lon) {
  // Open-Meteo has limited coverage in extreme latitudes
  // Avoid Arctic/Antarctic regions that may not have data
  return lat >= -60 && lat <= 75 && lon >= -180 && lon <= 180;
}

// Consolidated weather data fetcher (legacy - kept for compatibility)
export async function getWeatherData(lat, lon, alt, force = false) {
  const cacheKey = `${lat.toFixed(2)}-${lon.toFixed(2)}-${getPressureLevel(alt)}`;

  // Check cache first
  if (!force && weatherCache.has(cacheKey)) {
    const cached = weatherCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      return cached.data;
    }
  }

  // Validate coordinates
  if (!isValidWeatherLocation(lat, lon)) {
    console.warn(`Skipping weather API for invalid location: ${lat}, ${lon}`);
    return null;
  }

  // Rate limiting
  const now = Date.now();
  if (now - lastApiCall < API_RATE_LIMIT) {
    // Return cached data if available, otherwise null
    return weatherCache.get(cacheKey)?.data || null;
  }
  lastApiCall = now;

  try {
    const pressureLevel = getPressureLevel(alt);
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=windspeed_${pressureLevel},winddirection_${pressureLevel}&forecast_hours=1`
    );

    if (!response.ok) {
      console.warn(`Weather API error: ${response.status} for ${lat}, ${lon}`);
      return null;
    }

    const data = await response.json();

    if (!data.hourly) {
      console.warn(`No weather data available for ${lat}, ${lon}`);
      return null;
    }

    const result = {
      speed: data.hourly[`windspeed_${pressureLevel}`]?.[0] || 0,
      direction: data.hourly[`winddirection_${pressureLevel}`]?.[0] || 0,
      pressureLevel: pressureLevel,
      timestamp: now
    };

    // Cache the result
    weatherCache.set(cacheKey, { data: result, timestamp: now });

    return result;
  } catch (error) {
    console.warn(`Weather API fetch failed for ${lat}, ${lon}:`, error);
    return null;
  }
}

// Get cached data without API call (legacy)
export function getCachedWeatherData(lat, lon, alt) {
  const cacheKey = `${lat.toFixed(2)}-${lon.toFixed(2)}-${getPressureLevel(alt)}`;
  const cached = weatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.data;
  }

  return null;
}

// NEW: Time-aware weather data fetcher for balloon tracks
export async function getWeatherDataForTrack(track, balloonId) {
  if (!track || track.length === 0) return [];

  const results = new Array(track.length);
  const missingHours = [];

  // Step 1: Check cache for each hour (balloon-specific)
  track.forEach((point, index) => {
    const cacheKey = `${balloonId}-${point.hourIndex}-${point.lat.toFixed(2)}-${point.lon.toFixed(2)}-${getPressureLevel(point.alt)}`;
    const cached = weatherCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      results[index] = cached.data;
    } else {
      missingHours.push({ point, index });
    }
  });

  // Step 2: Group missing hours by location to minimize API calls
  const locationGroups = {};
  missingHours.forEach(({ point, index }) => {
    const locationKey = `${point.lat.toFixed(2)}-${point.lon.toFixed(2)}-${getPressureLevel(point.alt)}`;
    if (!locationGroups[locationKey]) {
      locationGroups[locationKey] = { lat: point.lat, lon: point.lon, alt: point.alt, hours: [] };
    }
    locationGroups[locationKey].hours.push({ point, index });
  });

  // Step 3: Fetch weather data for missing locations
  const fetchPromises = Object.values(locationGroups).map(async (group) => {
    const { lat, lon, alt, hours } = group;

    // Validate coordinates
    if (!isValidWeatherLocation(lat, lon)) {
      console.warn(`Skipping weather API for invalid location: ${lat}, ${lon}`);
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastApiCall < API_RATE_LIMIT) {
      await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT - (now - lastApiCall)));
    }
    lastApiCall = now;

    try {
      const pressureLevel = getPressureLevel(alt);
      // Get 24 hours of forecast data
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=windspeed_${pressureLevel},winddirection_${pressureLevel}&forecast_hours=24`
      );

      if (!response.ok) {
        console.warn(`Weather API error: ${response.status} for ${lat}, ${lon}`);
        return;
      }

      const data = await response.json();

      if (!data.hourly) {
        console.warn(`No weather data available for ${lat}, ${lon}`);
        return;
      }

      // Store each hour in cache and results
      hours.forEach(({ point, index }) => {
        const hourIndex = point.hourIndex;
        const result = {
          speed: data.hourly[`windspeed_${pressureLevel}`]?.[hourIndex] || 0,
          direction: data.hourly[`winddirection_${pressureLevel}`]?.[hourIndex] || 0,
          pressureLevel: pressureLevel,
          timestamp: now
        };

        // Cache with balloon-specific time-aware key
        const cacheKey = `${balloonId}-${point.hourIndex}-${point.lat.toFixed(2)}-${point.lon.toFixed(2)}-${getPressureLevel(point.alt)}`;
        weatherCache.set(cacheKey, { data: result, timestamp: now });

        results[index] = result;
      });

    } catch (error) {
      console.warn(`Weather API fetch failed for ${lat}, ${lon}:`, error);
    }
  });

  // Wait for all API calls to complete
  await Promise.all(fetchPromises);

  return results;
}

// Get cached weather data with time awareness
export function getCachedWeatherDataWithTime(lat, lon, alt, hourIndex, balloonId) {
  // Try balloon-specific cache key first
  const balloonCacheKey = `${balloonId}-${hourIndex}-${lat.toFixed(2)}-${lon.toFixed(2)}-${getPressureLevel(alt)}`;
  const balloonCached = weatherCache.get(balloonCacheKey);

  if (balloonCached && Date.now() - balloonCached.timestamp < 3600000) {
    return balloonCached.data;
  }

  // Fallback to location-only cache key for backward compatibility
  const locationCacheKey = `${lat.toFixed(2)}-${lon.toFixed(2)}-${getPressureLevel(alt)}-${hourIndex}`;
  const locationCached = weatherCache.get(locationCacheKey);

  if (locationCached && Date.now() - locationCached.timestamp < 3600000) {
    return locationCached.data;
  }

  return null;
}

// Clear cache (for debugging)
export function clearWeatherCache() {
  weatherCache.clear();
}
