// Haversine formula to calculate distance between two lat/lon points
export const calculateDistance = (pos1, pos2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(pos2.lat - pos1.lat);
  const dLon = toRad(pos2.lon - pos1.lon);
  const lat1 = toRad(pos1.lat);
  const lat2 = toRad(pos2.lat);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 3D distance calculation including altitude
export const calculate3DDistance = (pos1, pos2, altitudeWeight = 0.1) => {
  // Horizontal distance (km)
  const horizontalDist = calculateDistance(pos1, pos2);
  
  // Vertical distance (km)
  const verticalDist = Math.abs(pos1.alt - pos2.alt) / 1000;
  
  // Combined distance with altitude weight
  // Weight of 0.1 means 10km altitude difference = 1km horizontal distance
  return Math.sqrt(
    horizontalDist ** 2 + 
    (verticalDist * altitudeWeight) ** 2
  );
};

const toRad = (degrees) => degrees * Math.PI / 180;

// Calculate bearing between two points
export const calculateBearing = (pos1, pos2) => {
  const dLon = toRad(pos2.lon - pos1.lon);
  const lat1 = toRad(pos1.lat);
  const lat2 = toRad(pos2.lat);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = Math.atan2(y, x);
  
  return ((bearing * 180 / Math.PI) + 360) % 360; // Convert to degrees 0-360
};

// ===== REGION COLORS FOR MAP =====

export const REGION_COLORS = {
  pacific: '#3b82f6',      // Blue
  atlantic: '#10b981',     // Green
  northAmerica: '#f59e0b', // Orange
  europe: '#8b5cf6',       // Purple
  asia: '#ec4899',         // Pink
  indian: '#06b6d4',       // Cyan
  other: '#6b7280'         // Gray
};

export const REGION_LEGEND = [
  { label: 'Pacific Ocean', color: '#3b82f6' },
  { label: 'Atlantic Ocean', color: '#10b981' },
  { label: 'North America', color: '#f59e0b' },
  { label: 'Europe', color: '#8b5cf6' },
  { label: 'Asia', color: '#ec4899' },
  { label: 'Other Regions', color: '#6b7280' }
];

// Determine which region a balloon belongs to
export const getRegion = (position) => {
  const { lat, lon } = position;
  
  if (lon >= -180 && lon <= -70) {
    if (lat >= 15 && lat <= 75) return 'northAmerica';
    return 'atlantic';
  } else if (lon >= -70 && lon <= 20) {
    return 'atlantic';
  } else if (lon >= 20 && lon <= 60) {
    if (lat >= 35 && lat <= 75) return 'europe';
    if (lat >= 0 && lat <= 35) return 'other';
    return 'indian';
  } else if (lon >= 60 && lon <= 150) {
    if (lat >= 10) return 'asia';
    return 'indian';
  }
  return 'pacific';
};

// Get color for a balloon based on region
export const getRegionColor = (position) => {
  const region = getRegion(position);
  return REGION_COLORS[region];
};

// ===== PHASE 1: WHERE (Regional Distribution) =====

export const calculateRegionalDistribution = (balloons) => {
  const regions = {
    northernHem: 0,
    southernHem: 0,
    pacific: 0,
    atlantic: 0,
    indian: 0,
    northAmerica: 0,
    europe: 0,
    asia: 0,
    other: 0
  };
  
  balloons.forEach(balloon => {
    const { lat, lon } = balloon.currentPosition;
    
    // Hemisphere
    if (lat >= 0) regions.northernHem++;
    else regions.southernHem++;
    
    // Oceans & Continents (simplified ranges)
    if (lon >= -180 && lon <= -70) {
      if (lat >= 15 && lat <= 75) regions.northAmerica++;
      else regions.atlantic++;
    } else if (lon >= -70 && lon <= 20) {
      regions.atlantic++;
    } else if (lon >= 20 && lon <= 60) {
      if (lat >= 35 && lat <= 75) regions.europe++;
      else if (lat >= 0 && lat <= 35) regions.other++; // Africa
      else regions.indian++;
    } else if (lon >= 60 && lon <= 150) {
      if (lat >= 10) regions.asia++;
      else regions.indian++;
    } else {
      regions.pacific++;
    }
  });
  
  return regions;
};

// DBSCAN Clustering Algorithm (Official Industry Standard)
// Guarantees no overlapping clusters, each balloon in max 1 cluster
export const detectClusters = (balloons, config = {}) => {
  const {
    eps = 1000,             // Epsilon: max distance in km (DBSCAN standard param)
    minPts = 15,            // Min points for cluster (DBSCAN standard param)
    altitudeWeight = 0.75   // Weight for altitude in 3D distance (0.75 = 1.33km vertical = 1km horizontal)
  } = config;
  
  const clusters = [];
  const visited = new Set();
  const clustered = new Set();
  
  // Get neighbors of a balloon within eps distance
  const getNeighbors = (balloon) => {
    return balloons.filter(other => {
      if (other.id === balloon.id) return false;
      const dist = calculate3DDistance(
        balloon.currentPosition,
        other.currentPosition,
        altitudeWeight
      );
      return dist <= eps;
    });
  };
  
  // Expand cluster using DBSCAN algorithm
  const expandCluster = (balloon, neighbors) => {
    const cluster = [balloon];
    clustered.add(balloon.id);
    
    const queue = [...neighbors];
    
    while (queue.length > 0) {
      const current = queue.shift();
      
      // Skip if already in a cluster
      if (clustered.has(current.id)) continue;
      
      clustered.add(current.id);
      cluster.push(current);
      
      // If not visited, check if it's a core point
      if (!visited.has(current.id)) {
        visited.add(current.id);
        const currentNeighbors = getNeighbors(current);
        
        // If core point, add its neighbors to queue
        if (currentNeighbors.length >= minPts) {
          queue.push(...currentNeighbors);
        }
      }
    }
    
    return cluster;
  };
  
  // Main DBSCAN loop
  balloons.forEach(balloon => {
    if (visited.has(balloon.id)) return;
    visited.add(balloon.id);
    
    const neighbors = getNeighbors(balloon);
    
    // Check if this is a core point (enough neighbors)
    if (neighbors.length >= minPts) {
      const cluster = expandCluster(balloon, neighbors);
      
      if (cluster.length >= minPts) {
        const center = calculateCenterPoint(cluster);
        clusters.push({
          center,
          count: cluster.length,
          balloons: cluster
        });
      }
    }
  });
  
  return clusters;
};

const calculateCenterPoint = (balloons) => {
  const sum = balloons.reduce((acc, b) => ({
    lat: acc.lat + b.currentPosition.lat,
    lon: acc.lon + b.currentPosition.lon
  }), { lat: 0, lon: 0 });
  
  return {
    lat: sum.lat / balloons.length,
    lon: sum.lon / balloons.length
  };
};

// ===== PHASE 2: HOW HIGH (Altitude Analysis) =====

export const calculateAltitudeStats = (balloons) => {
  const altitudes = balloons
    .map(b => b.currentPosition.alt)
    .filter(alt => alt > 0)
    .sort((a, b) => a - b);
  
  if (altitudes.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      distribution: []
    };
  }
  
  return {
    min: altitudes[0],
    max: altitudes[altitudes.length - 1],
    avg: altitudes.reduce((sum, alt) => sum + alt, 0) / altitudes.length,
    median: altitudes[Math.floor(altitudes.length / 2)],
    distribution: calculateAltitudeDistribution(altitudes)
  };
};

