import { useState, useEffect, useCallback } from 'react';
import BalloonMap from './components/BalloonMap';
import { TabPanel } from './components/common/TabPanel';
import { WherePanel } from './components/insights/WherePanel';
import { HowHighPanel } from './components/insights/HowHighPanel';
import { HowManyPanel } from './components/insights/HowManyPanel';
import { fetchAllBalloonData, processBalloonData } from './services/dataFetcher';
import { calculateRegionalDistribution, calculateAltitudeStats, detectClusters, calculateDensity } from './services/analytics';
import { CONFIG } from './config';

function App() {
  const [balloons, setBalloons] = useState([]);
  const [filteredBalloons, setFilteredBalloons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('where');
  const [altitudeFilter, setAltitudeFilter] = useState([0, 35000]);
  const [clusters, setClusters] = useState([]);
  const [denseRegions, setDenseRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [hoveredFilter, setHoveredFilter] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const [hoveredCluster, setHoveredCluster] = useState(null);
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
      console.log('Processed Balloons:', processed);
      setBalloons(processed);
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

  return (
    <div className="w-full min-h-screen m-0 p-0 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-6 flex-shrink-0">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">🎈 Weather Balloon Constellation</h1>
            <p className="text-sm opacity-95">Current positions of 1,000+ weather balloons with real-time atmospheric data</p>
          </div>
          
          {lastUpdate && (
            <div className="text-right">
              <span className="text-xs opacity-90 block mb-1">Last Updated:</span>
              <span className="text-lg font-semibold">{lastUpdate.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </header>

      {/* Stats Dashboard */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
            <div className="text-3xl font-bold text-indigo-600 mb-1">{stats.totalBalloons}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wider">Total Balloons</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
            <div className="text-3xl font-bold text-green-600 mb-1">{(stats.avgAltitude / 1000).toFixed(1)}km</div>
            <div className="text-xs text-gray-600 uppercase tracking-wider">Avg Altitude</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
            <div className="text-3xl font-bold text-blue-600 mb-1">{stats.northernHem}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wider">Northern Hem</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
            <div className="text-3xl font-bold text-purple-600 mb-1">{stats.southernHem}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wider">Southern Hem</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-20 px-8 text-center">
          <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mb-5"></div>
          <p className="text-lg text-gray-700 mb-2">Loading balloon constellation...</p>
          <p className="text-sm text-gray-500">Fetching current balloon positions</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="py-16 px-8 text-center">
          <h3 className="text-2xl text-red-600 font-semibold mb-4">⚠️ Error</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={loadBalloonData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content: Map (70%) + Insights Panel (30%) */}
      {!loading && !error && balloons.length > 0 && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Map Section - 70% */}
          <div className="w-full md:w-[70%] h-[500px] md:h-auto relative bg-gray-50">
            <BalloonMap 
              balloons={filteredBalloons}
              activeTab={activeTab}
              clusters={clusters}
              denseRegions={denseRegions}
              selectedRegion={selectedRegion}
              hoveredFilter={hoveredFilter}
              showGrid={showGrid}
              hoveredCluster={hoveredCluster}
            />
          </div>
          
          {/* Insights Panel - 30% */}
          <div className="w-full md:w-[30%] h-[600px] md:h-auto bg-white border-l border-gray-200 overflow-hidden">
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
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-center flex-shrink-0">
        <p className="text-sm text-gray-600 mb-2">
          Data from <a href="https://windbornesystems.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold hover:underline">WindBorne Systems</a> & 
          <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold hover:underline"> OpenMeteo</a>
        </p>
        <p className="text-xs text-gray-400">
          Interactive weather balloon tracking application
        </p>
      </footer>
    </div>
  );
}

export default App;
