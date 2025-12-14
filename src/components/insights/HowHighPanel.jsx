import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Card } from '../common/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateAltitudeStats, ALTITUDE_LEGEND } from '../../services/analytics';

const HowHighPanelComponent = ({ balloons, onAltitudeFilter, onHoverFilter }) => {
  const stats = useMemo(() => calculateAltitudeStats(balloons), [balloons]);
  const [altitudeRange, setAltitudeRange] = useState([0, 35000]);
  const hoverTimeoutRef = useRef(null);
  
  // Memoize altitude ranges constant
  const altitudeRanges = useMemo(() => ({
    '0-10km (Troposphere)': { min: 0, max: 10000 },
    '10-20km (Lower Strat)': { min: 10000, max: 20000 },
    '20-30km (Mid Strat)': { min: 20000, max: 30000 },
    '30km+ (Upper Strat)': { min: 30000, max: 35000 }
  }), []);
  
  // Memoize event handlers
  const handleRangeChange = useCallback((newMax) => {
    const newRange = [0, parseInt(newMax)];
    setAltitudeRange(newRange);
    if (onAltitudeFilter) {
      onAltitudeFilter(newRange);
    }
  }, [onAltitudeFilter]);
  
  const handleBarClick = useCallback((data) => {
    if (data && data.min !== undefined && onAltitudeFilter) {
      setAltitudeRange([data.min, data.max === Infinity ? 35000 : data.max]);
      onAltitudeFilter([data.min, data.max === Infinity ? 35000 : data.max]);
    }
  }, [onAltitudeFilter]);
  
  const handleBarHover = useCallback((data) => {
    // Clear any pending clear
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    if (data && data.min !== undefined && onHoverFilter) {
      onHoverFilter({
        type: 'altitude',
        value: { min: data.min, max: data.max === Infinity ? 35000 : data.max }
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
  
  const handleLayerHover = useCallback((layer) => {
    // Clear any pending clear
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    if (onHoverFilter) {
      onHoverFilter({
        type: 'altitude',
        value: altitudeRanges[layer.label] || { min: 0, max: 35000 }
      });
    }
  }, [onHoverFilter, altitudeRanges]);
  
  return (
    <div className="space-y-4">
      <Card title="Altitude Range">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">
              {(stats.min / 1000).toFixed(1)}km
            </div>
            <div className="text-xs text-gray-500 uppercase">Minimum</div>
          </div>
          <div className="p-2 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">
              {(stats.avg / 1000).toFixed(1)}km
            </div>
            <div className="text-xs text-gray-500 uppercase">Average</div>
          </div>
          <div className="p-2 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">
              {(stats.max / 1000).toFixed(1)}km
            </div>
            <div className="text-xs text-gray-500 uppercase">Maximum</div>
          </div>
        </div>
      </Card>
      
      <Card title="Distribution by Altitude">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={stats.distribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="range" 
              angle={-45} 
              textAnchor="end" 
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip />
            <Bar 
              dataKey="count" 
              fill="#6366f1"
              onClick={handleBarClick}
              onMouseEnter={handleBarHover}
              onMouseLeave={handleBarLeave}
              cursor="pointer"
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2 italic">
          Click on bars to filter map by altitude range
        </p>
      </Card>
      
      <Card title="Filter by Altitude">
        <input
          type="range"
          min="0"
          max="35000"
          step="1000"
          value={altitudeRange[1]}
          onChange={(e) => handleRangeChange(e.target.value)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>0km</span>
          <span className="font-semibold text-indigo-600">
            {(altitudeRange[1] / 1000).toFixed(0)}km
          </span>
          <span>35km</span>
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Showing balloons: 0 - {(altitudeRange[1] / 1000).toFixed(0)}km altitude
        </p>
      </Card>
      
      <Card title="Atmospheric Layers">
        <div className="space-y-2">
          {ALTITUDE_LEGEND.map((layer, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded transition-colors cursor-pointer"
              onMouseEnter={() => handleLayerHover(layer)}
              onMouseLeave={handleBarLeave}
            >
              <div 
                className="w-4 h-4 rounded flex-shrink-0"
                style={{ backgroundColor: layer.color }}
              />
              <span className="text-sm">{layer.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-gray-700">
          <strong>Note:</strong> Most weather balloons operate in the stratosphere (10-30km) where conditions are more stable.
        </div>
      </Card>
    </div>
  );
};

export const HowHighPanel = React.memo(HowHighPanelComponent);