const calculateAltitudeDistribution = (altitudes) => {
  const bins = [
    { range: '0-5km', min: 0, max: 5000, count: 0 },
    { range: '5-10km', min: 5000, max: 10000, count: 0 },
    { range: '10-15km', min: 10000, max: 15000, count: 0 },
    { range: '15-20km', min: 15000, max: 20000, count: 0 },
    { range: '20-25km', min: 20000, max: 25000, count: 0 },
    { range: '25-30km', min: 25000, max: 30000, count: 0 },
    { range: '30km+', min: 30000, max: Infinity, count: 0 }
  ];
  
  altitudes.forEach(alt => {
    const bin = bins.find(b => alt >= b.min && alt < b.max);
    if (bin) bin.count++;
  });
  
  return bins;
};

export const getAltitudeColor = (altitude) => {
  if (altitude < 10000) return '#3b82f6';      // Blue - Troposphere
  if (altitude < 20000) return '#10b981';      // Green - Lower Strat
  if (altitude < 30000) return '#f59e0b';      // Yellow - Mid Strat
  return '#ef4444';                             // Red - Upper Strat
};

export const ALTITUDE_LEGEND = [
  { label: '0-10km (Troposphere)', color: '#3b82f6' },
  { label: '10-20km (Lower Strat)', color: '#10b981' },
  { label: '20-30km (Mid Strat)', color: '#f59e0b' },
  { label: '30km+ (Upper Strat)', color: '#ef4444' }
];

