/**
 * Map utility functions — bounds fitting, icon creation, style helpers.
 */

import L from "leaflet";
import type { Leg, LatLng, StationData } from "../core/types";

/** Fit the map viewport to contain all legs of a route result */
export function fitMapToRoute(map: L.Map, legs: Leg[]): void {
  const allCoords: L.LatLngExpression[] = [];
  for (const leg of legs) {
    for (const [lat, lon] of leg.geometry) {
      allCoords.push([lat, lon]);
    }
  }
  if (allCoords.length > 0) {
    const bounds = L.latLngBounds(allCoords);
    map.fitBounds(bounds, { padding: [60, 280], maxZoom: 16 });
  }
}

/** Fit map to show two points (origin + destination) */
export function fitMapToPoints(map: L.Map, from: LatLng, to: LatLng): void {
  const bounds = L.latLngBounds([from, to]);
  map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
}

/** Generate Leaflet polyline options for a given leg */
export function createRouteStyle(leg: Leg): L.PolylineOptions {
  if (leg.type === "walk") {
    return {
      color: "#94a3b8",
      weight: 3,
      opacity: 0.7,
      dashArray: "8, 6",
      pane: "routePane",
    };
  }

  const colour = leg.route_colour || "#4f46e5";
  return {
    color: colour,
    weight: 6,
    opacity: 0.9,
    pane: "routePane",
  };
}

/** Glow effect: wider, semi-transparent polyline under the route */
export function createRouteGlowStyle(leg: Leg): L.PolylineOptions | null {
  if (leg.type === "walk") return null;
  const colour = leg.route_colour || "#4f46e5";
  return {
    color: colour,
    weight: 12,
    opacity: 0.2,
    pane: "routePane",
  };
}

/** Create a divIcon HTML string for station markers */
export function createStationIconHtml(
  station: StationData,
  isOnRoute: boolean = false,
): string {
  const size = isOnRoute ? 14 : 9;
  const fill = station.isBlocked
    ? "#555"
    : isOnRoute
      ? "#4f46e5"
      : station.type === "entrance"
        ? "#7c3aed"
        : "#ef4444";
  const border = station.isBlocked ? "#444" : "#fff";
  const opacity = station.isBlocked ? 0.5 : 1;

  return `<div style="
    width:${size * 2}px;height:${size * 2}px;
    background:${fill};border:2px solid ${border};
    border-radius:50%;opacity:${opacity};
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
  "></div>`;
}

/** Create a Leaflet divIcon for a station */
export function createStationIcon(
  station: StationData,
  isOnRoute: boolean = false,
): L.DivIcon {
  const size = isOnRoute ? 14 : 9;
  return L.divIcon({
    html: createStationIconHtml(station, isOnRoute),
    className: "",
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
  });
}

/** Origin marker icon */
export function createOriginIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:16px;height:16px;
      background:#059669;border:3px solid #fff;
      border-radius:50%;
      box-shadow:0 3px 10px rgba(5,150,105,0.6);
    "></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Destination marker icon */
export function createDestIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:16px;height:16px;
      background:#dc2626;border:3px solid #fff;
      border-radius:50%;
      box-shadow:0 3px 10px rgba(220,38,38,0.6);
    "></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}