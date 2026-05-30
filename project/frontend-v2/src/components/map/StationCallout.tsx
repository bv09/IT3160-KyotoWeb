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

  const className = [
    'station-callout',
    level === 'compact' && 'callout-compact',
    level === 'minimal' && 'callout-minimal',
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

        {station.japaneseName && (
          <div className="callout-name-ja">{station.japaneseName}</div>
        )}
      </div>
    </Tooltip>
  );
});

export default StationCallout;
