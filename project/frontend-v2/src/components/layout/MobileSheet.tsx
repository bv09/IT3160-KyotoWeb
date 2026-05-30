import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Train } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import RouteSearch from '@/components/route/RouteSearch';
import StationManager from '@/components/station/StationManager';
import type { AppMode } from '@/types';

export default function MobileSheet() {
  const { mode, setMode } = useApp();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-[1100] md:hidden bg-white/95 backdrop-blur-sm shadow-lg border-0 rounded-full w-12 h-12"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0">
        <div className="flex flex-col h-full">
          {/* Mobile header */}
          <div className="px-4 pt-3 pb-2 border-b">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
            <div className="flex items-center gap-2 mb-3">
              <Train className="w-4 h-4 text-indigo-600" />
              <span className="font-semibold text-sm">Kyoto Transit</span>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  mode === 'route-search'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500'
                }`}
                onClick={() => setMode('route-search')}
              >
                Find Path
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  mode === 'station-management'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500'
                }`}
                onClick={() => setMode('station-management')}
              >
                Stations
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {mode === 'route-search' ? <RouteSearch /> : <StationManager />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
