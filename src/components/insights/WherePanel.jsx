import React, { useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateRegionalDistribution, REGION_COLORS } from '../../services/analytics';
import {
  GlobeAmericasIcon,
  MapPinIcon,
  CubeIcon,
  HomeIcon
} from '@heroicons/react/24/outline';

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
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Hemispheres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Card 
              className="p-3 text-center cursor-pointer"
              onMouseEnter={() => handleHemisphereEnter('northern')}
              onMouseLeave={handleHemisphereLeave}
            >
              <GlobeAmericasIcon className="w-6 h-6 mx-auto mb-2" />
              <div className="text-lg font-bold">{distribution.northernHem}</div>
              <div className="text-xs uppercase tracking-wide">Northern</div>
              <Badge variant="outline" className="mt-2 text-xs">
                {(distribution.northernHem / balloons.length * 100).toFixed(0)}%
              </Badge>
            </Card>
            <Card 
              className="p-3 text-center cursor-pointer"
              onMouseEnter={() => handleHemisphereEnter('southern')}
              onMouseLeave={handleHemisphereLeave}
            >
              <MapPinIcon className="w-6 h-6 mx-auto mb-2" />
              <div className="text-lg font-bold">{distribution.southernHem}</div>
              <div className="text-xs uppercase tracking-wide">Southern</div>
              <Badge variant="outline" className="mt-2 text-xs">
                {(distribution.southernHem / balloons.length * 100).toFixed(0)}%
              </Badge>
            </Card>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Regional Distribution</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{clusters.length} Detected Clusters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-3">
            High-density clusters found (15+ balloons within 1000km)
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {sortedClusters.map((cluster, idx) => (
            <div 
              key={idx} 
              className="p-2 border rounded cursor-pointer"
              onMouseEnter={() => handleClusterEnter(cluster)}
              onMouseLeave={handleClusterLeave}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-sm">Cluster {idx + 1}</span>
                <span className="font-semibold text-sm">{cluster.count} balloons</span>
              </div>
              <div className="text-xs">
                Center: {cluster.center.lat.toFixed(1)}°, {cluster.center.lon.toFixed(1)}°
              </div>
            </div>
          ))}
          {sortedClusters.length === 0 && (
            <p className="text-sm italic">No large clusters detected</p>
          )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Coverage Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div 
            className="p-2 border rounded cursor-pointer"
            onMouseEnter={() => handleRegionEnter('pacific')}
            onMouseLeave={handleHemisphereLeave}
          >
            <div className="text-xs">Pacific Ocean</div>
            <div className="text-lg font-bold text-blue-600">{distribution.pacific}</div>
          </div>
          <div 
            className="p-2 border rounded cursor-pointer"
            onMouseEnter={() => handleRegionEnter('atlantic')}
            onMouseLeave={handleHemisphereLeave}
          >
            <div className="text-xs">Atlantic Ocean</div>
            <div className="text-lg font-bold text-green-600">{distribution.atlantic}</div>
          </div>
          <div 
            className="p-2 border rounded cursor-pointer"
            onMouseEnter={() => handleRegionEnter('northAmerica')}
            onMouseLeave={handleHemisphereLeave}
          >
            <div className="text-xs">North America</div>
            <div className="text-lg font-bold text-yellow-600">{distribution.northAmerica}</div>
          </div>
          <div 
            className="p-2 border rounded cursor-pointer"
            onMouseEnter={() => handleRegionEnter('europe')}
            onMouseLeave={handleHemisphereLeave}
          >
            <div className="text-xs">Europe</div>
            <div className="text-lg font-bold text-purple-600">{distribution.europe}</div>
          </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const WherePanel = React.memo(WherePanelComponent);
