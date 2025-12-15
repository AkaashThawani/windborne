import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateAltitudeStats, ALTITUDE_LEGEND } from '../../services/analytics';
import {
  ArrowDownIcon,
  ChartBarIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline';

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
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Altitude Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-3 text-center">
              <ArrowDownIcon className="w-6 h-6 mx-auto mb-2" />
              <div className="text-lg font-bold">{(stats.min / 1000).toFixed(1)}km</div>
              <div className="text-xs uppercase tracking-wide">Minimum</div>
            </Card>
            <Card className="p-3 text-center">
              <ChartBarIcon className="w-6 h-6 mx-auto mb-2" />
              <div className="text-lg font-bold">{(stats.avg / 1000).toFixed(1)}km</div>
              <div className="text-xs uppercase tracking-wide">Average</div>
            </Card>
            <Card className="p-3 text-center">
              <ArrowUpIcon className="w-6 h-6 mx-auto mb-2" />
              <div className="text-lg font-bold">{(stats.max / 1000).toFixed(1)}km</div>
              <div className="text-xs uppercase tracking-wide">Maximum</div>
            </Card>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Distribution by Altitude</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--popover-foreground))'
                }}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                onClick={handleBarClick}
                onMouseEnter={handleBarHover}
                onMouseLeave={handleBarLeave}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs mt-2 italic">
            Click on bars to filter map by altitude range
          </p>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Filter by Altitude</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="range"
            min="0"
            max="35000"
            step="1000"
            value={altitudeRange[1]}
            onChange={(e) => handleRangeChange(e.target.value)}
            className="w-full h-2 border rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs mt-2">
            <span>0km</span>
            <span className="font-semibold">
              {(altitudeRange[1] / 1000).toFixed(0)}km
            </span>
            <span>35km</span>
          </div>
          <p className="text-sm mt-3">
            Showing balloons: 0 - {(altitudeRange[1] / 1000).toFixed(0)}km altitude
          </p>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Atmospheric Layers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ALTITUDE_LEGEND.map((layer, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-2 border rounded cursor-pointer"
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
          <div className="mt-3 p-3 border rounded text-xs">
            <strong>Note:</strong> Most weather balloons operate in the stratosphere (10-30km) where conditions are more stable.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const HowHighPanel = React.memo(HowHighPanelComponent);