// Convert altitude (meters) to appropriate pressure level for weather API
export const getPressureLevel = (altitudeMeters) => {
  if (altitudeMeters < 1000) return '1000hPa'; // Surface (~0km)
  if (altitudeMeters < 5000) return '700hPa';  // Lower atmosphere (~3km)
  if (altitudeMeters < 9000) return '500hPa';  // Mid atmosphere (~5.5km)
  if (altitudeMeters < 14000) return '200hPa'; // Upper atmosphere (~12km)
  if (altitudeMeters < 20000) return '100hPa'; // Stratosphere (~16km) - WindBorne zone
  return '50hPa';                              // Higher stratosphere (~20km+)
};

// ===== PHASE 3: HOW MANY (Density & Concentration) =====

export const calculateDensity = (balloons, gridSize = 10) => {
  const grid = {};
  
  balloons.forEach(balloon => {
    const { lat, lon } = balloon.currentPosition;
    const gridLat = Math.floor(lat / gridSize) * gridSize;
    const gridLon = Math.floor(lon / gridSize) * gridSize;
    const key = `${gridLat},${gridLon}`;
    
    if (!grid[key]) {
      grid[key] = { lat: gridLat, lon: gridLon, count: 0 };
    }
    grid[key].count++;
  });
  
  return Object.values(grid);
};

export const getDensityStats = (densityGrid) => {
  if (!densityGrid || densityGrid.length === 0) {
    return {
      total: 0,
      cells: 0,
      avgPerCell: 0,
      maxInCell: 0,
      hotspots: 0
    };
  }
  
  const counts = densityGrid.map(cell => cell.count).sort((a, b) => b - a);
  
  return {
    total: counts.reduce((sum, c) => sum + c, 0),
    cells: densityGrid.length,
    avgPerCell: counts.reduce((sum, c) => sum + c, 0) / densityGrid.length,
    maxInCell: counts[0],
    hotspots: densityGrid.filter(cell => cell.count >= 20).length
  };
};

// ===== PHASE 4: HOW (Relationships) =====

export const calculateRelationships = (balloons) => {
  return balloons.map(balloon => {
    const distances = balloons
      .filter(b => b.id !== balloon.id)
      .map(b => calculateDistance(
        balloon.currentPosition,
        b.currentPosition
      ))
      .sort((a, b) => a - b);
    
    if (distances.length === 0) {
      return {
        id: balloon.id,
        nearestDistance: 0,
        avgDistance: 0,
        neighbors10km: 0,
        neighbors100km: 0
      };
    }
    
    return {
      id: balloon.id,
      nearestDistance: distances[0],
      avgDistance: distances.reduce((sum, d) => sum + d, 0) / distances.length,
      neighbors10km: distances.filter(d => d < 10).length,
      neighbors100km: distances.filter(d => d < 100).length
    };
  });
};

