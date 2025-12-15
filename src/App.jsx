import { useState, useEffect, useCallback } from 'react';
import BalloonMap from './components/BalloonMap';
import Sidebar from './components/Sidebar';
import TimeScrubber from './components/TimeScrubber';
import { TabPanel } from './components/common/TabPanel';
import { WherePanel } from './components/insights/WherePanel';
import { HowHighPanel } from './components/insights/HowHighPanel';
import { HowManyPanel } from './components/insights/HowManyPanel';
import { fetchAllBalloonData, processBalloonData } from './services/dataFetcher';
import { calculateRegionalDistribution, calculateAltitudeStats, detectClusters, calculateDensity } from './services/analytics';
import { processConstellationHistory } from './utils/trajectoryEngine';
import { CONFIG } from './config';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import {
  CubeIcon,
  ClockIcon,
  ArrowUpIcon,
  EyeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

function App() {
  // Data states
  const [balloons, setBalloons] = useState([]);
  const [tracks, setTracks] = useState({});
  const [filteredBalloons, setFilteredBalloons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // UI states
  const [activeTab, setActiveTab] = useState('where');
  const [altitudeFilter, setAltitudeFilter] = useState([0, 35000]);
  const [clusters, setClusters] = useState([]);
  const [denseRegions, setDenseRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [hoveredFilter, setHoveredFilter] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const [hoveredCluster, setHoveredCluster] = useState(null);

  // Mission control states
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [selectedHour, setSelectedHour] = useState(0);
  const [viewMode, setViewMode] = useState('static'); // 'flow' or 'static'
  const [isPlaying, setIsPlaying] = useState(false);

  const [stats, setStats] = useState({
    totalBalloons: 0,
    hoursWithData: 0,
    avgAltitude: 0
  });
  
  const tabs = [
    { id: 'where', label: 'WHERE' },
    { id: 'altitude', label: 'HOW HIGH' },
    { id: 'density', label: 'HOW MANY' }
  ];

  const loadBalloonData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const allHoursData = await fetchAllBalloonData();
      
      if (allHoursData.length === 0) {
        setError('No balloon data available');
        setLoading(false);
        return;
      }
      
      const processed = processBalloonData(allHoursData);
      const trajectoryTracks = processConstellationHistory(allHoursData);
      console.log('Processed Balloons:', processed);
      console.log('Trajectory Tracks:', trajectoryTracks);
      setBalloons(processed);
      setTracks(trajectoryTracks);
      setFilteredBalloons(processed);
      
      // Calculate statistics
      const totalBalloons = processed.length;
      const hoursWithData = allHoursData.length;
      const altitudeStats = calculateAltitudeStats(processed);
      const regionalDist = calculateRegionalDistribution(processed);
      
      // Calculate clusters and dense regions
      const detectedClusters = detectClusters(processed);
      const densityGrid = calculateDensity(processed);
      const topDenseRegions = densityGrid
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      setClusters(detectedClusters);
      setDenseRegions(topDenseRegions);
      
      setStats({
        totalBalloons,
        hoursWithData,
        avgAltitude: Math.round(altitudeStats.avg),
        northernHem: regionalDist.northernHem,
        southernHem: regionalDist.southernHem
      });
      
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalloonData();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      loadBalloonData();
    }, CONFIG.REFRESH_INTERVAL);
    
    return () => clearInterval(interval);
  }, [loadBalloonData]);
  
  // Apply altitude filter
  useEffect(() => {
    const filtered = balloons.filter(b => {
      const alt = b.currentPosition.alt;
      return alt >= altitudeFilter[0] && alt <= altitudeFilter[1];
    });
    setFilteredBalloons(filtered);
  }, [balloons, altitudeFilter]);
  
  const handleAltitudeFilter = (range) => {
    setAltitudeFilter(range);
  };
  
  const handleRegionClick = (region) => {
    console.log('Region selected:', region);
    setSelectedRegion(region);
    // Clear selection after 5 seconds
    setTimeout(() => setSelectedRegion(null), 5000);
  };
  
  const handleWhereRegionClick = (regionName) => {
    console.log('WHERE panel region clicked:', regionName);
    // Could implement region filtering here
  };

  // Time animation effect
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSelectedHour(prev => (prev + 1) % 24);
    }, 1000); // 1 second per hour

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleBalloonClick = (track) => {
    setSelectedTrack(track);
    setViewMode('flow'); // Switch to flow view when balloon is selected
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="px-6 py-3 space-y-3">
          {/* Row 1: Title */}
          <div>
            <h1 className="text-xl font-bold">🛰️ WindBorne Telemetry Dashboard</h1>
            <p className="text-xs">Real-time monitoring & analysis</p>
          </div>

          {/* Row 2: Controls (Single Line) */}
          <div className="flex items-center gap-4">
            {/* Time Control */}
            <TimeScrubber
              currentHour={selectedHour}
              onHourChange={setSelectedHour}
              maxHours={24}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
            />

            {/* View Buttons */}
            <div className="flex gap-2 shrink-0">
              <Button
                variant={viewMode === 'flow' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('flow')}
                title="Flow View - Track balloon movements"
              >
                <EyeIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'static' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('static')}
                title="Analysis View - Explore insights"
              >
                <ChartBarIcon className="w-4 h-4" />
              </Button>
            </div>

            {/* Stats (Inline with Icons) */}
            <div className="flex items-center gap-4 text-sm shrink-0">
              <span className="flex items-center gap-1">
                <CubeIcon className="w-4 h-4" />
                {stats.totalBalloons}
              </span>
              <span className="flex items-center gap-1">
                <ArrowUpIcon className="w-4 h-4" />
                {(stats.avgAltitude / 1000).toFixed(1)}km
              </span>
              <span className="flex items-center gap-1">
                <ClockIcon className="w-4 h-4" />
                {stats.hoursWithData}h
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col justify-center items-center h-[calc(100vh-120px)]">
          <div className="w-12 h-12 border-4 border-border border-t-foreground rounded-full animate-spin mb-6"></div>
          <h3 className="text-xl mb-4">Loading Balloon Constellation...</h3>
          <p className="text-sm">Processing 24 hours of trajectory data</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex flex-col justify-center items-center h-[calc(100vh-120px)]">
          <h3 className="text-xl mb-4">⚠️ Data Loading Error</h3>
          <p className="text-sm mb-6">{error}</p>
          <Button variant="outline" onClick={loadBalloonData}>Retry</Button>
        </div>
      )}

      {/* Main Mission Control Interface */}
      {!loading && !error && balloons.length > 0 && (
        <div className="flex h-[calc(100vh-120px)] overflow-hidden">
          {/* Map Section */}
          <div className="flex-1 relative bg-background">
            <BalloonMap
              tracks={tracks}
              balloons={filteredBalloons}
              viewMode={viewMode}
              onBalloonClick={handleBalloonClick}
              activeTab={activeTab}
              clusters={clusters}
              denseRegions={denseRegions}
              selectedRegion={selectedRegion}
              hoveredFilter={hoveredFilter}
              showGrid={showGrid}
              hoveredCluster={hoveredCluster}
            />
          </div>

          {/* Sidebar Section */}
          <div className="w-[400px] border-l flex flex-col overflow-hidden">
            {selectedTrack ? (
              <Sidebar
                selectedTrack={selectedTrack}
                selectedHour={selectedHour}
              />
            ) : (
              <TabPanel
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
              >
                {activeTab === 'where' && (
                  <WherePanel
                    balloons={filteredBalloons}
                    clusters={clusters}
                    onRegionClick={handleWhereRegionClick}
                    onHoverFilter={setHoveredFilter}
                    onClusterHover={setHoveredCluster}
                  />
                )}
                {activeTab === 'altitude' && (
                  <HowHighPanel
                    balloons={balloons}
                    onAltitudeFilter={handleAltitudeFilter}
                    onHoverFilter={setHoveredFilter}
                  />
                )}
                {activeTab === 'density' && (
                  <HowManyPanel
                    balloons={filteredBalloons}
                    onRegionClick={handleRegionClick}
                    onHoverFilter={setHoveredFilter}
                    showGrid={showGrid}
                    onToggleGrid={() => setShowGrid(!showGrid)}
                  />
                )}
              </TabPanel>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t px-8 py-4 text-center text-sm">
        <p className="mb-1">
          Data from <a href="https://windbornesystems.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">WindBorne Systems</a> &
          <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline"> OpenMeteo</a>
        </p>
        <p>Telemetry & Verification Dashboard</p>
      </footer>
    </div>
  );
}

export default App;
