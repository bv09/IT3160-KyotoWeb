import { motion } from 'framer-motion';
import type { RouteResult, PathSegment } from '@/types';

interface RouteTimelineProps {
  route: RouteResult;
}

interface TimelineEntry {
  type: 'start' | 'end' | 'station' | 'walk' | 'board' | 'transfer';
  name: string;
  lineName?: string;
  isSubway: boolean;
}

export default function RouteTimeline({ route }: RouteTimelineProps) {
  const entries = buildTimelineEntries(route.path);

  return (
    <div className="timeline-list">
      {entries.map((entry, i) => (
        <motion.div
          key={i}
          className="timeline-item"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04, duration: 0.25 }}
        >
          <div className={`timeline-dot ${entry.type}`} />
          <div className="timeline-content">
            {entry.type === 'start' && (
              <>
                <div className="timeline-label start-label">Start</div>
                <div className="station-name">{entry.name}</div>
              </>
            )}
            {entry.type === 'end' && (
              <>
                <div className="timeline-label end-label">Arrival</div>
                <div className="station-name">{entry.name}</div>
              </>
            )}
            {entry.type === 'station' && (
              <>
                <div className="station-name">{entry.name}</div>
                {entry.lineName && (
                  <span className="line-badge subway">{entry.lineName}</span>
                )}
              </>
            )}
            {entry.type === 'walk' && (
              <>
                <span className="line-badge walk">🚶 Walk</span>
                <div className="segment-info">{entry.name}</div>
              </>
            )}
            {entry.type === 'board' && (
              <>
                <div className="station-name">{entry.name}</div>
                {entry.lineName && (
                  <span className="line-badge subway">🚇 Board {entry.lineName}</span>
                )}
              </>
            )}
            {entry.type === 'transfer' && (
              <>
                <div className="station-name">{entry.name}</div>
                <span className="line-badge subway">🔄 Transfer</span>
                {entry.lineName && (
                  <div className="segment-info">→ {entry.lineName}</div>
                )}
              </>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function buildTimelineEntries(path: PathSegment[]): TimelineEntry[] {
  if (path.length === 0) return [];

  const entries: TimelineEntry[] = [];
  let currentLine: string | null = null;
  let isFirstStop = true;

  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    const isFirst = i === 0;
    const isLast = i === path.length - 1;

    // Endpoint (start/end of path from clicked point, not a station)
    if (seg.type === 'endpoint') {
      if (isFirst) {
        entries.push({
          type: 'start',
          name: seg.name || 'Starting Point',
          isSubway: false,
        });
      } else if (isLast) {
        entries.push({
          type: 'end',
          name: seg.name || 'Destination',
          isSubway: false,
        });
      }
      continue;
    }

    // Stop/station
    if (seg.type === 'stop') {
      const lineName = seg.wayName || undefined;

      if (isFirst || (isFirstStop && entries.length === 0)) {
        entries.push({
          type: 'start',
          name: seg.name || 'Station',
          lineName,
          isSubway: seg.isSubway,
        });
        currentLine = seg.wayName;
        isFirstStop = false;
      } else if (isLast) {
        entries.push({
          type: 'end',
          name: seg.name || 'Station',
          lineName,
          isSubway: seg.isSubway,
        });
      } else if (seg.wayName && seg.wayName !== currentLine && currentLine !== null) {
        // Transfer to a different line
        entries.push({
          type: 'transfer',
          name: seg.name || 'Transfer Station',
          lineName: seg.wayName,
          isSubway: seg.isSubway,
        });
        currentLine = seg.wayName;
      } else {
        entries.push({
          type: 'station',
          name: seg.name || 'Station',
          lineName,
          isSubway: seg.isSubway,
        });
        if (seg.wayName) currentLine = seg.wayName;
        isFirstStop = false;
      }
      continue;
    }

    // Entrance
    if (seg.type === 'entrance') {
      // Skip entrance nodes to reduce clutter, they're usually near stops
      continue;
    }

    // Regular node — check for walking segment transitions
    if (seg.type === 'node') {
      // Walk segments are non-subway nodes
      if (!seg.isSubway && i > 0 && path[i - 1].isSubway) {
        // Transition from subway to walk — note it
        entries.push({
          type: 'walk',
          name: 'Walking transfer',
          isSubway: false,
        });
      } else if (seg.isSubway && i > 0 && !path[i - 1].isSubway && path[i - 1].type === 'node') {
        // Transition from walk to subway
        if (seg.wayName && seg.wayName !== currentLine) {
          entries.push({
            type: 'board',
            name: seg.wayName || 'Subway',
            lineName: seg.wayName,
            isSubway: true,
          });
          currentLine = seg.wayName;
        }
      }
    }
  }

  // Ensure we have at least start and end
  if (entries.length >= 2) {
    if (entries[0].type !== 'start') {
      entries[0] = { ...entries[0], type: 'start' };
    }
    if (entries[entries.length - 1].type !== 'end') {
      entries[entries.length - 1] = { ...entries[entries.length - 1], type: 'end' };
    }
  }

  return entries;
}