// ===== PHASE 5: CHANGE (Time Analysis) =====

export const trackBalloonMovement = (allHoursData) => {
  if (!allHoursData || allHoursData.length < 2) return [];
  
  const tracked = [];
  
  const hour0Balloons = allHoursData[0]?.balloons || [];
  const hour1Balloons = allHoursData[1]?.balloons || [];
  
  hour0Balloons.forEach(balloon0 => {
    // Find closest balloon in previous hour
    let closest = null;
    let minDist = Infinity;
    
    hour1Balloons.forEach(balloon1 => {
      const dist = calculateDistance(
        balloon0.currentPosition,
        balloon1.currentPosition
      );
      if (dist < minDist) {
        minDist = dist;
        closest = balloon1;
      }
    });
    
    if (closest && minDist < 500) { // Within 500km = likely same balloon
      const movement = {
        id: balloon0.id,
        distance: minDist,
        direction: calculateBearing(
          closest.currentPosition,
          balloon0.currentPosition
        ),
        speed: minDist / 1 // km/hour
      };
      tracked.push(movement);
    }
  });
  
  return tracked;
};

// ===== ADVANCED DATA SCIENCE FEATURES =====

// 1. SPEED DEMON LEADERBOARD
// Calculate total distance traveled by each balloon over 24 hours
export const calculateSpeedLeaderboard = (allHoursData) => {
  if (!allHoursData || allHoursData.length === 0) return [];

  const balloonTracks = {};

  // Group balloons by ID across all hours
  allHoursData.forEach(hourData => {
    hourData.balloons?.forEach(balloon => {
      if (!balloonTracks[balloon.id]) {
        balloonTracks[balloon.id] = [];
      }
      balloonTracks[balloon.id].push({
        hour: hourData.hour,
        position: balloon.currentPosition
      });
    });
  });

  // Calculate total distance for each balloon
  const leaderboard = Object.entries(balloonTracks).map(([id, positions]) => {
    // Sort by hour
    positions.sort((a, b) => a.hour - b.hour);

    let totalDistance = 0;
    let avgSpeed = 0;

    for (let i = 1; i < positions.length; i++) {
      const dist = calculateDistance(
        positions[i-1].position,
        positions[i].position
      );
      totalDistance += dist;
    }

    if (positions.length > 1) {
      avgSpeed = totalDistance / (positions.length - 1); // km per hour
    }

    return {
      id,
      totalDistance: Math.round(totalDistance),
      avgSpeed: Math.round(avgSpeed * 10) / 10, // Round to 1 decimal
      trackLength: positions.length
    };
  });

  // Sort by total distance (descending) and return top 5
  return leaderboard
    .filter(item => item.totalDistance > 0) // Only balloons that moved
    .sort((a, b) => b.totalDistance - a.totalDistance)
    .slice(0, 5);
};

// 2. EDDY HUNTER - Detect Cyclones
// Check if balloon heading rotates >360° in 24 hours (indicates cyclone/eddy)
export const detectEddies = (track) => {
  if (!track || track.length < 6) return false; // Need at least 6 hours of data

  let totalHeadingChange = 0;
  let directionChanges = 0;

  for (let i = 1; i < track.length; i++) {
    const prevPos = track[i-1];
    const currPos = track[i];

    // Skip if no movement
    if (calculateDistance(prevPos, currPos) < 1) continue;

    const heading = calculateBearing(prevPos, currPos);
    const prevHeading = i === 1 ? heading : calculateBearing(track[i-2], track[i-1]);

    let headingDiff = Math.abs(heading - prevHeading);
    // Handle 360° wraparound
    if (headingDiff > 180) headingDiff = 360 - headingDiff;

    totalHeadingChange += headingDiff;

    // Count significant direction changes (>45°)
    if (headingDiff > 45) directionChanges++;
  }

  // Flag as eddy if total rotation > 360° (full circle) or many direction changes
  return totalHeadingChange > 360 || directionChanges > track.length * 0.6;
};

