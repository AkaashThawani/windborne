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
 * Process 24 hours of balloon data into continuous trajectory tracks
 * @param {Array} all24HoursData - Array of 24 hourly data objects
 * @returns {Object} Map of balloon IDs to their 24-hour position history
 */
export const processConstellationHistory = (all24HoursData) => {
  // Map to store full history for every balloon ID
  // Structure: { "balloon-123": [ { lat, lon, alt, time: 0 }, { lat, lon, alt, time: 1 } ... ] }
  const tracks = {};

  // Process from oldest (23h ago) to newest (current) to build chronological tracks
  // Index 0 = current (0h ago), Index 23 = 23h ago
  for (let hour = 23; hour >= 0; hour--) {
    const hourData = all24HoursData[hour];
    if (!hourData?.balloons) continue;

    hourData.balloons.forEach(balloon => {
      // Use existing ID or create one based on index
      const balloonId = balloon.id || `balloon-${balloon.index}`;

      if (!tracks[balloonId]) {
        tracks[balloonId] = [];
      }

      // Add position data with hour index for time tracking
      tracks[balloonId].push({
        ...balloon,
        hourIndex: hour, // 0 = now, 23 = 23h ago
        timestamp: new Date(Date.now() - (hour * 3600000)).toISOString()
      });
    });
  }

  // Sort each track by time (oldest first for proper trajectory flow)
  Object.values(tracks).forEach(track => {
    track.sort((a, b) => a.hourIndex - b.hourIndex);
  });

  console.log(`🛤️ Processed ${Object.keys(tracks).length} balloon trajectories`);
  console.log(`📊 Sample track:`, Object.values(tracks)[0]);

  return tracks;
};

/**
 * Calculate speed between two consecutive positions
 * @param {Object} pos1 - First position {lat, lon, hourIndex}
 * @param {Object} pos2 - Second position {lat, lon, hourIndex}
 * @returns {number} Speed in km/h
 */
export const calculateSegmentSpeed = (pos1, pos2) => {
  const distance = getDistance(pos1.lat, pos1.lon, pos2.lat, pos2.lon);
  const timeHours = Math.abs(pos2.hourIndex - pos1.hourIndex) || 1;
  return distance / timeHours; // km/h
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
  if (speed < 30) return '#3b82f6'; // Blue (Slow)
  if (speed < 60) return '#8b5cf6'; // Purple
  if (speed < 90) return '#ec4899'; // Pink
  return '#eab308';                 // Yellow/Gold (Fast - Jet Stream)
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
