import React, { useMemo, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateDensity, getDensityStats } from '../../services/analytics';
import {
  MapIcon,
  FireIcon,
  CalculatorIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline';

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
      <Card>
        <CardHeader>
          <CardTitle>Density Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-3 text-center">
              <MapIcon className="w-6 h-6 mx-auto mb-2" />
              <div className="text-lg font-bold">{stats.cells}</div>
              <div className="text-xs uppercase tracking-wide">Coverage Area</div>
            </Card>
            <Card className="p-3 text-center">
              <FireIcon className="w-6 h-6 mx-auto mb-2" />
              <div className="text-lg font-bold">{stats.hotspots}</div>
              <div className="text-xs uppercase tracking-wide">Hotspots</div>
            </Card>
            <Card className="p-3 text-center">
              <CalculatorIcon className="w-6 h-6 mx-auto mb-2" />
              <div className="text-lg font-bold">{stats.avgPerCell.toFixed(1)}</div>
              <div className="text-xs uppercase tracking-wide">Avg/Region</div>
            </Card>
            <Card className="p-3 text-center">
              <ArrowUpIcon className="w-6 h-6 mx-auto mb-2" />
              <div className="text-lg font-bold">{stats.maxInCell}</div>
              <div className="text-xs uppercase tracking-wide">Max/Region</div>
            </Card>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Dense Regions</CardTitle>
        </CardHeader>
        <CardContent>
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
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--popover-foreground))'
              }}
              content={({ payload }) => {
                if (payload && payload.length > 0) {
                  const data = payload[0].payload;
                  return (
                    <div className="text-xs">
                      <p className="font-semibold">{data.name}</p>
                      <p>Balloons: {data.density}</p>
                      <p className="opacity-70">~{data.lat.toFixed(0)}°, {data.lon.toFixed(0)}°</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="density"
              fill="hsl(var(--primary))"
              onClick={handleBarClick}
              onMouseEnter={handleBarHover}
              onMouseLeave={handleBarLeave}
              cursor="pointer"
            />
          </BarChart>
          </ResponsiveContainer>
          <p className="text-xs mt-2 italic">
            Tip: Click on bars to zoom to that region on the map
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Dense Region Visualization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-3">
          <p className="text-sm">
            Top 10 dense regions shown as purple rectangles.
          </p>
          <Button
            variant={showGrid ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleGrid}
          >
            {showGrid ? '✓ Grid On' : 'Grid Off'}
          </Button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 p-2 border rounded">
            <div className="w-4 h-4 bg-primary opacity-30 rounded"></div>
            <span>Purple rectangles = Dense regions (10° × 10° grid)</span>
          </div>
          <div className="flex items-center gap-2 p-2 border rounded">
            <div className="w-4 h-4 bg-destructive opacity-50 rounded"></div>
            <span>Red highlight = Selected region</span>
          </div>
          <div className="flex items-center gap-2 p-2 border rounded">
            <div className="w-4 h-4 rounded-full border-2 border-destructive"></div>
            <span>Red border = Balloons in selected region</span>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Density Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
          <div className="p-2 border rounded">
            <span className="font-semibold">Total Balloons:</span> {stats.total}
          </div>
          <div className="p-2 border rounded">
            <span className="font-semibold">Grid Cells with Data:</span> {stats.cells}
          </div>
          <div className="p-2 border rounded">
            <span className="font-semibold">High-Density Zones:</span> {stats.hotspots} regions with 20+ balloons
          </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const HowManyPanel = React.memo(HowManyPanelComponent);
