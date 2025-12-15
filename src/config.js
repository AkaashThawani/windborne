// API Configuration
export const CONFIG = {
  // WindBorne API endpoints - use proxy in development
  WINDBORNE_API_BASE: '/api',

  // OpenMeteo API endpoint
  WEATHER_API_BASE: 'https://api.open-meteo.com/v1/forecast',

  // Data refresh interval (1 hour in milliseconds)
  REFRESH_INTERVAL: 60 * 60 * 1000,

  // Number of hours to fetch (24 hours ago to NOW)
  HOURS_TO_FETCH: 24,        // 24h ago to NOW (inclusive)
  START_HOUR: 23,            // Start from 24 hours ago
  END_HOUR: 0,               // End at current time (NOW)

  // Animation settings
  ANIMATION_SPEED: 1000,     // 1 second per hour
  LOOP_ANIMATION: true,      // Continuous loop animation

  // Map configuration
  MAP_CONFIG: {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 18
  },

  // Balloon colors by speed (km/h) - Vector Drift visualization
  BALLOON_SPEED_COLORS: {
    verySlow: '#3b82f6',     // Blue (< 30 km/h)
    slow: '#8b5cf6',         // Purple (30-60 km/h)
    medium: '#ec4899',       // Pink (60-90 km/h)
    fast: '#eab308',         // Yellow/Gold (90+ km/h - Jet Stream)
    jetStream: '#dc2626'     // Red (> 120 km/h - Extreme)
  },

  // Legacy age-based colors (still used in some places)
  BALLOON_COLORS: {
    current: '#e74c3c',      // Red for current
    recent: '#f39c12',       // Orange for 0-6 hours
    medium: '#3498db',       // Blue for 6-12 hours
    old: '#95a5a6'          // Gray for 12-24 hours
  }
};
