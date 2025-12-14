// API Configuration
export const CONFIG = {
  // WindBorne API endpoints - use proxy in development
  WINDBORNE_API_BASE: '/api',
  
  // OpenMeteo API endpoint
  WEATHER_API_BASE: 'https://api.open-meteo.com/v1/forecast',
  
  // Data refresh interval (1 hour in milliseconds)
  REFRESH_INTERVAL: 60 * 60 * 1000,
  
  // Number of hours to fetch (0-23)
  // For trajectory analysis: fetch hours 24, 23, 22 (oldest to newest)
  HOURS_TO_FETCH: 3,
  SPECIFIC_HOURS: [24, 23, 22], // Fetch these specific hours for trajectory analysis
  
  // Map configuration
  MAP_CONFIG: {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 18
  },
  
  // Balloon colors by age (hours ago)
  BALLOON_COLORS: {
    current: '#e74c3c',      // Red for current
    recent: '#f39c12',       // Orange for 0-6 hours
    medium: '#3498db',       // Blue for 6-12 hours
    old: '#95a5a6'          // Gray for 12-24 hours
  }
};
