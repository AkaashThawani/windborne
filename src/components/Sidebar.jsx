import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculateSegmentSpeed, calculateDriftVector } from '../utils/trajectoryEngine';
import { getWeatherDataForTrack, getCachedWeatherDataWithTime } from '../services/weatherService';
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
  const [hoveredHour, setHoveredHour] = useState(null);

  // Use hovered hour if available, otherwise selected hour
  const displayHour = hoveredHour ?? selectedHour;

  // Get current position based on display hour
  const currentPos = selectedTrack?.find(p => p.hourIndex === displayHour) ||
                     selectedTrack?.[selectedTrack.length - 1];

  // Calculate drift analysis (actual vs model)
  const calculateDriftAnalysis = () => {
    if (!selectedTrack || selectedTrack.length < 2) return null;

    // For display hour, use the previous hour for drift calculation
    const prevHourIndex = displayHour === 0 ? 23 : displayHour - 1;
    const prevPos = selectedTrack.find(p => p.hourIndex === prevHourIndex);

    if (!prevPos) return null;

    const actualSpeed = calculateSegmentSpeed(prevPos, currentPos);
    return { actualSpeed, prevPos, currentPos };
  };

  const driftAnalysis = calculateDriftAnalysis();

  // Get weather data for current display hour (using cached data only)
  useEffect(() => {
    // Use timeout to avoid synchronous setState
    const timer = setTimeout(() => {
      if (!currentPos || !selectedTrack) {
        setWeatherData(null);
        setLoadingWeather(false);
        return;
      }

      // Use cached weather data for the specific hour and balloon
      const cached = getCachedWeatherDataWithTime(
        currentPos.lat,
        currentPos.lon,
        currentPos.alt,
        displayHour,
        selectedTrack[0]?.id
      );

      setWeatherData(cached);
      setLoadingWeather(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [currentPos?.lat, currentPos?.lon, currentPos?.alt, displayHour, selectedTrack?.[0]?.id]);

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

  // Calculate model accuracy data for difference visualization (using time-aware weather data)
  const [modelAccuracyData, setModelAccuracyData] = useState([]);

  useEffect(() => {
    if (!selectedTrack) return;

    // Fetch weather data for entire track at once (checks cache, only calls API for missing hours)
    getWeatherDataForTrack(selectedTrack, selectedTrack[0]?.id).then(weatherData => {
      // Calculate model accuracy data
      const trackData = selectedTrack.map((point, index) => {
        const actualSpeed = point.hourIndex > 0 ?
          calculateSegmentSpeed(selectedTrack[index - 1], point) : 0;

        // Use the fetched weather data for this point
        const modelSpeed = weatherData[index]?.speed || 0;

        return {
          hour: point.hourIndex,
          actual: actualSpeed,
          model: modelSpeed,
          difference: actualSpeed - modelSpeed,
          absDifference: Math.abs(actualSpeed - modelSpeed),
          percentError: modelSpeed > 0 ? (Math.abs(actualSpeed - modelSpeed) / modelSpeed) * 100 : 0
        };
      });

      setModelAccuracyData(trackData);
    });
  }, [selectedTrack?.length, selectedTrack?.[0]?.id]); // Use primitive values instead of object

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
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">
              Balloon
            </h3>
            <Badge variant="secondary" className="text-xs font-mono">
              {selectedTrack[0]?.id || selectedTrack[0]?.balloonId || 'Unknown'}
            </Badge>
          </div>
          <Badge variant={hoveredHour !== null ? 'secondary' : selectedHour === 0 ? 'default' : 'outline'} className="text-xs">
            {hoveredHour !== null ? `Exploring: ${hoveredHour}h ago` : selectedHour === 0 ? 'LIVE' : `${selectedHour}h ago`}
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
              <span>ID</span>
              <span className="font-mono font-semibold">{selectedTrack[0]?.id || 'Unknown'}</span>
            </div>
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
          <LineChart
            data={altitudeData}
            onMouseMove={(data) => {
              if (data && data.activePayload && data.activePayload[0]) {
                const hoveredData = data.activePayload[0].payload;
                if (hoveredData && hoveredData.hour !== undefined) {
                  setHoveredHour(hoveredData.hour);
                }
              }
            }}
            onMouseLeave={() => setHoveredHour(null)}
          >
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
              type="monotoneX"
              dataKey="altitude"
              stroke="#60a5fa"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4, fill: '#60a5fa' }}
            />
          </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Vector Drift Analysis */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpIcon className="w-4 h-4" />
            <h4 className="text-sm font-medium">Vector Drift</h4>
          </div>
          <div className="space-y-2 text-xs">
            {driftAnalysis && (
              <>
                <div className="flex justify-between">
                  <span>Speed:</span>
                  <span className="font-semibold">{driftAnalysis.actualSpeed.toFixed(1)} km/h</span>
                </div>
                <div className="flex justify-between">
                  <span>Direction:</span>
                  <span className="font-semibold">
                    {calculateDriftVector(driftAnalysis.prevPos, driftAnalysis.currentPos).direction.toFixed(0)}°
                  </span>
                </div>
                {weatherData && (
                  <div className="flex justify-between">
                    <span>Model Error:</span>
                    <span className="font-semibold text-red-600">
                      {Math.abs(driftAnalysis.actualSpeed - weatherData.speed).toFixed(1)} km/h
                    </span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  Balloon measures actual wind vectors
                </div>
              </>
            )}
          </div>
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

        {/* Model Accuracy Chart */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <CloudIcon className="w-4 h-4" />
            <h4 className="text-sm font-medium">Model Accuracy</h4>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={modelAccuracyData}>
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
                domain={['dataMin - 10', 'dataMax + 10']}
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
                  `${value.toFixed(1)} km/h`,
                  name === 'actual' ? 'Balloon' :
                  name === 'model' ? 'API' :
                  name === 'difference' ? 'Difference' : name
                ]}
              />
              <Line
                type="monotoneX"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="actual"
              />
              <Line
                type="monotoneX"
                dataKey="model"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="model"
              />
              <Line
                type="monotoneX"
                dataKey="difference"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                strokeDasharray="3,3"
                name="difference"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Blue: Balloon | Green: API | Red: Difference</span>
          </div>
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
