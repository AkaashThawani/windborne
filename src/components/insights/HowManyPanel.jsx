import React, { useMemo, useCallback, useRef } from 'react';
import { Card } from '../common/Card';
import { StatCard } from '../common/StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateDensity, getDensityStats } from '../../services/analytics';

const HowManyPanelComponent = ({ balloons, onRegionClick, onHoverFilter, showGrid, onToggleGrid }) => {
  const densityGrid = useMemo(() => calculateDensity(balloons), [balloons]);
  const stats = useMemo(() => getDensityStats(densityGrid), [densityGrid]);
  const hoverTimeoutRef = useRef(null);
  
  const topRegions = useMemo(() =>
    densityGrid
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((cell, idx) => ({
        name: `Region ${idx + 1}`,
        density: cell.count,
        lat: cell.lat,
        lon: cell.lon
      })),
    [densityGrid]
  );
  
  // Memoize event handlers
  const handleBarClick = useCallback((data) => {
    if (onRegionClick && data) {
      onRegionClick({
        lat: data.lat,
        lon: data.lon,
        count: data.density
      });
    }
  }, [onRegionClick]);
  
  const handleBarHover = useCallback((data) => {
    // Clear any pending clear
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    if (data && onHoverFilter) {
      onHoverFilter({
        type: 'denseRegion',
        value: { lat: data.lat, lon: data.lon }
      });
    }
  }, [onHoverFilter]);
  
  const handleBarLeave = useCallback(() => {
    // Delay clearing the filter to avoid flash between items
    hoverTimeoutRef.current = setTimeout(() => {
      if (onHoverFilter) {
        onHoverFilter(null);
      }
    }, 150);
  }, [onHoverFilter]);
  
  return (
    <div className="space-y-4">
      <Card title="Density Overview">
        <div className="grid grid-cols-2 gap-4">
          <StatCard 
            label="Coverage Area" 
            value={`${stats.cells}`}
          />
          <StatCard 
            label="Hotspots" 
            value={stats.hotspots}
          />
          <StatCard 
            label="Avg/Region" 
            value={stats.avgPerCell.toFixed(1)}
          />
          <StatCard 
            label="Max/Region" 
            value={stats.maxInCell}
          />
        </div>
      </Card>
      
      <Card title="Top 10 Dense Regions">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={topRegions}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip 
              content={({ payload }) => {
                if (payload && payload.length > 0) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-xs">
                      <p className="font-semibold">{data.name}</p>
                      <p>Balloons: {data.density}</p>
                      <p className="text-gray-500">~{data.lat.toFixed(0)}°, {data.lon.toFixed(0)}°</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="density" 
              fill="#8b5cf6"
              onClick={handleBarClick}
              onMouseEnter={handleBarHover}
              onMouseLeave={handleBarLeave}
              cursor="pointer"
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2 italic">
          Tip: Click on bars to zoom to that region on the map
        </p>
      </Card>
      
      <Card title="Dense Region Visualization">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm text-gray-600">
            Top 10 dense regions shown as purple rectangles.
          </p>
          <button
            onClick={onToggleGrid}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              showGrid 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showGrid ? '✓ Grid On' : 'Grid Off'}
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
            <div className="w-4 h-4 bg-purple-600 opacity-30 rounded"></div>
            <span>Purple rectangles = Dense regions (10° × 10° grid)</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
            <div className="w-4 h-4 bg-red-600 opacity-50 rounded"></div>
            <span>Red highlight = Selected region</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <div className="w-4 h-4 bg-gray-600 rounded-full border-2 border-red-600"></div>
            <span>Red border = Balloons in selected region</span>
          </div>
        </div>
      </Card>
      
      <Card title="Density Insights">
        <div className="space-y-2 text-sm">
          <div className="p-2 bg-purple-50 rounded">
            <span className="font-semibold">Total Balloons:</span> {stats.total}
          </div>
          <div className="p-2 bg-blue-50 rounded">
            <span className="font-semibold">Grid Cells with Data:</span> {stats.cells}
          </div>
          <div className="p-2 bg-green-50 rounded">
            <span className="font-semibold">High-Density Zones:</span> {stats.hotspots} regions with 20+ balloons
          </div>
        </div>
      </Card>
    </div>
  );
};

export const HowManyPanel = React.memo(HowManyPanelComponent);
