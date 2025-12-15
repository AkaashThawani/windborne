import { CONFIG } from '../config';
import { getPressureLevel } from './analytics';

/**
 * Fetch balloon data from WindBorne API for a specific hour
 * @param {number} hour - Hour offset (0 = current, 23 = 23 hours ago)
 * @returns {Promise<object|null>} Balloon data or null if failed
 */
async function fetchBalloonDataForHour(hour) {
  try {
    const hourStr = hour.toString().padStart(2, '0');
    const url = `${CONFIG.WINDBORNE_API_BASE}/${hourStr}.json`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    return validateBalloonData(data, hour);
  } catch {
    return null;
  }
}

/**
 * Validate and sanitize balloon data
 * @param {object} data - Raw balloon data
 * @param {number} hour - Hour offset
 * @returns {object|null} Validated data or null
 */
function validateBalloonData(data, hour) {
  if (!data || !Array.isArray(data)) {
    return null;
  }
  
  // Data is an array of [lat, lon, altitude] arrays
  const validBalloons = data
    .map((entry, index) => {
      // Each entry is [latitude, longitude, altitude_km]
      if (!Array.isArray(entry) || entry.length < 3) {
        return null;
      }
      
      const [lat, lon, altKm] = entry;
      
      // Validate coordinates
      if (typeof lat !== 'number' || typeof lon !== 'number' || typeof altKm !== 'number') {
        return null;
      }
      
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return null;
      }
      
      return {
        index, // Store the original index for tracking across hours
        lat,
        lon,
        alt: altKm * 1000, // Convert km to meters for consistency
        hour,
        timestamp: Date.now() - (hour * 3600000) // Approximate timestamp
      };
    })
    .filter(Boolean); // Remove null entries
  
  return {
    hour,
    balloons: validBalloons,
    fetchedAt: Date.now()
  };
}

/**
 * Fetch all 24 hours of balloon data starting from 24 hours ago
 * @returns {Promise<Array>} Array of balloon data for each hour
 */
export async function fetchAllBalloonData() {
  const promises = [];
  for (let hour = 24; hour >= 0; hour--) {
    promises.push(fetchBalloonDataForHour(hour));
  }

  const results = await Promise.all(promises);
  const validResults = results.filter(Boolean);

  return validResults;
}

/**
 * Fetch weather data for a specific location and altitude
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} altitude - Altitude in meters
 * @returns {Promise<object|null>} Weather data or null
 */
export async function fetchWeatherData(lat, lon, altitude = 16000) {
  try {
    // Get appropriate pressure level for the balloon's altitude
    const pressureLevel = getPressureLevel(altitude);

    // Use hourly data with pressure levels instead of surface current data
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      hourly: `temperature_${pressureLevel},windspeed_${pressureLevel},winddirection_${pressureLevel},relative_humidity_${pressureLevel},cloud_cover,weather_code`,
      wind_speed_unit: 'ms',
      timezone: 'auto',
      forecast_hours: 1  // Only need current hour
    });

    const url = `${CONFIG.WEATHER_API_BASE}?${params}`;

    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.hourly) {
      return null;
    }

    // Get the most recent hour (index 0)
    const tempKey = `temperature_${pressureLevel}`;
    const windSpeedKey = `windspeed_${pressureLevel}`;
    const windDirKey = `winddirection_${pressureLevel}`;
    const humidityKey = `relative_humidity_${pressureLevel}`;

    return {
      temperature: data.hourly[tempKey]?.[0],
      humidity: data.hourly[humidityKey]?.[0],
      windSpeed: data.hourly[windSpeedKey]?.[0],
      windDirection: data.hourly[windDirKey]?.[0],
      cloudCover: data.hourly.cloud_cover?.[0],
      weatherCode: data.hourly.weather_code?.[0],
      pressureLevel: pressureLevel,
      altitude: altitude
    };
  } catch {
    return null;
  }
}

/**
 * Process and combine balloon data with unique IDs across all hours
 * Each balloon at index i in all hours represents the SAME balloon at different times
 * @param {Array} allHoursData - Array of hourly balloon data
 * @returns {Array} Processed balloons with trajectories
 */
export function processBalloonData(allHoursData) {
  const balloonMap = new Map();
  
  // Group balloons by index (same balloon across different hours)
  allHoursData.forEach(hourData => {
    if (!hourData || !hourData.balloons) return;
    
    hourData.balloons.forEach(balloon => {
      const balloonId = `balloon-${balloon.index}`;
      
      if (!balloonMap.has(balloonId)) {
        balloonMap.set(balloonId, {
          id: balloonId,
          positions: {}, // Store as hour: {lat, lon, alt, hour} key-value pairs
          positionsArray: []
        });
      }
      
      // Store position for this hour
      const posData = {
        id: balloonId,
        lat: balloon.lat,
        lon: balloon.lon,
        alt: balloon.alt,
        hour: balloon.hour,
        timestamp: balloon.timestamp
      };
      
      balloonMap.get(balloonId).positions[balloon.hour] = posData;
      balloonMap.get(balloonId).positionsArray.push(posData);
    });
  });
  
  // Convert to array with proper structure
  const processedBalloons = Array.from(balloonMap.values()).map(balloon => {
    // Sort positions by hour (0 = most recent)
    const sortedPositions = balloon.positionsArray.sort((a, b) => a.hour - b.hour);
    
    return {
      id: balloon.id,
      positions: sortedPositions,
      positionsByHour: balloon.positions, // Keep key-value access
      currentPosition: balloon.positions[0] || sortedPositions[0], // Hour 0 is most recent
      trajectory: sortedPositions.map(p => [p.lat, p.lon])
    };
  });
  
  return processedBalloons;
}

/**
 * Get weather description from WMO weather code
 * @param {number} code - WMO weather code
 * @returns {string} Weather description
 */
export function getWeatherDescription(code) {
  const weatherCodes = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };
  
  return weatherCodes[code] || 'Unknown';
}
