import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import BalloonMap from './components/BalloonMap';
import Sidebar from './components/Sidebar';
import TimeScrubber from './components/TimeScrubber';
import { TabPanel } from './components/common/TabPanel';
import { WherePanel } from './components/insights/WherePanel';
import { HowHighPanel } from './components/insights/HowHighPanel';
import { HowManyPanel } from './components/insights/HowManyPanel';
import { fetchAllBalloonData, processBalloonData } from './services/dataFetcher';
import { 
  calculateRegionalDistribution, 
  calculateAltitudeStats, 
  detectClusters, 
  calculateDensity,
  calculateSpeedLeaderboard,
  detectEddies,
  calculateConvergence,
  detectTurbulence,
  detectShearLayers
} from './services/analytics';
import { processConstellationHistory } from './utils/trajectoryEngine';
import { CONFIG } from './config';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';

function App() {
  // Data states
  const [balloons, setBalloons] = useState([]);
  const [tracks, setTracks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  const selectedHourRef = useRef(23.0); // Ref for smooth animation (no re-renders) - starts at hour 23
  const [selectedHour, setSelectedHour] = useState(23.0); // State for UI display only
  const [activeViewTab, setActiveViewTab] = useState('flow'); // 'flow' or 'analysis'
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayInitiated, setAutoplayInitiated] = useState(false); // Track if autoplay has started for current flow session

  const [stats, setStats] = useState({
    totalBalloons: 0,
    hoursWithData: 0,
    avgAltitude: 0
  });

  // Advanced features state
  const [advancedFeatures, setAdvancedFeatures] = useState({
    speedLeaderboard: [],
    convergence: [],
    shearLayers: []
  });

  // View tabs for flow/analysis modes
  const viewTabs = [
    { id: 'flow', label: 'FLOW' },
    { id: 'analysis', label: 'ANALYSIS' }
  ];

  const tabs = [
    { id: 'where', label: 'WHERE' },
    { id: 'altitude', label: 'HOW HIGH' },
    { id: 'density', label: 'HOW MANY' }
  ];

  // Derived view mode for backward compatibility
  const viewMode = activeViewTab === 'flow' ? 'flow' : 'static';

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
      setBalloons(processed);
      setTracks(trajectoryTracks);
      
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

      setLoading(false);
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Use timeout to avoid synchronous setState in effect
    const timer = setTimeout(() => {
      loadBalloonData();
    }, 0);

    // Set up auto-refresh
    const interval = setInterval(() => {
      loadBalloonData();
    }, CONFIG.REFRESH_INTERVAL);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadBalloonData]);
  
  // Apply altitude filter and balloon selection filter (derived state)
  // In ANALYSIS mode, use historical positions based on selectedHour
  const filteredBalloons = useMemo(() => {
    let filtered = balloons.map(b => {
      // In ANALYSIS mode, use position from selectedHour
      if (viewMode === 'static' && tracks[b.id]) {
        const track = tracks[b.id];
        const hourPos = track.find(p => p.hourIndex === Math.round(selectedHour));
        if (hourPos) {
          return {
            ...b,
            currentPosition: {
              lat: hourPos.lat,
              lon: hourPos.lon,
              alt: hourPos.alt,
              hour: hourPos.hourIndex,
              id: hourPos.id
            }
          };
        }
      }
      return b; // Fallback to current position
    }).filter(b => {
      const alt = b.currentPosition.alt;
      return alt >= altitudeFilter[0] && alt <= altitudeFilter[1];
    });

    return filtered;
  }, [balloons, tracks, selectedHour, viewMode, altitudeFilter]);

  // Recalculate clusters and dense regions based on selectedHour in ANALYSIS mode
  const dynamicClusters = useMemo(() => {
    if (viewMode === 'static') {
      return detectClusters(filteredBalloons);
    }
    return clusters; // Use initial clusters in FLOW mode
  }, [viewMode, filteredBalloons, clusters]);

  const dynamicDenseRegions = useMemo(() => {
    if (viewMode === 'static') {
      const densityGrid = calculateDensity(filteredBalloons);
      return densityGrid.sort((a, b) => b.count - a.count).slice(0, 10);
    }
    return denseRegions; // Use initial regions in FLOW mode
  }, [viewMode, filteredBalloons, denseRegions]);
  
  const handleAltitudeFilter = (range) => {
    setAltitudeFilter(range);
  };
  
  const handleRegionClick = (region) => {
    setSelectedRegion(region);
    // Clear selection after 5 seconds
    setTimeout(() => setSelectedRegion(null), 5000);
  };
  
  const handleWhereRegionClick = () => {
    // Could implement region filtering here
  };

  // Time animation effect - ref-based for smooth animation without React re-renders
  // State updates every frame for UI display, but animation reads from ref for smoothness
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      // Update ref (no re-render, used by animation loop!)
      selectedHourRef.current -= 1/60; // 1/60 hour = 1 minute steps
      if (selectedHourRef.current < 0) {
        selectedHourRef.current = 0;
        setIsPlaying(false);
      }

      // Update React state every frame for UI display (TimeScrubber)
      // This won't cause animation jerkiness because SmoothMarker reads from ref
      setSelectedHour(Math.round(selectedHourRef.current * 100000) / 100000);
    }, 100); // 100ms = 10 updates per second

    return () => clearInterval(interval);
  }, [isPlaying]);
  
  // Sync ref with state when user manually changes time
  useEffect(() => {
    selectedHourRef.current = selectedHour;
  }, [selectedHour]);

  // Autoplay disabled - users must manually press play to start animation
  // useEffect(() => {
  //   if (viewMode === 'flow' && !isPlaying && !autoplayInitiated) {
  //     // Use timeout to avoid synchronous setState in effect
  //     const timer = setTimeout(() => {
  //       setIsPlaying(true);
  //       setAutoplayInitiated(true);
  //     }, 100);
  //     return () => clearTimeout(timer);
  //   }
  // }, [viewMode, isPlaying, autoplayInitiated]);

  const handleBalloonClick = (track) => {
    setSelectedTrack(track);
    setActiveViewTab('flow'); // Switch to flow view when balloon is selected
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Navigation handlers for time control
  const handlePrevHour = () => {
    setIsPlaying(false); // Pause autoplay when user manually controls time
    setSelectedHour(prev => Math.min(23, prev + 1)); // Go back in time (increase hour index)
  };

  const handleNextHour = () => {
    setIsPlaying(false); // Pause autoplay when user manually controls time
    setSelectedHour(prev => Math.max(0, prev - 1)); // Go forward in time (decrease hour index)
  };

  // Handle view tab changes with autoplay reset logic
  const handleViewTabChange = (tab) => {
    setActiveViewTab(tab);
    if (tab === 'analysis') {
      setSelectedTrack(null); // Clear selected balloon when switching to analysis
      setAutoplayInitiated(false); // Reset for next flow view
      setIsPlaying(false); // Stop animation
      setSelectedHour(23.0); // Reset to hour 23 for analysis mode
      selectedHourRef.current = 23.0;
    } else if (tab === 'flow') {
      setAutoplayInitiated(false); // Allow autoplay to start for new flow session
      setSelectedHour(23.0); // Reset to hour 23 for flow mode
      selectedHourRef.current = 23.0;
    }
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
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onPrevHour={handlePrevHour}
              onNextHour={handleNextHour}
              onClearSelection={() => setSelectedTrack(null)}
              viewMode={viewMode}
            />

            {/* View Tabs */}
            <div className="shrink-0">
              <TabPanel
                tabs={viewTabs}
                activeTab={activeViewTab}
                onChange={handleViewTabChange}
                size="sm"
              />
            </div>

            {/* Stats (With Proper Labels) */}
            <div className="flex items-center gap-4 text-sm shrink-0">
              <span>{stats.totalBalloons} Balloons</span>
              <span>{(stats.avgAltitude / 1000).toFixed(1)}km Avg Alt</span>
              <span>{stats.hoursWithData}h Data</span>
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
              clusters={dynamicClusters}
              denseRegions={dynamicDenseRegions}
              selectedRegion={selectedRegion}
              hoveredFilter={hoveredFilter}
              showGrid={showGrid}
              hoveredCluster={hoveredCluster}
              selectedTrack={selectedTrack}
              selectedHour={selectedHour}
              selectedHourRef={selectedHourRef}
            />
          </div>

          {/* Sidebar Section */}
          <div className="w-[400px] border-l flex flex-col overflow-hidden">
            {selectedTrack ? (
              <Sidebar
                selectedTrack={selectedTrack}
                selectedHour={selectedHour}
                tracks={tracks}
                allBalloons={filteredBalloons}
                onClearSelection={() => setSelectedTrack(null)}
              />
            ) : viewMode === 'flow' ? (
              <div className="flex flex-col h-full items-center justify-center p-6">
                <div className="text-center space-y-4">
                  <div className="text-6xl">🎈</div>
                  <h3 className="text-lg font-semibold">Flow View Mode</h3>
                  <p className="text-sm">Click on any balloon marker to view:</p>
                  <ul className="text-sm text-left space-y-2 max-w-[280px] mx-auto">
                    <li>• 24-hour flight trajectory</li>
                    <li>• Altitude profile over time</li>
                    <li>• Actual vs model speed comparison</li>
                    <li>• Drift analysis & deviations</li>
                  </ul>
                </div>
              </div>
            ) : (
              <TabPanel
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
              >
                {activeTab === 'where' && (
                  <WherePanel
                    balloons={filteredBalloons}
                    clusters={dynamicClusters}
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
