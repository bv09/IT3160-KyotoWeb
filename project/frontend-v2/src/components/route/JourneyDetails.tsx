import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouting } from '@/context/RoutingContext';
import type { PathSegment } from '@/types';

export default function JourneyDetails() {
  const { routeResult } = useRouting();

  if (!routeResult) return null;

  const stops = routeResult.path.filter(
    (s) => s.type === 'stop' || s.type === 'entrance'
  );

  return (
    <Card className="hidden md:flex absolute top-16 right-3 w-[320px] bg-white/95 backdrop-blur-sm shadow-xl border-0 z-[1000] p-4 flex-col gap-3 max-h-[calc(100vh-5rem)]">
      <h2 className="text-sm font-semibold text-gray-800 tracking-wide uppercase">
        Journey Details
      </h2>

      <div className="flex justify-between text-sm">
        <div>
          <span className="text-gray-500">Distance: </span>
          <span className="font-semibold">{(routeResult.distanceMeters / 1000).toFixed(2)} km</span>
        </div>
        <div>
          <span className="text-gray-500">Time: </span>
          <span className="font-semibold">{formatTime(routeResult.estimateTime)}</span>
        </div>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="relative pl-6 border-l-2 border-kyoto-indigo/20 space-y-4 py-1">
          {stops.map((seg, i) => (
            <TimelineItem
              key={i}
              segment={seg}
              index={i}
              total={stops.length}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

function TimelineItem({
  segment,
  index,
  total,
}: {
  segment: PathSegment;
  index: number;
  total: number;
}) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const isStop = segment.type === 'stop';
  const isEntrance = segment.type === 'entrance';

  return (
    <div className="relative">
      <div
        className={`absolute -left-[22px] w-[10px] h-[10px] rounded-full border-2 ${
          isFirst
            ? 'bg-kyoto-green border-kyoto-green'
            : isLast
            ? 'bg-kyoto-red border-kyoto-red'
            : isStop
            ? 'bg-kyoto-indigo border-kyoto-indigo'
            : 'bg-gray-400 border-gray-400'
        }`}
      />
      <div className="text-xs">
        <span className="font-semibold text-gray-800">
          {segment.name || (isEntrance ? 'Entrance' : 'Stop')}
        </span>
        {isFirst && (
          <span className="ml-1 text-[10px] text-kyoto-green font-medium uppercase">Start</span>
        )}
        {isLast && (
          <span className="ml-1 text-[10px] text-kyoto-red font-medium uppercase">End</span>
        )}
        {(isStop || isEntrance) && !isFirst && !isLast && (
          <span className="ml-2 text-[10px] text-gray-400 uppercase">
            {isStop ? 'Station' : 'Entrance'}
          </span>
        )}
      </div>
    </div>
  );
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}
