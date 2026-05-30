import { useState } from 'react';
import { ChevronDown, ArrowRight, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RouteResult } from '@/types';
import RouteTimeline from './RouteTimeline';

interface RouteCardProps {
  route: RouteResult;
  type: 'shortest' | 'fastest';
}

export default function RouteCard({ route, type }: RouteCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isShort = type === 'shortest';
  const label = isShort ? 'Shortest Distance' : 'Fastest Travel Time';

  const distanceKm = ((route.distanceMeters ?? 0) / 1000).toFixed(1);
  const timeFormatted = formatTime(route.estimateTimeMinutes);

  const primaryMetric = isShort ? `${distanceKm} km` : timeFormatted;
  const secondaryMetric = isShort ? timeFormatted : `${distanceKm} km`;

  return (
    <div className={`route-card ${type}`}>
      <div className="route-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="route-card-label">
          <span className="label-text">{label}</span>
          <ChevronDown className={`chevron ${expanded ? 'open' : ''}`} />
        </div>

        <div className="route-card-metrics">
          <span className="primary-metric">{primaryMetric}</span>
          <span className="secondary-metric">{secondaryMetric}</span>
        </div>

        <div className="route-card-meta">
          <div className="meta-item">
            <ArrowRight />
            <span>via {route.mainLine}</span>
          </div>
          <div className="meta-divider" />
          <div className="meta-item">
            <Repeat />
            <span>{route.transfers} Transfer{route.transfers !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="route-timeline">
              <RouteTimeline route={route} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatTime(minutes: number | null | undefined): string {
  const safe = typeof minutes === 'number' && Number.isFinite(minutes) ? minutes : 0;
  if (safe < 1) return '< 1 min';
  const h = Math.floor(safe / 60);
  const m = Math.round(safe % 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + ' min';
}
