// ── Major station names for priority labeling ──
const MAJOR_STATIONS = new Set([
  'Kyoto', 'Kyōto', 'Kyoto Station',
  'Nijo', 'Nijō', 'Nijo Station',
  'Arashiyama', 'Arashiyama Station',
  'Gion-Shijo', 'Gion-Shijō', 'Gion-Shijo Station',
  'Karasuma', 'Karasuma Oike', 'Karasuma Station',
  'Sanjo', 'Sanjō', 'Sanjo Keihan',
  'Fushimi Inari', 'Fushimi-Inari',
  'Uzumasa Tenjingawa', 'Uzumasa-Tenjingawa',
  'Takeda', 'Kitaoji', 'Kitaōji',
  'Rokujizo', 'Rokujizō',
  'Ono', 'Daigo',
  'Yamashina',
  'Kuinabashi',
  'Toji', 'Tōji',
  'Shijo', 'Shijō',
  'Karasuma Oike',
  'Imadegawa',
  'Marutamachi',
  'Kokusaikaikan',
]);

export function isMajorStation(name: string): boolean {
  if (MAJOR_STATIONS.has(name)) return true;
  for (const major of MAJOR_STATIONS) {
    if (name.includes(major) || major.includes(name)) return true;
  }
  return false;
}

// ── Zoom-aware callout level ──
export type CalloutLevel = 'full' | 'compact' | 'minimal' | 'hidden';

export function getCalloutLevel(zoom: number, isMajor: boolean): CalloutLevel {
  if (zoom >= 15) return 'full';
  if (zoom >= 14) return isMajor ? 'full' : 'compact';
  if (zoom >= 13) return isMajor ? 'compact' : 'minimal';
  if (zoom >= 12) return isMajor ? 'minimal' : 'hidden';
  return 'hidden';
}

export function shortenStationName(nameEn: string): string {
  return nameEn.length > 12 ? nameEn.split(/[\s\-]/)[0] : nameEn;
}
