// Haversine formula to calculate distance between two lat/lon points
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in KM
};

/**
 * Process 25 hours of balloon data into continuous trajectory tracks (25h ago to NOW)
 * @param {Array} all24HoursData - Array of 25 hourly data objects (hours 24-0)
 * @returns {Object} Map of balloon IDs to their 26-hour position history (with hour 25 = duplicate of hour 0)
 */
export const processConstellationHistory = (all24HoursData) => {
  // Map to store full history for every balloon ID
  // Structure: { "balloon-123": [ { lat, lon, alt, time: 0 }, { lat, lon, alt, time: 1 } ... ] }
  const tracks = {};

  // Process from oldest (24h ago) to newest (current) to build chronological tracks
  // Data comes as hours 24-0, where hour 24 = 24h ago, hour 0 = NOW
  // We want hourIndex to represent hours ago: 25 = 25h ago (future), 24 = 24h ago, 0 = NOW
  for (let hour = 24; hour >= 0; hour--) {
    const hourData = all24HoursData.find(data => data?.hour === hour);
    if (!hourData?.balloons) continue;

    hourData.balloons.forEach(balloon => {
      // Use existing ID or create one based on index
      const balloonId = balloon.id || `balloon-${balloon.index}`;

      if (!tracks[balloonId]) {
        tracks[balloonId] = [];
      }

      // Add position data with hour index for time tracking
      tracks[balloonId].push({
        id: balloonId, // Include the balloon ID
        ...balloon,
        hourIndex: hour, // 24 = 24h ago, 0 = now
        timestamp: new Date(Date.now() - (hour * 3600000)).toISOString()
      });
    });
  }

  // Add hour 25 (duplicate of hour 0 for smooth animation start)
  const hour0Data = all24HoursData.find(data => data?.hour === 0);
  if (hour0Data?.balloons) {
    hour0Data.balloons.forEach(balloon => {
      const balloonId = balloon.id || `balloon-${balloon.index}`;
      if (tracks[balloonId]) {
        // Add current position (hour 0) as "hour 25" (future position)
        tracks[balloonId].push({
          id: balloonId,
          ...balloon,
          hourIndex: 25, // Future position (1 hour ahead)
          timestamp: new Date(Date.now() + 3600000).toISOString()
        });
      }
    });
  }

  // Sort each track by time (oldest first for proper trajectory flow)
  Object.values(tracks).forEach(track => {
    track.sort((a, b) => a.hourIndex - b.hourIndex);
  });

  return tracks;
};

/**
 * Calculate speed between two consecutive positions
 * @param {Object} pos1 - First position {lat, lon, hourIndex}
 * @param {Object} pos2 - Second position {lat, lon, hourIndex}
 * @returns {number} Speed in km/h
 */
export const calculateSegmentSpeed = (pos1, pos2) => {
  if (!pos1 || !pos2 || !pos1.lat || !pos2.lat) return 0;
  const distance = getDistance(pos1.lat, pos1.lon, pos2.lat, pos2.lon);
  const timeHours = Math.abs(pos2.hourIndex - pos1.hourIndex) || 1;
  return distance / timeHours; // km/h
};

/**
 * Calculate bearing/direction between two points
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} Bearing in degrees (0-360°)
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360; // Normalize to 0-360°
};

/**
 * Calculate vector drift between two positions
 * @param {Object} pos1 - First position
 * @param {Object} pos2 - Second position
 * @returns {Object} Drift vector {speed: km/h, direction: degrees}
 */
export const calculateDriftVector = (pos1, pos2) => {
  if (!pos1 || !pos2) return { speed: 0, direction: 0 };

  const speed = calculateSegmentSpeed(pos1, pos2);
  const direction = calculateBearing(pos1.lat, pos1.lon, pos2.lat, pos2.lon);

  return { speed, direction };
};

/**
 * Calculate drift error between actual and model predictions
 * @param {Object} actualDrift - Actual drift {speed, direction}
 * @param {Object} modelDrift - Model prediction {speed, direction}
 * @returns {Object} Error metrics {speedError, directionError, magnitude}
 */
export const calculateDriftError = (actualDrift, modelDrift) => {
  const speedError = actualDrift.speed - (modelDrift?.speed || 0);
  const directionError = Math.abs(actualDrift.direction - (modelDrift?.direction || 0));

  return {
    speedError,      // km/h difference
    directionError,  // degrees difference
    magnitude: Math.sqrt(speedError ** 2 + directionError ** 2) // Combined error
  };
};

