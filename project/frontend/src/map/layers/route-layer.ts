/**
 * Route layer — renders multi-modal routing results on the map.
 * Replaces the drawPath() logic from project/frontend/js/pathfinder.js.
 */

import L from "leaflet";
import { store } from "../../core/state";
import {
  createRouteStyle,
  createRouteGlowStyle,
  createStationIcon,
  createOriginIcon,
  createDestIcon,
  fitMapToRoute,
} from "../utils";
import type { Leg, RouteResult, StationData } from "../../core/types";

let routeGroup: L.FeatureGroup | null = null;
let originMarker: L.Marker | null = null;
let destMarker: L.Marker | null = null;
/** Store polyline references for hover highlighting */
const legPolylines: L.Polyline[] = [];

/**
 * Render a routing result on the map.
 */
export function renderRoute(map: L.Map, result: RouteResult): void {
  clearRoute(map);

  routeGroup = L.featureGroup();
  legPolylines.length = 0;

  const legs = result.legs;
  if (legs.length === 0) return;

  // Origin marker (first leg's from point)
  const firstPoint = legs[0].from;
  if (firstPoint.lat && firstPoint.lon) {
    originMarker = L.marker([firstPoint.lat, firstPoint.lon], {
      icon: createOriginIcon(),
    })
      .bindPopup(`<b>Origin</b><br>${firstPoint.name || ""}`)
      .addTo(routeGroup);
  }

  // Destination marker (last leg's to point)
  const lastLeg = legs[legs.length - 1];
  const lastPoint = lastLeg.to;
  if (lastPoint.lat && lastPoint.lon) {
    destMarker = L.marker([lastPoint.lat, lastPoint.lon], {
      icon: createDestIcon(),
    })
      .bindPopup(`<b>Destination</b><br>${lastPoint.name || ""}`)
      .addTo(routeGroup);
  }

  // Render each leg
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const coords: L.LatLngExpression[] = leg.geometry.map(([lat, lon]) => [lat, lon]);

    if (coords.length < 2) continue;

    // Glow effect for transit legs
    const glowStyle = createRouteGlowStyle(leg);
    if (glowStyle) {
      L.polyline(coords, { ...glowStyle, interactive: false }).addTo(routeGroup);
    }

    // Main polyline
    const style = createRouteStyle(leg);
    const poly = L.polyline(coords, { ...style, interactive: true }).addTo(routeGroup);
    legPolylines.push(poly);

    // Popup with leg info
    if (leg.type === "transit") {
      const mins = Math.round(leg.time_s / 60);
      poly.bindPopup(`
        <b>${leg.route_ref || "?"} ${leg.route_name || "Transit"}</b><br>
        ${leg.from.name} → ${leg.to.name}<br>
        <small>${mins} min · ${(leg.distance_m / 1000).toFixed(1)} km</small>
      `);
    } else {
      const mins = Math.round(leg.time_s / 60);
      poly.bindPopup(`
        <b>Walking</b><br>
        <small>${mins} min · ${(leg.distance_m / 1000).toFixed(1)} km</small>
      `);
    }

    // Station markers at leg boundaries (transit stops)
    if (leg.type === "transit") {
      for (const point of [leg.from, leg.to]) {
        if (point.lat && point.lon) {
          const station: StationData = {
            id: 0,
            lat: point.lat,
            lon: point.lon,
            name: point.name || "",
            type: "stop_position",
            isBlocked: false,
          };
          L.marker([point.lat, point.lon], {
            icon: createStationIcon(station, true),
            interactive: true,
          })
            .bindPopup(`<b>${point.name || "Stop"}</b>`)
            .addTo(routeGroup);
        }
      }
    }
  }

  routeGroup.addTo(map);
  fitMapToRoute(map, legs);
}

/** Highlight a specific leg polyline on hover */
export function highlightLeg(index: number): void {
  legPolylines.forEach((poly, i) => {
    if (i === index) {
      poly.setStyle({ weight: 8, opacity: 1 });
    } else {
      poly.setStyle({ opacity: 0.4 });
    }
  });
}

/** Reset all leg highlights */
export function resetLegHighlights(): void {
  legPolylines.forEach((poly) => {
    poly.setStyle({ weight: 6, opacity: 0.9 });
  });
}

/** Clear all route elements from the map */
export function clearRoute(map: L.Map): void {
  if (routeGroup) {
    map.removeLayer(routeGroup);
    routeGroup = null;
  }
  if (originMarker) {
    map.removeLayer(originMarker);
    originMarker = null;
  }
  if (destMarker) {
    map.removeLayer(destMarker);
    destMarker = null;
  }
  legPolylines.length = 0;
}