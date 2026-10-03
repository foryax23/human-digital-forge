import { isLand } from "./land-mask";

/** [latitude, longitude] in degrees. */
export type LatLon = readonly [number, number];

/** Geographic centre of Romania, used when the company's city is unknown. */
export const ROMANIA_CENTRE: LatLon = [45.94, 24.97];

/**
 * Romania's border, simplified to ~40 points ([lon, lat]); only used to tint
 * the globe's dots, so a few kilometres of error don't matter.
 */
const ROMANIA_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [22.89, 47.95],
  [23.5, 47.98],
  [24.0, 47.95],
  [24.9, 47.73],
  [25.9, 47.97],
  [26.62, 48.26],
  [27.2, 47.83],
  [27.8, 47.3],
  [28.2, 46.9],
  [28.1, 46.4],
  [28.15, 45.9],
  [28.2, 45.47],
  [28.7, 45.25],
  [29.7, 45.2],
  [29.62, 44.82],
  [28.95, 44.6],
  [28.65, 44.2],
  [28.58, 43.74],
  [28.0, 43.75],
  [27.26, 44.12],
  [26.1, 43.95],
  [25.37, 43.62],
  [24.4, 43.72],
  [23.4, 43.85],
  [22.93, 43.99],
  [22.5, 44.3],
  [22.7, 44.55],
  [22.0, 44.65],
  [21.4, 44.8],
  [21.36, 45.0],
  [20.75, 45.5],
  [20.26, 46.12],
  [21.1, 46.4],
  [21.6, 47.0],
  [22.0, 47.4],
  [22.3, 47.75],
];

