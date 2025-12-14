import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Rectangle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CONFIG } from '../config';
import { fetchWeatherData, getWeatherDescription } from '../services/dataFetcher';
import { getAltitudeColor, ALTITUDE_LEGEND, getRegionColor, REGION_LEGEND } from '../services/analytics';

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
        
        return positions.map((pos, balloonIdx) => (
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
        ));
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

// Lazy popup content
const PopupContent = ({ balloon, position, inCluster }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const loadWeather = useCallback(async () => {
    if (!weather && !loading) {
      setLoading(true);
      const weatherData = await fetchWeatherData(position.lat, position.lon);
      setWeather(weatherData);
      setLoading(false);
    }
  }, [weather, loading, position]);
  
  return (
    <div className="balloon-popup">
      <h3>Balloon {balloon.id.substring(8)}</h3>
      <div className="balloon-info">
        <p><strong>Position:</strong> {position.lat.toFixed(4)}°, {position.lon.toFixed(4)}°</p>
        <p><strong>Altitude:</strong> {position.alt ? `${position.alt.toFixed(0)}m` : 'N/A'}</p>
        <p><strong>Age:</strong> {position.hour === 0 ? 'Current' : `${position.hour}h ago`}</p>
        {inCluster && <p><strong>Status:</strong> <span className="text-indigo-600">In Cluster</span></p>}
      </div>
      
      {!weather && !loading && (
        <button 
          onClick={loadWeather}
          className="mt-2 px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
        >
          Load Weather Data
        </button>
      )}
      
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
  balloons, 
  activeTab = 'altitude', 
  clusters = [], 
  denseRegions = [],
  selectedRegion = null,
  hoveredFilter = null,
  showGrid = false,
  hoveredCluster = null
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
          key={balloon.id} 
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
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        updateWhenIdle={false}
        updateWhenZooming={true}
        keepBuffer={4}
      />
      
      <GridOverlay showGrid={showGrid} />
      
      {activeTab === 'where' && (
        <ClusterLines 
          clusters={clusters} 
          hoveredCluster={hoveredCluster} 
          hoveredFilter={hoveredFilter} 
        />
      )}
      
      {activeTab === 'density' && (
        <DenseRegions regions={denseRegions} selectedRegion={selectedRegion} />
      )}
      
      {markers}
      
      {shouldUseFitBounds && !hoveredCluster && balloons.length > 0 && <FitBounds balloons={balloons} />}
      {selectedRegion && <ZoomToRegion selectedRegion={selectedRegion} />}
      <ZoomToCluster cluster={hoveredCluster} />
      
      {/* Dynamic Legend */}
      <div className="leaflet-top leaflet-right" style={{ marginTop: '10px', marginRight: '10px' }}>
        <div className="leaflet-control" style={{ backgroundColor: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 1px 5px rgba(0,0,0,0.2)' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>{legendTitle}</h4>
          {legend.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '12px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.color, border: '2px solid white' }} />
              <span>{item.label}</span>
            </div>
          ))}
          {clusters.length > 0 && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontSize: '11px', color: '#6b7280' }}>
              <span>Darker/larger = in cluster ({clusters.length} clusters)</span>
            </div>
          )}
        </div>
      </div>
    </MapContainer>
  );
}
