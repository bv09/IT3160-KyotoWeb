/**
 * App-wide configuration constants.
 */

export const MAP_CENTER: [number, number] = [35.0116, 135.7681];
export const MAP_ZOOM = 13;
export const MAP_MAX_ZOOM = 19;
export const MAP_MIN_ZOOM = 10;

export const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_ATTRIBUTION = "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors";

export const DEFAULT_ALGORITHM = "transfer_aware" as const;
export const DEFAULT_WALKING_SPEED_KMH = 5;
export const MIN_SEARCH_CHARS = 2;
export const SEARCH_DEBOUNCE_MS = 300;

/** Route colors from Kyoto subway lines — fallback when backend doesn't provide colour */
export const KYOTO_LINE_COLORS: Record<string, string> = {
  Karasuma: "#1E90A0",
  Tozai: "#D94B38",
};