/** Point-in-polygon (ray casting) against Romania's simplified border. */
export function inRomania(lat: number, lon: number) {
  let inside = false;
  for (let i = 0, j = ROMANIA_OUTLINE.length - 1; i < ROMANIA_OUTLINE.length; j = i++) {
    const [xi, yi] = ROMANIA_OUTLINE[i];
    const [xj, yj] = ROMANIA_OUTLINE[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** County seats and the largest cities, so the globe can mark the company's city. */
const PLACES: Record<string, LatLon> = {
  bucuresti: [44.43, 26.1],
  "cluj-napoca": [46.77, 23.62],
  timisoara: [45.75, 21.21],
  iasi: [47.16, 27.6],
  constanta: [44.16, 28.63],
  craiova: [44.33, 23.79],
  brasov: [45.64, 25.59],
  galati: [45.44, 28.01],
  ploiesti: [44.94, 26.01],
  oradea: [47.05, 21.92],
  braila: [45.27, 27.96],
  arad: [46.19, 21.31],
  pitesti: [44.86, 24.87],
  sibiu: [45.8, 24.13],
  bacau: [46.57, 26.91],
  "targu mures": [46.54, 24.56],
  "baia mare": [47.66, 23.58],
  buzau: [45.15, 26.83],
  botosani: [47.75, 26.67],
  "satu mare": [47.79, 22.89],
  "ramnicu valcea": [45.1, 24.38],
  suceava: [47.65, 26.26],
  "piatra neamt": [46.93, 26.37],
  "drobeta-turnu severin": [44.64, 22.66],
  targoviste: [44.93, 25.46],
  focsani: [45.7, 27.19],
  bistrita: [47.14, 24.49],
  deva: [45.88, 22.9],
  "alba iulia": [46.07, 23.58],
  zalau: [47.19, 23.06],
  "sfantu gheorghe": [45.87, 25.78],
  slatina: [44.43, 24.37],
  calarasi: [44.2, 27.33],
  giurgiu: [43.9, 25.97],
  vaslui: [46.64, 27.73],
  resita: [45.3, 21.89],
  slobozia: [44.57, 27.37],
  alexandria: [43.98, 25.33],
  "miercurea ciuc": [46.36, 25.8],
  tulcea: [45.17, 28.8],
  "targu jiu": [45.03, 23.28],
  hunedoara: [45.75, 22.9],
  medias: [46.17, 24.35],
  voluntari: [44.49, 26.19],
  otopeni: [44.55, 26.07],
  buftea: [44.57, 25.95],
  mangalia: [43.82, 28.58],
  campina: [45.13, 25.73],
  floresti: [46.75, 23.49],
};

/** County name → its seat, for addresses where only the county is known. */
const COUNTY_SEATS: Record<string, string> = {
  alba: "alba iulia",
  arad: "arad",
  arges: "pitesti",
  bacau: "bacau",
  bihor: "oradea",
  "bistrita-nasaud": "bistrita",
  botosani: "botosani",
  brasov: "brasov",
  braila: "braila",
  bucuresti: "bucuresti",
  buzau: "buzau",
  "caras-severin": "resita",
  calarasi: "calarasi",
  cluj: "cluj-napoca",
  constanta: "constanta",
  covasna: "sfantu gheorghe",
  dambovita: "targoviste",
  dolj: "craiova",
  galati: "galati",
  giurgiu: "giurgiu",
  gorj: "targu jiu",
  harghita: "miercurea ciuc",
  hunedoara: "deva",
  ialomita: "slobozia",
  iasi: "iasi",
  ilfov: "buftea",
  maramures: "baia mare",
  mehedinti: "drobeta-turnu severin",
  mures: "targu mures",
  neamt: "piatra neamt",
  olt: "slatina",
  prahova: "ploiesti",
  "satu mare": "satu mare",
  salaj: "zalau",
  sibiu: "sibiu",
  suceava: "suceava",
  teleorman: "alexandria",
  timis: "timisoara",
  tulcea: "tulcea",
  vaslui: "vaslui",
  valcea: "ramnicu valcea",
  vrancea: "focsani",
};

/** Lower-case, no diacritics, no "MUN."/"JUD." prefixes, single spaces. */
function normalisePlace(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(mun|municipiul|oras|orasul|com|comuna|sat|jud|judetul|sector(ul)?)\b\.?/g, " ")
    .replace(/[^a-z\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-known coordinates for a Romanian city/county, or the country's centre. */
export function locatePlace(city?: string, county?: string): LatLon {
  for (const raw of [city, county]) {
    if (!raw) continue;
    const name = normalisePlace(raw);
    if (name.includes("bucuresti") || name.includes("bucharest")) return PLACES.bucuresti;
    if (PLACES[name]) return PLACES[name];
    const seat = COUNTY_SEATS[name];
    if (seat) return PLACES[seat];
  }
  return ROMANIA_CENTRE;
}

/**
 * Decorative network endpoints for the globe's arcs (European internet hubs).
 * They carry no data claim and are never labelled.
 */
export const ARC_HUBS: LatLon[] = [
  [50.11, 8.68],
  [52.37, 4.9],
  [59.33, 18.07],
  [48.86, 2.35],
  [41.01, 28.98],
  [52.23, 21.01],
  [45.46, 9.19],
  [51.51, -0.13],
];

/** Unit-sphere position: lat/lon (0, 0) faces +z, north is +y. */
export function toVector(lat: number, lon: number, radius = 1): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  return [
    radius * Math.cos(phi) * Math.sin(lambda),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(lambda),
  ];
}

export type LandDot = { lat: number; lon: number; romania: boolean };

/**
 * Land dots on rows `step` degrees apart, with each row's spacing widened by
 * 1/cos(lat) so the dots stay evenly spread over the sphere.
 */
export function landDots(step: number): LandDot[] {
  const dots: LandDot[] = [];
  for (let lat = 90 - step / 2; lat > -90; lat -= step) {
    const perRow = Math.max(1, Math.round((360 / step) * Math.cos((lat * Math.PI) / 180)));
    for (let i = 0; i < perRow; i++) {
      const lon = -180 + (i + 0.5) * (360 / perRow);
      if (isLand(lat, lon)) dots.push({ lat, lon, romania: inRomania(lat, lon) });
    }
  }
  return dots;
}
