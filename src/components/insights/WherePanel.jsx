import React, { useMemo, useCallback } from 'react';
import { Card } from '../common/Card';
import { StatCard } from '../common/StatCard';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateRegionalDistribution, REGION_COLORS } from '../../services/analytics';

const WherePanelComponent = ({ balloons, clusters, onRegionClick, onHoverFilter, onClusterHover }) => {
  const distribution = useMemo(() => 
    calculateRegionalDistribution(balloons),
    [balloons]
  );
  
  // Sort clusters by size (largest first) - memoized
  const sortedClusters = useMemo(() => 
    clusters ? [...clusters].sort((a, b) => b.count - a.count) : [],
    [clusters]
  );
  
  // Memoize pieData to prevent re-renders
  const pieData = useMemo(() => [
    { name: 'Pacific', value: distribution.pacific, color: REGION_COLORS.pacific },
    { name: 'Atlantic', value: distribution.atlantic, color: REGION_COLORS.atlantic },
    { name: 'N.America', value: distribution.northAmerica, color: REGION_COLORS.northAmerica },
    { name: 'Europe', value: distribution.europe, color: REGION_COLORS.europe },
    { name: 'Asia', value: distribution.asia, color: REGION_COLORS.asia },
    { name: 'Other', value: distribution.other + distribution.indian, color: REGION_COLORS.other }
  ].filter(item => item.value > 0), [distribution]);
  
  // Memoize region map constant
  const regionMap = useMemo(() => ({
    'Pacific': 'pacific',
    'Atlantic': 'atlantic',
    'N.America': 'northAmerica',
    'Europe': 'europe',
    'Asia': 'asia',
    'Other': 'other'
  }), []);
  
  // Memoize event handlers
  const handlePieMouseEnter = useCallback((data) => {
    if (onHoverFilter && data) {
      onHoverFilter({ type: 'region', value: regionMap[data.name] || 'other' });
    }
  }, [onHoverFilter, regionMap]);
  
  const handlePieMouseLeave = useCallback(() => {
    onHoverFilter && onHoverFilter(null);
  }, [onHoverFilter]);
  
  const handleHemisphereEnter = useCallback((hemisphere) => {
    onHoverFilter && onHoverFilter({ type: 'hemisphere', value: hemisphere });
  }, [onHoverFilter]);
  
  const handleHemisphereLeave = useCallback(() => {
    onHoverFilter && onHoverFilter(null);
  }, [onHoverFilter]);
  
  const handleRegionEnter = useCallback((region) => {
    onHoverFilter && onHoverFilter({ type: 'region', value: region });
  }, [onHoverFilter]);
  
  const handleClusterEnter = useCallback((cluster) => {
    onHoverFilter && onHoverFilter({ type: 'cluster', value: cluster });
    onClusterHover && onClusterHover(cluster);
  }, [onHoverFilter, onClusterHover]);
  
  const handleClusterLeave = useCallback(() => {
    onHoverFilter && onHoverFilter(null);
    onClusterHover && onClusterHover(null);
  }, [onHoverFilter, onClusterHover]);
  
  return (
    <div className="space-y-4">
      <Card title="Hemispheres">
        <div className="grid grid-cols-2 gap-4">
          <div
            onMouseEnter={() => handleHemisphereEnter('northern')}
            onMouseLeave={handleHemisphereLeave}
            className="cursor-pointer transition-transform hover:scale-105"
          >
            <StatCard 
              label="Northern" 
              value={distribution.northernHem}
              percentage={(distribution.northernHem / balloons.length * 100).toFixed(0)}
            />
          </div>
          <div
            onMouseEnter={() => handleHemisphereEnter('southern')}
            onMouseLeave={handleHemisphereLeave}
            className="cursor-pointer transition-transform hover:scale-105"
          >
            <StatCard 
              label="Southern" 
              value={distribution.southernHem}
              percentage={(distribution.southernHem / balloons.length * 100).toFixed(0)}
            />
          </div>
        </div>
      </Card>
      
      <Card title="Regional Distribution">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(entry) => `${entry.name}: ${entry.value}`}
              onClick={(data) => onRegionClick && onRegionClick(data.name)}
              onMouseEnter={handlePieMouseEnter}
              onMouseLeave={handlePieMouseLeave}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      
      <Card title={`${clusters.length} Detected Clusters`}>
        <p className="text-sm text-gray-600 mb-3">
          High-density clusters found (15+ balloons within 1000km)
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {sortedClusters.map((cluster, idx) => (
            <div 
              key={idx} 
              className="p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors"
              onMouseEnter={() => handleClusterEnter(cluster)}
              onMouseLeave={handleClusterLeave}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-sm">Cluster {idx + 1}</span>
                <span className="text-indigo-600 font-semibold text-sm">{cluster.count} balloons</span>
              </div>
              <div className="text-xs text-gray-500">
                Center: {cluster.center.lat.toFixed(1)}°, {cluster.center.lon.toFixed(1)}°
              </div>
            </div>
          ))}
          {sortedClusters.length === 0 && (
            <p className="text-sm text-gray-400 italic">No large clusters detected</p>
          )}
        </div>
      </Card>
      
      <Card title="Coverage Summary">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div 
            className="p-2 bg-blue-50 rounded cursor-pointer hover:bg-blue-100 transition-colors"
            onMouseEnter={() => handleRegionEnter('pacific')}
            onMouseLeave={handleHemisphereLeave}
          >
            <div className="text-xs text-gray-600">Pacific Ocean</div>
            <div className="text-lg font-bold text-blue-600">{distribution.pacific}</div>
          </div>
          <div 
            className="p-2 bg-green-50 rounded cursor-pointer hover:bg-green-100 transition-colors"
            onMouseEnter={() => handleRegionEnter('atlantic')}
            onMouseLeave={handleHemisphereLeave}
          >
            <div className="text-xs text-gray-600">Atlantic Ocean</div>
            <div className="text-lg font-bold text-green-600">{distribution.atlantic}</div>
          </div>
          <div 
            className="p-2 bg-yellow-50 rounded cursor-pointer hover:bg-yellow-100 transition-colors"
            onMouseEnter={() => handleRegionEnter('northAmerica')}
            onMouseLeave={handleHemisphereLeave}
          >
            <div className="text-xs text-gray-600">North America</div>
            <div className="text-lg font-bold text-yellow-600">{distribution.northAmerica}</div>
          </div>
          <div 
            className="p-2 bg-purple-50 rounded cursor-pointer hover:bg-purple-100 transition-colors"
            onMouseEnter={() => handleRegionEnter('europe')}
            onMouseLeave={handleHemisphereLeave}
          >
            <div className="text-xs text-gray-600">Europe</div>
            <div className="text-lg font-bold text-purple-600">{distribution.europe}</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const WherePanel = React.memo(WherePanelComponent);
