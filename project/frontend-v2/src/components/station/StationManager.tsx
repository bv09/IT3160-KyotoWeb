import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';

export default function StationManager() {
  const { stations, disabledStations, toggleStation, resetAllStations, showGraph, setShowGraph } =
    useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const disabledCount = disabledStations.size;

  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stations;
    const q = searchQuery.toLowerCase();
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.japaneseName.includes(searchQuery)
    );
  }, [stations, searchQuery]);

  return (
    <div className="station-manager">
      <p className="description">
        Click a station on the map or use the list below to disable or enable stations. Disabled
        stations will be excluded from route calculations.
      </p>

      {/* Graph toggle */}
      <button
        className={`graph-toggle ${showGraph ? 'active' : ''}`}
        onClick={() => setShowGraph(!showGraph)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        {showGraph ? 'Hide Network Graph' : 'Show Network Graph'}
      </button>

      {/* Disabled count + reset */}
      {disabledCount > 0 && (
        <motion.div
          className="disabled-summary"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="count">
            {disabledCount} station{disabledCount !== 1 ? 's' : ''} disabled
          </span>
          <button className="reset-btn" onClick={resetAllStations}>
            Reset All
          </button>
        </motion.div>
      )}

      {/* Search */}
      <div className="station-search">
        <Search className="search-icon" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search station..."
          autoComplete="off"
        />
      </div>

      {/* Station list */}
      <div className="station-list">
        <AnimatePresence>
          {filteredStations.map((station) => {
            const isDisabled = disabledStations.has(station.id);
            return (
              <motion.div
                key={station.id}
                className="station-row"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                layout
              >
                <div className={`status-dot ${isDisabled ? 'disabled' : 'enabled'}`} />
                <div className="station-details">
                  <div className="name">{station.name}</div>
                  {station.japaneseName && (
                    <div className="japanese">{station.japaneseName}</div>
                  )}
                </div>
                <span className={`station-status ${isDisabled ? 'disabled' : 'enabled'}`}>
                  {isDisabled ? 'Disabled' : 'Enabled'}
                </span>
                <Switch
                  checked={!isDisabled}
                  onCheckedChange={() => toggleStation(station.id)}
                  size="sm"
                />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredStations.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No stations found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}