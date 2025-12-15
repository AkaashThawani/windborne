import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Rectangle, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CONFIG } from '../config';
import { fetchWeatherData, getWeatherDescription } from '../services/dataFetcher';
import { getAltitudeColor, ALTITUDE_LEGEND, getRegionColor, REGION_LEGEND } from '../services/analytics';
import { calculateSegmentSpeed, getSpeedColor, getGlowClass } from '../utils/trajectoryEngine';

// Fix for default marker icon issue in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Global icon cache for performance
const iconCache = new Map();

// Create or get cached icon
function getOrCreateIcon(key, size, color, border) {
  const cacheKey = `${key}-${size}-${color}-${border}`;
  
  if (!iconCache.has(cacheKey)) {
    const icon = L.divIcon({
      className: 'custom-balloon-marker',
      html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border};"></div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
    iconCache.set(cacheKey, icon);
  }
  
  return iconCache.get(cacheKey);
}

// Component to fit map bounds to balloons
function FitBounds({ balloons }) {
  const map = useMap();
  
  useEffect(() => {
    if (balloons.length > 0) {
      const bounds = balloons.map(b => [b.currentPosition.lat, b.currentPosition.lon]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
    }
  }, [balloons, map]);
  
  return null;
}

// Component to handle zoom to region
function ZoomToRegion({ selectedRegion }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedRegion) {
      map.flyTo([selectedRegion.lat + 5, selectedRegion.lon + 5], 6, { duration: 1.5 });
    }
  }, [selectedRegion, map]);
  
  return null;
}

// Component to handle zoom to cluster with smooth transitions
function ZoomToCluster({ cluster }) {
  const map = useMap();
  const prevClusterRef = useRef(null);
  
  useEffect(() => {
    if (cluster) {
      // Immediately zoom to the selected cluster (no delay for smooth transitions)
      map.flyTo(
        [cluster.center.lat, cluster.center.lon], 
        6, 
        { duration: 0.8 }
      );
      prevClusterRef.current = cluster;
    } else if (prevClusterRef.current) {
      // Smooth zoom-out when unhovering (longer duration for smooth effect)
      map.flyTo(
        CONFIG.MAP_CONFIG.center, 
        CONFIG.MAP_CONFIG.zoom, 
        { duration: 0.8 }
      );
      prevClusterRef.current = null;
    }
  }, [cluster, map]);
  
  return null;
}

