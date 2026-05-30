import { useApp } from '@/context/AppContext';
import { Train } from 'lucide-react';
import RouteSearch from '@/components/route/RouteSearch';
import StationManager from '@/components/station/StationManager';

export default function Sidebar() {
  const { mode, setMode } = useApp();

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Train className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <div className="app-title">Kyoto Transit</div>
            <div className="app-subtitle">京都交通</div>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="mode-switcher">
        <button
          className={`mode-btn ${mode === 'route-search' ? 'active' : ''}`}
          onClick={() => setMode('route-search')}
        >
          Find Shortest Path
        </button>
        <button
          className={`mode-btn ${mode === 'station-management' ? 'active' : ''}`}
          onClick={() => setMode('station-management')}
        >
          Disable / Enable Station
        </button>
      </div>

      {/* Content */}
      <div className="sidebar-content">
        {mode === 'route-search' ? <RouteSearch /> : <StationManager />}
      </div>
    </aside>
  );
}