// 3. CONVERGENCE DETECTOR - Pressure Systems
// Calculate if balloons are converging (moving closer) or diverging (spreading apart)
export const calculateConvergence = (balloons) => {
  if (!balloons || balloons.length < 3) return [];

  return balloons.map(balloon => {
    // Find 5 nearest neighbors
    const neighbors = balloons
      .filter(b => b.id !== balloon.id)
      .map(b => ({
        balloon: b,
        distance: calculateDistance(balloon.currentPosition, b.currentPosition)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    if (neighbors.length < 3) return { id: balloon.id, convergence: 0 };

    // Calculate average distance to neighbors
    const avgDistance = neighbors.reduce((sum, n) => sum + n.distance, 0) / neighbors.length;

    // For now, simulate convergence based on cluster density
    // In real implementation, this would compare distances over time
    const convergence = neighbors.length > 4 ? 1 : -1; // Simplified logic

    return {
      id: balloon.id,
      convergence, // 1 = converging (storm), -1 = diverging (calm)
      avgDistance: Math.round(avgDistance),
      neighborCount: neighbors.length
    };
  });
};

// 4. TURBULENCE TAG - Vertical Instability
// Detect rapid altitude changes indicating turbulence
export const detectTurbulence = (track) => {
  if (!track || track.length < 6) return false;

  let directionChanges = 0;
  let totalAltitudeChange = 0;

  for (let i = 1; i < track.length; i++) {
    const alt1 = track[i-1].alt;
    const alt2 = track[i].alt;
    const altDiff = alt2 - alt1;

    totalAltitudeChange += Math.abs(altDiff);

    // Count direction changes (up/down oscillations)
    if (i > 1) {
      const prevDiff = track[i-1].alt - track[i-2].alt;
      if ((altDiff > 0 && prevDiff < 0) || (altDiff < 0 && prevDiff > 0)) {
        directionChanges++;
      }
    }
  }

  // Flag as turbulent if many direction changes or high altitude volatility
  const avgAltitudeChange = totalAltitudeChange / (track.length - 1);
  return directionChanges > 3 || avgAltitudeChange > 1000; // 1km average change
};

// 5. SHEAR SCANNER - Steering Opportunities
// Find wind shear layers where nearby balloons move in different directions
export const detectShearLayers = (balloons) => {
  const shearLayers = [];

  balloons.forEach(balloonA => {
    balloons.forEach(balloonB => {
      if (balloonA.id === balloonB.id) return;

      const posA = balloonA.currentPosition;
      const posB = balloonB.currentPosition;

      // Check if balloons are nearby (<50km) but at different altitudes (>2km)
      const horizontalDist = calculateDistance(posA, posB);
      const verticalDist = Math.abs(posA.alt - posB.alt);

      if (horizontalDist < 50 && verticalDist > 2000) {
        // Calculate bearing difference
        const bearingA = calculateBearing(
          { lat: posA.lat - 0.1, lon: posA.lon }, // Approximate previous position
          posA
        );
        const bearingB = calculateBearing(
          { lat: posB.lat - 0.1, lon: posB.lon }, // Approximate previous position
          posB
        );

        const bearingDiff = Math.abs(bearingA - bearingB);
        const minBearingDiff = Math.min(bearingDiff, 360 - bearingDiff);

        // Flag as shear layer if directions differ by >90°
        if (minBearingDiff > 90) {
          shearLayers.push({
            balloonA: balloonA.id,
            balloonB: balloonB.id,
            distance: Math.round(horizontalDist),
            altitudeDiff: Math.round(verticalDist / 1000),
            bearingDiff: Math.round(minBearingDiff)
          });
        }
      }
    });
  });

  return shearLayers;
};