// Cluster connection lines (memoized)
const ClusterLines = React.memo(({ clusters, hoveredCluster, hoveredFilter }) => {
  if (!clusters || clusters.length === 0) return null;
  if (hoveredFilter && hoveredFilter.type !== 'cluster') return null;
  
  return (
    <>
      {clusters.map((cluster, idx) => {
        const positions = cluster.balloons.map(b => [
          b.currentPosition.lat,
          b.currentPosition.lon
        ]);

        return (
          <React.Fragment key={`cluster-${idx}`}>
            {positions.map((pos, balloonIdx) => (
              <Polyline
                key={`cluster-${idx}-line-${balloonIdx}`}
                positions={[
                  [cluster.center.lat, cluster.center.lon],
                  pos
                ]}
                pathOptions={{
                  color: '#6366f1',
                  weight: 2,
                  opacity: 0.6,
                  dashArray: '2, 4'
                }}
              />
            ))}
          </React.Fragment>
        );
      })}
      
      {hoveredCluster && clusters.map((cluster, idx) => {
        if (cluster !== hoveredCluster) return null;
        
        return (
          <Marker
            key={`cluster-center-${idx}`}
            position={[cluster.center.lat, cluster.center.lon]}
            icon={L.divIcon({
              className: 'cluster-center-marker',
              html: `<div style="background-color: #6366f1; width: 10px; height: 10px; border-radius: 50%; border: 3px solid #fbbf24;"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
          >
            <Popup>
              <div>
                <strong>Cluster {idx + 1} Center</strong>
                <p>{cluster.count} balloons</p>
                <p className="text-xs">
                  {cluster.center.lat.toFixed(2)}°, {cluster.center.lon.toFixed(2)}°
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
});

// Grid overlay (memoized)
const GridOverlay = React.memo(({ showGrid }) => {
  if (!showGrid) return null;
  
  const lines = [];
  const gridSize = 10;
  
  for (let lat = -80; lat <= 80; lat += gridSize) {
    lines.push(
      <Polyline
        key={`lat-${lat}`}
        positions={[[lat, -180], [lat, 180]]}
        pathOptions={{
          color: '#94a3b8',
          weight: 1,
          opacity: 0.3,
          dashArray: '5, 5'
        }}
      />
    );
  }
  
  for (let lon = -180; lon <= 180; lon += gridSize) {
    lines.push(
      <Polyline
        key={`lon-${lon}`}
        positions={[[-90, lon], [90, lon]]}
        pathOptions={{
          color: '#94a3b8',
          weight: 1,
          opacity: 0.3,
          dashArray: '5, 5'
        }}
      />
    );
  }
  
  return <>{lines}</>;
});

// Dense regions (memoized)
const DenseRegions = React.memo(({ regions, selectedRegion }) => {
  if (!regions || regions.length === 0) return null;
  
  return (
    <>
      {regions.map((region, idx) => {
        const isSelected = selectedRegion && 
          selectedRegion.lat === region.lat && 
          selectedRegion.lon === region.lon;
        
        return (
          <Rectangle
            key={`region-${idx}`}
            bounds={[
              [region.lat, region.lon],
              [region.lat + 10, region.lon + 10]
            ]}
            pathOptions={{
              color: isSelected ? '#ef4444' : '#8b5cf6',
              weight: isSelected ? 3 : 2,
              fillColor: isSelected ? '#ef4444' : '#8b5cf6',
              fillOpacity: isSelected ? 0.3 : 0.15
            }}
          >
            <Popup>
              <div>
                <strong>Dense Region #{idx + 1}</strong>
                <p>{region.count} balloons</p>
                <p className="text-xs text-gray-500">
                  ~{region.lat}° to {region.lat + 10}°,<br/>
                  {region.lon}° to {region.lon + 10}°
                </p>
              </div>
            </Popup>
          </Rectangle>
        );
      })}
    </>
  );
});

// Helper function to darken colors
function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16)
    .slice(1);
}

// Helper function to normalize longitude to -180 to 180 range
function normalizeLongitude(lon) {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

// Interpolation helper functions for smooth animation
function interpolatePosition(pos1, pos2, fraction) {
  if (!pos1 || !pos2) return pos1 || pos2;
  
  // Handle longitude wrapping (e.g., crossing from 179° to -179°)
  let lon1 = pos1.lon;
  let lon2 = pos2.lon;
  
  // Calculate the shortest path between two longitudes
  const diff = lon2 - lon1;
  if (Math.abs(diff) > 180) {
    // Wrapping is occurring
    if (diff > 0) {
      lon1 += 360; // pos1 was on the right, wrap it around
    } else {
      lon2 += 360; // pos2 was on the right, wrap it around
    }
  }
  
  const interpolatedLon = lon1 + (lon2 - lon1) * fraction;
  
  return {
    lat: pos1.lat + (pos2.lat - pos1.lat) * fraction,
    lon: normalizeLongitude(interpolatedLon),
    alt: pos1.alt + (pos2.alt - pos1.alt) * fraction,
    id: pos1.id,
    hourIndex: pos1.hourIndex
  };
}

function getInterpolatedPosition(track, selectedHour) {
  // Find the two positions that bracket selectedHour
  // hourCeil is the older position (higher hour index)
  // hourFloor is the newer position (lower hour index)
  const hourCeil = Math.ceil(selectedHour);
  const hourFloor = Math.floor(selectedHour);
  
  // Special handling for exact integer hours to prevent pauses
  // When at exact hour (e.g., 23.00000), still interpolate with next hour
  let olderPos, newerPos;
  
  if (hourCeil === hourFloor) {
    // At exact integer hour - interpolate with next hour for smooth transition
    olderPos = track.find(p => p.hourIndex === hourCeil);
    newerPos = track.find(p => p.hourIndex === hourFloor - 1);
    
    if (!olderPos || !newerPos) {
      return olderPos || newerPos;
    }
    
    // At exact boundary, fraction = 0 (fully at older position)
    return olderPos;
  }
  
  olderPos = track.find(p => p.hourIndex === hourCeil);
  newerPos = track.find(p => p.hourIndex === hourFloor);
  
  if (!olderPos || !newerPos) {
    return olderPos || newerPos;
  }
  
  // Calculate interpolation fraction (0 to 1)
  // INVERTED: As selectedHour decreases (24→0), fraction should increase (0→1)
  // fraction = 0 means we're at the older position (hourCeil)
  // fraction = 1 means we're at the newer position (hourFloor)
  const fraction = hourCeil - selectedHour;
  // Interpolate FROM older TO newer (forward in time as selectedHour decreases)
  return interpolatePosition(olderPos, newerPos, fraction);
}

// Lazy popup content
const PopupContent = ({ balloon, position, inCluster }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading=true
 
  // Automatically load weather data when popup opens
  useEffect(() => {
    const loadWeatherData = async () => {
      try {
        const weatherData = await fetchWeatherData(position.lat, position.lon, position.alt);
        setWeather(weatherData);
      } catch (error) {
        console.error('Failed to load weather data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWeatherData();
  }, [position]); // Depend on position to reload if it changes

  return (
    <div className="balloon-popup">
      <h3>Balloon {balloon.id.substring(8)}</h3>
      <div className="balloon-info">
        <p><strong>Position:</strong> {position.lat.toFixed(4)}°, {position.lon.toFixed(4)}°</p>
        <p><strong>Altitude:</strong> {position.alt ? `${position.alt.toFixed(0)}m` : 'N/A'}</p>
        <p><strong>Age:</strong> {position.hour === 0 ? 'Current' : `${position.hour}h ago`}</p>
        {inCluster && <p><strong>Status:</strong> <span className="text-indigo-600">In Cluster</span></p>}
      </div>

      {loading && (
        <div className="weather-info">
          <p>Loading weather data...</p>
        </div>
      )}

      {weather && (
        <div className="weather-info">
          <h4>Weather Conditions</h4>
          <p><strong>Temperature:</strong> {weather.temperature}°C</p>
          <p><strong>Wind:</strong> {weather.windSpeed} m/s @ {weather.windDirection}°</p>
          <p><strong>Pressure:</strong> {weather.pressure} hPa</p>
          <p><strong>Humidity:</strong> {weather.humidity}%</p>
          <p><strong>Cloud Cover:</strong> {weather.cloudCover}%</p>
          <p><strong>Conditions:</strong> {getWeatherDescription(weather.weatherCode)}</p>
        </div>
      )}
    </div>
  );
};

// Optimized balloon marker with React.memo
const BalloonMarker = React.memo(({ 
  balloon, 
  activeTab, 
  clusters, 
  selectedRegion, 
  highlighted 
}) => {
  const position = balloon.currentPosition;
  
  // Pre-calculate values
  const inCluster = useMemo(() => 
    clusters?.some(cluster => cluster.balloons.some(b => b.id === balloon.id)) || false,
    [clusters, balloon.id]
  );
  
  const inSelected = useMemo(() => {
    if (!selectedRegion) return false;
    const { lat, lon } = position;
    return lat >= selectedRegion.lat && 
           lat < selectedRegion.lat + 10 &&
           lon >= selectedRegion.lon && 
           lon < selectedRegion.lon + 10;
  }, [selectedRegion, position]);
  
  // Determine color
  const baseColor = useMemo(() => {
    switch(activeTab) {
      case 'where':
        return getRegionColor(position);
      case 'altitude':
      case 'density':
      default:
        return getAltitudeColor(position.alt);
    }
  }, [activeTab, position]);
  
  const color = useMemo(() => {
    if (!highlighted) return '#9ca3af';
    if (inCluster) return darkenColor(baseColor, 30);
    return baseColor;
  }, [highlighted, inCluster, baseColor]);
  
  // Determine size and border
  const size = !highlighted ? 8 : (inCluster || inSelected) ? 16 : 12;
  const border = inSelected ? '3px solid #ef4444' : 
                 inCluster ? '3px solid #a5b4fc' : 
                 '2px solid white';
  
  // Get cached icon
  const icon = useMemo(() => 
    getOrCreateIcon(balloon.id, size, color, border),
    [balloon.id, size, color, border]
  );
  
  return (
    <Marker
      position={[position.lat, position.lon]}
      icon={icon}
    >
      <Popup maxWidth={300} lazy={true}>
        <PopupContent 
          balloon={balloon} 
          position={position} 
          inCluster={inCluster}
        />
      </Popup>
    </Marker>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return prevProps.balloon.id === nextProps.balloon.id &&
         prevProps.highlighted === nextProps.highlighted &&
         prevProps.activeTab === nextProps.activeTab &&
         prevProps.selectedRegion === nextProps.selectedRegion &&
         prevProps.clusters === nextProps.clusters;
});

// Helper functions
function shouldHighlight(balloon, hoveredFilter, clusters) {
  if (!hoveredFilter) return true;

  const { type, value } = hoveredFilter;
  const pos = balloon.currentPosition;

  switch(type) {
    case 'hemisphere':
      return (value === 'northern' && pos.lat >= 0) ||
             (value === 'southern' && pos.lat < 0);

    case 'region': {
      const balloonRegion = getRegion(pos);
      return balloonRegion === value;
    }

    case 'altitude':
      return pos.alt >= value.min && pos.alt < value.max;

    case 'cluster':
      return clusters.some(cluster =>
        cluster.balloons.some(b => b.id === balloon.id) &&
        cluster === value
      );

    case 'denseRegion':
      return pos.lat >= value.lat && pos.lat < value.lat + 10 &&
             pos.lon >= value.lon && pos.lon < value.lon + 10;

    default:
      return true;
  }
}

// Flow Trails Component - Speed-colored trajectory lines (only for selected balloon)
const FlowTrails = React.memo(({ selectedTrack }) => {
  // Memoize trail elements to prevent recalculation on every render
  const trailElements = useMemo(() => {
    if (!selectedTrack || selectedTrack.length === 0) return null;

    const elements = [];
    
    // Sample every 2-3 hours for better performance (reduce polylines by ~66%)
    const SAMPLE_RATE = 3; // Only render every 3rd point

    for (let i = SAMPLE_RATE; i < selectedTrack.length; i += SAMPLE_RATE) {
      const point = selectedTrack[i];
      const prevPoint = selectedTrack[i - SAMPLE_RATE];
      
      // Skip drawing line if it crosses the date line (would draw across entire map)
      const lonDiff = Math.abs(point.lon - prevPoint.lon);
      if (lonDiff > 180) {
        // This segment crosses the date line, skip it to avoid line across map
        continue;
      }
      
      const speed = calculateSegmentSpeed(prevPoint, point);
      const color = getSpeedColor(speed);
      const glowClass = getGlowClass(speed);

      // Opacity based on age (older = more transparent)
      const opacity = (i / selectedTrack.length) * 0.8 + 0.2;

      elements.push(
        <Polyline
          key={`trail-selected-${i}`}
          positions={[
            [prevPoint.lat, prevPoint.lon],
            [point.lat, point.lon]
          ]}
          pathOptions={{
            color: color,
            weight: 4,
            opacity: opacity,
            lineCap: 'round'
          }}
          className={glowClass}
        />
      );
    }

    return elements;
  }, [selectedTrack]); // Only recalculate when selectedTrack changes

  return <>{trailElements}</>;
});

// Smooth marker animation component using requestAnimationFrame
const SmoothMarker = ({ track, selectedHourRef, selectedTrack, onBalloonClick }) => {
  const markerRef = React.useRef(null);
  const animationRef = React.useRef(null);

  // Get initial position for rendering (start at hour 23)
  const initialPos = getInterpolatedPosition(track, 23.0);

  // Use ref for continuous smooth animation without React re-renders
  React.useEffect(() => {
    if (!markerRef.current || !initialPos) return;

    const marker = markerRef.current;
    let isAnimating = true;
    let lastColorUpdate = 0;

    function animate() {
      if (!isAnimating || !selectedHourRef || !markerRef.current) return;

      // Update position from ref (smooth, no React re-render)
      const currentHour = selectedHourRef.current;
      const targetPos = getInterpolatedPosition(track, currentHour);

      if (targetPos && marker) {
        try {
          const currentLatLng = marker.getLatLng();
          if (!currentLatLng) return;

          const targetLat = targetPos.lat;
          const targetLng = targetPos.lon;

          // Calculate distance to target
          const distance = Math.sqrt(
            Math.pow(targetLat - currentLatLng.lat, 2) +
            Math.pow(targetLng - currentLatLng.lng, 2)
          );

          // Only update if distance is significant
          if (distance > 0.00001) {
            // Smooth interpolation (ease towards target)
            const smoothing = 0.3; // Lower = smoother but slower
            const newLat = currentLatLng.lat + (targetLat - currentLatLng.lat) * smoothing;
            const newLng = currentLatLng.lng + (targetLng - currentLatLng.lng) * smoothing;
            marker.setLatLng([newLat, newLng]);
          }

          // Update color based on current speed (every 500ms to avoid too frequent updates)
          const now = Date.now();
          if (now - lastColorUpdate > 500) {
            const hourCeil = Math.ceil(currentHour);
            const hourFloor = Math.floor(currentHour);
            const pos1 = track.find(p => p.hourIndex === hourCeil);
            const pos2 = track.find(p => p.hourIndex === hourFloor);
            
            if (pos1 && pos2 && hourCeil !== hourFloor) {
              const speed = calculateSegmentSpeed(pos1, pos2);
              const isSelected = selectedTrack && track === selectedTrack;
              const newColor = isSelected ? getSpeedColor(speed) : 
                              (!selectedTrack ? getSpeedColor(speed) : '#9CA3AF');
              
              // Update marker color directly
              const pathOptions = marker.options;
              if (pathOptions.fillColor !== newColor) {
                marker.setStyle({ fillColor: newColor });
              }
            }
            lastColorUpdate = now;
          }
        } catch {
          // Marker was unmounted or canvas context lost, stop animating
          isAnimating = false;
          return;
        }
      }

      if (isAnimating) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      isAnimating = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [track, selectedHourRef, initialPos, selectedTrack]);

  if (!initialPos) return null;

  // Calculate initial speed for color (at hour 23)
  const pos1 = track.find(p => p.hourIndex === 23);
  const pos2 = track.find(p => p.hourIndex === 22);
  
  let speed = 0;
  if (pos1 && pos2) {
    speed = calculateSegmentSpeed(pos1, pos2);
  }

  // Focus mode styling
  const isSelected = selectedTrack && track === selectedTrack;
  const opacity = isSelected || !selectedTrack ? 1 : 0.3;
  const color = isSelected ?
    getSpeedColor(speed) :
    (!selectedTrack ? getSpeedColor(speed) : '#9CA3AF');
  const radius = isSelected ? 7 : 6;

  return (
    <CircleMarker
      ref={markerRef}
      center={[initialPos.lat, initialPos.lon]}
      radius={radius}
      pathOptions={{
        color: '#fff',
        fillColor: color,
        fillOpacity: opacity,
        weight: 2
      }}
      eventHandlers={{
        click: () => onBalloonClick && onBalloonClick(track)
      }}
    />
  );
};

// Flow Markers Component - Smooth position updates with speed-based styling and focus mode
const FlowMarkers = React.memo(({ tracks, selectedHourRef, selectedTrack, onBalloonClick }) => {
  if (!tracks || Object.keys(tracks).length === 0) return null;

  return Object.values(tracks).map(track => (
    <SmoothMarker
      key={track[0]?.id}
      track={track}
      selectedHourRef={selectedHourRef}
      selectedTrack={selectedTrack}
      onBalloonClick={onBalloonClick}
    />
  ));
}, (prevProps, nextProps) => {
  // Only re-render if tracks or selectedTrack changes (NOT selectedHour!)
  // This allows smooth 24h animation without re-render jerks
  return prevProps.selectedTrack === nextProps.selectedTrack &&
         prevProps.tracks === nextProps.tracks;
});

function getRegion(position) {
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
}

export default function BalloonMap({
  tracks = {},
  balloons,
  viewMode = 'static',
  onBalloonClick,
  activeTab = 'altitude',
  clusters = [],
  denseRegions = [],
  selectedRegion = null,
  hoveredFilter = null,
  showGrid = false,
  hoveredCluster = null,
  selectedTrack = null,
  selectedHourRef = null
}) {
  // Only use FitBounds on initial load, not when clusters are available (WHERE tab)
  const shouldUseFitBounds = activeTab !== 'where' || clusters.length === 0;
  
  // Memoize legend data
  const legend = useMemo(() => 
    activeTab === 'where' ? REGION_LEGEND : ALTITUDE_LEGEND,
    [activeTab]
  );
  
  const legendTitle = useMemo(() =>
    activeTab === 'where' ? 'Region Colors' : 'Altitude Legend',
    [activeTab]
  );

  // Memoize markers with highlight calculation
  const markers = useMemo(() =>
    balloons.map(balloon => {
      const highlighted = shouldHighlight(balloon, hoveredFilter, clusters);
      return (
        <BalloonMarker
          key={`balloon-${balloon.id}`}
          balloon={balloon}
          activeTab={activeTab}
          clusters={clusters}
          selectedRegion={selectedRegion}
          highlighted={highlighted}
        />
      );
    }),
    [balloons, activeTab, clusters, selectedRegion, hoveredFilter]
  );

  // Render flow visualization or static markers based on view mode
  const renderVisualization = () => {
    if (viewMode === 'flow') {
      return (
        <>
          <FlowTrails selectedTrack={selectedTrack} />
          <FlowMarkers
            tracks={tracks}
            selectedHourRef={selectedHourRef}
            selectedTrack={selectedTrack}
            onBalloonClick={onBalloonClick}
          />
        </>
      );
    } else {
      // Static analysis mode
      return <>{markers}</>;
    }
  };

  return (
    <MapContainer
      center={CONFIG.MAP_CONFIG.center}
      zoom={CONFIG.MAP_CONFIG.zoom}
      minZoom={CONFIG.MAP_CONFIG.minZoom}
      maxZoom={CONFIG.MAP_CONFIG.maxZoom}
      worldCopyJump={true}
      preferCanvas={true}
      zoomSnap={0.5}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={120}
      scrollWheelZoom={true}
      doubleClickZoom={true}
      zoomControl={true}
      dragging={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        updateWhenIdle={false}
        updateWhenZooming={true}
        keepBuffer={4}
      />

      <GridOverlay showGrid={showGrid} />

      {activeTab === 'where' && viewMode === 'static' && (
        <ClusterLines
          clusters={clusters}
          hoveredCluster={hoveredCluster}
          hoveredFilter={hoveredFilter}
        />
      )}

      {activeTab === 'density' && viewMode === 'static' && (
        <DenseRegions regions={denseRegions} selectedRegion={selectedRegion} />
      )}

      {renderVisualization()}

      {shouldUseFitBounds && !hoveredCluster && balloons.length > 0 && viewMode !== 'flow' && <FitBounds balloons={balloons} />}
      {selectedRegion && viewMode !== 'flow' && <ZoomToRegion selectedRegion={selectedRegion} />}
      {viewMode !== 'flow' && <ZoomToCluster cluster={hoveredCluster} />}

      {/* Dynamic Legend */}
      <div className="leaflet-top leaflet-right" style={{ marginTop: '10px', marginRight: '10px' }}>
        <div className="bg-card text-card-foreground p-4 rounded-lg shadow-lg">
          <h4 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">
            {viewMode === 'flow' ? 'Speed Legend' : legendTitle}
          </h4>
          {viewMode === 'flow' ? (
            // Speed-based legend for flow view
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 border border-white" />
                <span className="text-xs">0-30 km/h (Slow)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 border border-white" />
                <span className="text-xs">30-60 km/h (Moderate)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-pink-500 border border-white" />
                <span className="text-xs">60-90 km/h (Strong)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white" />
                <span className="text-xs">90+ km/h (Jet Stream)</span>
              </div>
            </div>
          ) : (
            // Original legend for static view
            <div className="space-y-2">
              {legend.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full border border-white"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs">{item.label}</span>
                </div>
              ))}
              {clusters.length > 0 && (
                <div className="pt-2 mt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Darker/larger = in cluster ({clusters.length} clusters)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MapContainer>
  );
}