/**
 * Calculate speeds for entire track
 * @param {Array} track - Array of position objects
 * @returns {Array} Array of speed data points
 */
export const calculateTrackSpeeds = (track) => {
  const speeds = [];
  for (let i = 1; i < track.length; i++) {
    const speed = calculateSegmentSpeed(track[i-1], track[i]);
    speeds.push({
      hourIndex: track[i].hourIndex,
      speed: speed,
      position: track[i]
    });
  }
  return speeds;
};

/**
 * Calculate total distance traveled along a track
 * @param {Array} track - Array of position objects
 * @returns {number} Total distance in km
 */
export const calculateTotalDistance = (track) => {
  let totalDistance = 0;
  for (let i = 1; i < track.length; i++) {
    totalDistance += getDistance(
      track[i-1].lat, track[i-1].lon,
      track[i].lat, track[i].lon
    );
  }
  return totalDistance;
};

/**
 * Calculate comprehensive track statistics
 * @param {Array} track - Array of position objects
 * @returns {Object} Track statistics
 */
export const calculateTrackStats = (track) => {
  if (!track || track.length === 0) {
    return {
      totalDistance: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      minSpeed: 0,
      altitudeRange: { min: 0, max: 0 },
      duration: 0
    };
  }

  const speeds = calculateTrackSpeeds(track);
  const speedValues = speeds.map(s => s.speed);

  return {
    totalDistance: calculateTotalDistance(track),
    averageSpeed: speedValues.length > 0 ? speedValues.reduce((sum, s) => sum + s, 0) / speedValues.length : 0,
    maxSpeed: speedValues.length > 0 ? Math.max(...speedValues) : 0,
    minSpeed: speedValues.length > 0 ? Math.min(...speedValues) : 0,
    altitudeRange: {
      min: Math.min(...track.map(p => p.alt)),
      max: Math.max(...track.map(p => p.alt))
    },
    duration: track.length // hours tracked
  };
};

/**
 * Filter tracks by time window
 * @param {Object} tracks - Map of balloon tracks
 * @param {number} startHour - Start hour index (0 = now)
 * @param {number} endHour - End hour index (23 = 23h ago)
 * @returns {Object} Filtered tracks
 */
export const filterTracksByTime = (tracks, startHour = 0, endHour = 23) => {
  const filteredTracks = {};

  Object.entries(tracks).forEach(([balloonId, track]) => {
    const filteredTrack = track.filter(pos =>
      pos.hourIndex >= startHour && pos.hourIndex <= endHour
    );

    if (filteredTrack.length > 0) {
      filteredTracks[balloonId] = filteredTrack;
    }
  });

  return filteredTracks;
};

/**
 * Get speed color for visualization
 * @param {number} speed - Speed in km/h
 * @returns {string} Hex color code
 */
export const getSpeedColor = (speed) => {
  if (speed < 30) return '#3b82f6';     // Blue (Very Slow < 30 km/h)
  if (speed < 60) return '#8b5cf6';     // Purple (Slow 30-60 km/h)
  if (speed < 90) return '#ec4899';     // Pink (Medium 60-90 km/h)
  if (speed < 120) return '#eab308';    // Yellow/Gold (Fast 90-120 km/h)
  return '#dc2626';                     // Red (Jet Stream > 120 km/h)
};

/**
 * Get glow class for speed-based effects
 * @param {number} speed - Speed in km/h
 * @returns {string} CSS class name
 */
export const getGlowClass = (speed) => {
  if (speed > 100) return 'glow-fast';
  if (speed > 50) return 'glow-medium';
  return 'glow-none';
};

/**
 * Get appropriate pressure level for weather API based on altitude
 * @param {number} altitude - Altitude in meters
 * @returns {string} Pressure level string for Open-Meteo API
 */
export const getPressureLevel = (altitude) => {
  // Convert meters to approximate pressure levels
  // 100hPa ≈ 16,000m (tropopause)
  // 200hPa ≈ 11,800m
  // 300hPa ≈ 9,200m
  // 500hPa ≈ 5,500m
  // 700hPa ≈ 3,000m
  // 850hPa ≈ 1,500m

  if (altitude >= 14000) return '100hPa';  // Upper stratosphere
  if (altitude >= 10000) return '200hPa';  // Lower stratosphere
  if (altitude >= 8000) return '300hPa';   // Upper troposphere
  if (altitude >= 4000) return '500hPa';   // Mid troposphere
  if (altitude >= 2000) return '700hPa';   // Lower troposphere
  return '850hPa';                         // Near surface
};
