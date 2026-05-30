import { memo } from 'react';
import { Tooltip } from 'react-leaflet';
import type { StationListItem } from '@/types';
import {
  getCalloutLevel,
  shortenStationName,
  isMajorStation,
  type CalloutLevel,
} from './stationCalloutUtils';

interface StationCalloutProps {
  station: StationListItem;
  zoom: number;
}

const StationCallout = memo(function StationCallout({ station, zoom }: StationCalloutProps) {
  const isMajor = isMajorStation(station.name);
  const level: CalloutLevel = getCalloutLevel(zoom, isMajor);

  if (level === 'hidden') return null;

  const isBlocked = station.isDisabled;
  const statusClass = isBlocked ? 'disabled' : 'enabled';
  const statusText = isBlocked ? 'Disabled' : 'Enabled';

  const className = [
    'station-callout',
    level === 'compact' && 'callout-compact',
    level === 'minimal' && 'callout-minimal',
    isBlocked && 'callout-disabled',
    isMajor && 'callout-major',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tooltip
      permanent
      direction="top"
      offset={[0, -12]}
      className={className}
      interactive={false}
    >
      <div className="callout-inner">
        <div className="callout-name-en">
          {level === 'minimal' ? shortenStationName(station.name) : station.name}
        </div>

        {level === 'full' && station.japaneseName && (
          <div className="callout-name-ja">{station.japaneseName}</div>
        )}

        {(level === 'full' || level === 'compact') && (
          <div className={`callout-status ${statusClass}`}>
            <span className="status-indicator" />
            <span>{statusText}</span>
          </div>
        )}
      </div>
    </Tooltip>
  );
});

export default StationCallout;
