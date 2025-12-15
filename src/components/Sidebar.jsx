import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculateSegmentSpeed, getPressureLevel } from '../utils/trajectoryEngine';
import {
  MapPinIcon,
  CloudIcon,
  ArrowUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const Sidebar = ({ selectedTrack, selectedHour = 0 }) => {
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Get current position based on selected hour
  const currentPos = selectedTrack?.find(p => p.hourIndex === selectedHour) ||
                     selectedTrack?.[selectedTrack.length - 1];

  // Calculate drift analysis (actual vs model)
  const calculateDriftAnalysis = () => {
    if (!selectedTrack || selectedTrack.length < 2) return null;

    const prevPos = selectedTrack.find(p => p.hourIndex === selectedHour - 1);
    if (!prevPos) return null;

    const actualSpeed = calculateSegmentSpeed(prevPos, currentPos);
    return { actualSpeed, prevPos, currentPos };
  };

  const driftAnalysis = calculateDriftAnalysis();

  // Fetch weather model data for verification
  useEffect(() => {
    const fetchModelData = async () => {
      if (!currentPos) return;

      setLoadingWeather(true);
      try {
        const pressureLevel = getPressureLevel(currentPos.alt);
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${currentPos.lat}&longitude=${currentPos.lon}&hourly=windspeed_${pressureLevel},winddirection_${pressureLevel}&forecast_hours=1`
        );
        const data = await response.json();

        if (data.hourly) {
          setWeatherData({
            speed: data.hourly[`windspeed_${pressureLevel}`]?.[0] || 0,
            direction: data.hourly[`winddirection_${pressureLevel}`]?.[0] || 0,
            pressureLevel: pressureLevel
          });
        }
      } catch (error) {
        console.error('Failed to fetch model data:', error);
      } finally {
        setLoadingWeather(false);
      }
    };

    if (currentPos) {
      fetchModelData();
    }
  }, [currentPos]);

  // Prepare altitude profile data for chart
  const altitudeData = selectedTrack?.map(point => ({
    hour: point.hourIndex,
    altitude: Math.round(point.alt / 1000), // Convert to km
    speed: point.hourIndex > 0 ?
      Math.round(calculateSegmentSpeed(
        selectedTrack[point.hourIndex - 1],
        point
      )) : 0
  })) || [];

  if (!selectedTrack) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🎈</div>
          <p className="text-sm text-muted-foreground">Click on a balloon to view flight analysis</p>
        </div>
      </div>
    );
  }

  const deviation = weatherData && driftAnalysis ?
    Math.abs(driftAnalysis.actualSpeed - weatherData.speed) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold truncate">
            Balloon {selectedTrack[0].id.substring(0, 8)}
          </h3>
          <Badge variant={selectedHour === 0 ? 'default' : 'outline'} className="text-xs">
            {selectedHour === 0 ? 'LIVE' : `${selectedHour}h ago`}
          </Badge>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Current Position Info */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPinIcon className="w-4 h-4" />
            <h4 className="text-sm font-medium">Position</h4>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span>Lat, Lon</span>
              <span>{currentPos.lat.toFixed(2)}°, {currentPos.lon.toFixed(2)}°</span>
            </div>
            <div className="flex justify-between">
              <span>Altitude</span>
              <span>{(currentPos.alt / 1000).toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span>Track</span>
              <span>{selectedTrack.length} pts</span>
            </div>
          </div>
        </Card>

        {/* Altitude Profile Chart */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpIcon className="w-4 h-4" />
            <h4 className="text-sm font-medium">Altitude Profile</h4>
          </div>
          <ResponsiveContainer width="100%" height={100}>
          <LineChart data={altitudeData}>
            <XAxis
              dataKey="hour"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
              domain={['dataMin - 1', 'dataMax + 1']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              labelFormatter={(hour) => `${hour}h ago`}
              formatter={(value, name) => [
                name === 'altitude' ? `${value} km` : `${value} km/h`,
                name === 'altitude' ? 'Altitude' : 'Speed'
              ]}
            />
            <Line
              type="monotone"
              dataKey="altitude"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--card))' }}
            />
          </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Model Verification */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <CloudIcon className="w-4 h-4" />
            <h4 className="text-sm font-medium">Model Verification</h4>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
            <div className="text-center p-2 border rounded">
              <div>Actual</div>
              <div className="font-semibold">
                {driftAnalysis ? `${driftAnalysis.actualSpeed.toFixed(0)} km/h` : 'N/A'}
              </div>
            </div>
            <div className="text-center p-2 border rounded">
              <div>Model</div>
              <div className="font-semibold">
                {loadingWeather ? '...' : weatherData ? `${weatherData.speed.toFixed(0)} km/h` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Deviation Alert */}
          {weatherData && driftAnalysis && (
            <div className="p-2 border rounded text-xs">
              <div className="flex items-center gap-1.5">
                {deviation > 20 ? (
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                )}
                <span className="font-medium">
                  {deviation > 20 ? 'High Deviation' : 'Nominal'}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Atmospheric Conditions */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <CloudIcon className="w-4 h-4" />
            <h4 className="text-sm font-medium">Atmosphere</h4>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span>Pressure</span>
              <span>{weatherData?.pressureLevel || '...'}</span>
            </div>
            <div className="flex justify-between">
              <span>Wind Dir</span>
              <span>{weatherData ? `${Math.round(weatherData.direction)}°` : '...'}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Sidebar;
