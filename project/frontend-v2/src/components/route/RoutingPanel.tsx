import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Trash2, Loader2 } from 'lucide-react';
import { useRouting, useRoutingDispatch } from '@/context/RoutingContext';

export default function RoutingPanel() {
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

  return (
    <Card className="hidden md:flex absolute top-16 left-3 w-[320px] bg-white/95 backdrop-blur-sm shadow-xl border-0 z-[1000] p-4 flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-800 tracking-wide uppercase">
        Find Your Route
      </h2>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-sm">
          <MapPin className={`w-4 h-4 shrink-0 ${origin ? 'text-kyoto-green' : 'text-gray-400'}`} />
          <span className={origin ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
            {origin ? `${origin[0].toFixed(5)}, ${origin[1].toFixed(5)}` : 'Click map for origin'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-sm">
          <Navigation className={`w-4 h-4 shrink-0 ${destination ? 'text-kyoto-red' : 'text-gray-400'}`} />
          <span className={destination ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
            {destination ? `${destination[0].toFixed(5)}, ${destination[1].toFixed(5)}` : 'Click map for destination'}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleFindRoute}
          disabled={loading}
          className={`flex-1 text-white text-sm font-medium ${
            isSelecting
              ? 'bg-kyoto-red hover:bg-kyoto-red-muted'
              : 'bg-kyoto-green hover:bg-kyoto-green-hover'
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
          title="Clear"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {routeResult && (
        <div className="border-t pt-2 mt-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Distance</span>
            <span className="font-semibold text-gray-800">
              {(routeResult.distanceMeters / 1000).toFixed(2)} km
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">Est. Time</span>
            <span className="font-semibold text-gray-800">
              {formatTime(routeResult.estimateTime)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}
