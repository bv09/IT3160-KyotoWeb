import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Menu, MapPin, Navigation, Loader2, Trash2 } from 'lucide-react';
import { useRouting, useRoutingDispatch } from '@/context/RoutingContext';
import type { PathSegment } from '@/types';

export default function MobileSheet() {
  const { phase, origin, destination, loading, routeResult } = useRouting();
  const dispatch = useRoutingDispatch();
  const hasBoth = origin && destination;

  const handleFindRoute = () => {
    if (phase === 'selecting') {
      dispatch({ type: 'CLEAR' });
    } else {
      dispatch({ type: 'START_SELECTING' });
    }
  };

  const handleClear = () => {
    dispatch({ type: 'CLEAR' });
  };

  const isSelecting = phase === 'selecting';

  const stops = (routeResult?.path || []).filter(
    (s: PathSegment) => s.type === 'stop' || s.type === 'entrance'
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-[1100] md:hidden bg-white/90 backdrop-blur shadow-lg border-0 rounded-full w-12 h-12"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl p-0">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-800 tracking-wide uppercase mb-3">
              Find Your Route
            </h2>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border text-sm">
                <MapPin className={`w-4 h-4 shrink-0 ${origin ? 'text-kyoto-green' : 'text-gray-400'}`} />
                <span className={origin ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
                  {origin ? `${origin[0].toFixed(5)}, ${origin[1].toFixed(5)}` : 'Tap map for origin'}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border text-sm">
                <Navigation className={`w-4 h-4 shrink-0 ${destination ? 'text-kyoto-red' : 'text-gray-400'}`} />
                <span className={destination ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
                  {destination ? `${destination[0].toFixed(5)}, ${destination[1].toFixed(5)}` : 'Tap map for destination'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleFindRoute}
                disabled={loading}
                className={`flex-1 text-white text-sm font-medium ${
                  isSelecting ? 'bg-kyoto-red hover:bg-kyoto-red-muted' : 'bg-kyoto-green hover:bg-kyoto-green-hover'
                }`}
              >
                {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {isSelecting ? 'Cancel' : 'Find Route'}
              </Button>
              <Button
                onClick={handleClear}
                variant="ghost"
                size="icon"
                disabled={!hasBoth && !routeResult}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {routeResult && (
              <div className="flex justify-between text-sm mt-3 pt-3 border-t">
                <span className="text-gray-500">{(routeResult.distanceMeters / 1000).toFixed(2)} km</span>
                <span className="font-semibold">{formatTime(routeResult.estimateTime)}</span>
              </div>
            )}
          </div>

          {routeResult && stops.length > 0 && (
            <ScrollArea className="flex-1 px-4 py-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Journey Details</h3>
              <div className="relative pl-6 border-l-2 border-kyoto-indigo/20 space-y-3 py-1">
                {stops.map((seg: PathSegment, i: number) => (
                  <div key={i} className="relative">
                    <div
                      className={`absolute -left-[22px] w-[10px] h-[10px] rounded-full border-2 ${
                        i === 0
                          ? 'bg-kyoto-green border-kyoto-green'
                          : i === stops.length - 1
                          ? 'bg-kyoto-red border-kyoto-red'
                          : 'bg-kyoto-indigo border-kyoto-indigo'
                      }`}
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-gray-800">
                        {seg.name || (seg.type === 'entrance' ? 'Entrance' : 'Stop')}
                      </span>
                      {i === 0 && (
                        <span className="ml-1 text-[10px] text-kyoto-green font-medium">Start</span>
                      )}
                      {i === stops.length - 1 && (
                        <span className="ml-1 text-[10px] text-kyoto-red font-medium">End</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}
