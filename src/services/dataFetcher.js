import { CONFIG } from '../config';

/**
 * Fetch balloon data from WindBorne API for a specific hour
 * @param {number} hour - Hour offset (0 = current, 23 = 23 hours ago)
 * @returns {Promise<object|null>} Balloon data or null if failed
 */
async function fetchBalloonDataForHour(hour) {
  try {
    const hourStr = hour.toString().padStart(2, '0');
    const url = `${CONFIG.WINDBORNE_API_BASE}/${hourStr}.json`;
    
    console.log(`Fetching: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Failed to fetch hour ${hourStr}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`Raw data for hour ${hourStr}:`, data);
    console.log(`Data type:`, typeof data, `Is array:`, Array.isArray(data), `Length:`, data?.length);
    
    return validateBalloonData(data, hour);
  } catch (error) {
    console.warn(`Error fetching hour ${hour}:`, error.message);
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
 * Fetch all 24 hours of balloon data
 * @returns {Promise<Array>} Array of balloon data for each hour
 */
export async function fetchAllBalloonData() {
  console.log('🎈 Fetching balloon data for 24 hours...');
  console.log('📡 Making API calls to WindBorne for hours 00-23...');
  
  const promises = [];
  for (let hour = 0; hour < CONFIG.HOURS_TO_FETCH; hour++) {
    const hourStr = hour.toString().padStart(2, '0');
    console.log(`  → Calling API for hour ${hourStr}.json`);
    promises.push(fetchBalloonDataForHour(hour));
  }
  
  console.log(`⏳ Waiting for all ${CONFIG.HOURS_TO_FETCH} API calls to complete...`);
  const results = await Promise.all(promises);
  
  const validResults = results.filter(Boolean);
  
  console.log(`✅ Successfully fetched ${validResults.length}/${CONFIG.HOURS_TO_FETCH} hours of data`);
  console.log('📊 API Results Summary:');
  results.forEach((result, index) => {
    const hourStr = index.toString().padStart(2, '0');
    if (result) {
      console.log(`  ✓ Hour ${hourStr}: ${result.balloons.length} balloons found`);
    } else {
      console.log(`  ✗ Hour ${hourStr}: No data or error`);
    }
  });
  
  return validResults;
}

/**
 * Fetch weather data for a specific location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<object|null>} Weather data or null
 */
export async function fetchWeatherData(lat, lon) {
  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: 'temperature_2m,relative_humidity_2m,precipitation,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code',
      wind_speed_unit: 'ms',
      timezone: 'auto'
    });
    
    const url = `${CONFIG.WEATHER_API_BASE}?${params}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (!data.current) {
      return null;
    }
    
    return {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation,
      pressure: data.current.pressure_msl,
      windSpeed: data.current.wind_speed_10m,
      windDirection: data.current.wind_direction_10m,
      cloudCover: data.current.cloud_cover,
      weatherCode: data.current.weather_code
    };
  } catch (error) {
    console.warn(`Failed to fetch weather for ${lat},${lon}:`, error.message);
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
  
  console.log(`📊 Processed ${processedBalloons.length} unique balloons`);
  console.log(`📍 Sample balloon tracking:`, processedBalloons[0]);
  
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
