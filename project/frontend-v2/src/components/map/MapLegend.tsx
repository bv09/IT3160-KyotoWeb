import { useApp } from '@/context/AppContext';

export default function MapLegend() {
  const { shortestDistanceRoute, fastestTravelTimeRoute } = useApp();

  // Only show legend when routes are displayed
  const hasRoutes = shortestDistanceRoute || fastestTravelTimeRoute;

  return (
    <div className="map-legend">
      <div className="legend-title">Map Legend</div>

      {hasRoutes && (
        <>
          {shortestDistanceRoute && (
            <div className="legend-item">
              <div className="legend-line" style={{ background: '#3b82f6' }} />
              <span>Shortest Distance</span>
            </div>
          )}
          {fastestTravelTimeRoute && (
            <div className="legend-item">
              <div
                className="legend-line"
                style={{
                  background: 'repeating-linear-gradient(90deg, #10b981 0px, #10b981 6px, transparent 6px, transparent 10px)',
                }}
              />
              <span>Fastest Time</span>
            </div>
          )}
        </>
      )}

      <div className="legend-item">
        <div
          className="legend-dot"
          style={{ borderColor: '#3b82f6', background: '#ffffff' }}
        />
        <span>Station (Enabled)</span>
      </div>

      <div className="legend-item">
        <div
          className="legend-dot"
          style={{ borderColor: '#9ca3af', background: '#d1d5db', opacity: 0.6 }}
        />
        <span>Station (Disabled)</span>
      </div>

      <div className="legend-item">
        <div
          className="legend-dot"
          style={{ borderColor: '#059669', background: '#059669' }}
        />
        <span>Origin</span>
      </div>

      <div className="legend-item">
        <div
          className="legend-dot"
          style={{ borderColor: '#dc2626', background: '#dc2626' }}
        />
        <span>Destination</span>
      </div>
    </div>
  );
}
