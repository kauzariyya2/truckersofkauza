import type { ParkingBay, TrafficWaypoint, TrailerLivery, TrailerVariant, WorldBoxCollider } from './types';

export const WORLD_HALF_EXTENT = 240;

export interface SidewalkIsland {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface TrailerBaySpawn {
  id: string;
  name: string;
  variant: TrailerVariant;
  livery: TrailerLivery;
  x: number;
  z: number;
  heading: number;
  attachedToPlayer: boolean;
  parkedBayId: string | null;
}

/**
 * Playable world spans [-240, +240] (480m x 480m).
 * Road Corridors (kept clear of all colliders):
 * - Grand N-S 3-Lane Dual Carriageway: X = +32 (clear X: +17 .. +47, Z: -200 .. +200)
 * - Grand E-W 3-Lane Dual Carriageway: Z = +50 (clear Z: +35 .. +65, X: -200 .. +200)
 * - Outer Ring Expressway: X = ±184, Z = ±184 (clear ±175 .. ±193)
 * - Mid-North Freight Arterial: Z = -84 (clear Z: -92 .. -76)
 * - Mid-South Port Arterial: Z = +118 (clear Z: +110 .. +126)
 * - West Industrial Collector: X = -104 (clear X: -112 .. -96)
 * - Narrow Old-Quarter Lanes (NE): X = +96, X = +134, Z = -34, Z = -132 (width ~7m)
 */
export const WORLD_COLLIDERS: WorldBoxCollider[] = [
  // --- Depot Warehouse Building (frames spawn (-24, -8) & Title Showcase) ---
  { id: 'wh_back', label: 'Depot Main Warehouse', x: -46, z: -12, halfW: 6, halfD: 16, height: 8.5, kind: 'building' },
  { id: 'wh_north', label: 'Depot North Wing', x: -35, z: -26, halfW: 6, halfD: 3.5, height: 8.5, kind: 'building' },
  { id: 'wh_south', label: 'Depot South Wing', x: -35, z: 4, halfW: 6, halfD: 3.5, height: 8.5, kind: 'building' },

  // --- Depot Shipping Containers & Loading Barriers ---
  { id: 'cont_1', label: 'Container Blue', x: -58, z: -38, halfW: 5.5, halfD: 1.5, height: 2.9, kind: 'container' },
  { id: 'cont_2', label: 'Container Amber', x: -58, z: -34.2, halfW: 5.5, halfD: 1.5, height: 2.9, kind: 'container' },
  { id: 'cont_3', label: 'Container Crimson', x: -58, z: 18, halfW: 1.5, halfD: 5.5, height: 2.9, kind: 'container' },
  { id: 'cont_4', label: 'Container Slate', x: -48, z: -48, halfW: 5.8, halfD: 1.5, height: 2.9, kind: 'container' },
  { id: 'bar_dock_1', label: 'Loading Barrier N', x: -66, z: -16.6, halfW: 4.5, halfD: 0.55, height: 1.2, kind: 'barrier' },
  { id: 'bar_dock_2', label: 'Loading Barrier S', x: -66, z: -7.4, halfW: 4.5, halfD: 0.55, height: 1.2, kind: 'barrier' },

  // --- Fuel / Weigh Station Canopy Pillars (SW Yard near X = -136, Z = 76) ---
  { id: 'fuel_p1', label: 'Fuel Pillar W', x: -144, z: 76, halfW: 0.7, halfD: 0.7, height: 5.0, kind: 'pillar' },
  { id: 'fuel_p2', label: 'Fuel Pillar E', x: -128, z: 76, halfW: 0.7, halfD: 0.7, height: 5.0, kind: 'pillar' },

  // --- North-West Logistics District (X: -90..+12, Z: -168..-96) ---
  { id: 'blk_nw_1', label: 'Cold Storage Hub', x: -48, z: -136, halfW: 22, halfD: 16, height: 13, kind: 'building' },
  { id: 'blk_nw_2', label: 'Cross-Dock Terminal', x: -42, z: -60, halfW: 20, halfD: 10, height: 10.5, kind: 'building' },
  { id: 'blk_nw_3', label: 'North Freight Tower', x: -142, z: -136, halfW: 18, halfD: 18, height: 16, kind: 'building' },
  { id: 'blk_nw_4', label: 'Automated Depot West', x: -142, z: -40, halfW: 18, halfD: 22, height: 12, kind: 'building' },

  // --- North-East Narrow Old-Quarter & Logistics Hub (X: +54..+168, Z: -168..+26) ---
  // Leaves narrow lanes at X = +96 (clear 92..100), X = +134 (clear 130..138), Z = -34 (clear -38..-30), Z = -132
  { id: 'oq_1', label: 'Old Quarter Block 1', x: 73, z: -152, halfW: 14, halfD: 10, height: 12, kind: 'building' },
  { id: 'oq_2', label: 'Old Quarter Block 2', x: 115, z: -152, halfW: 11, halfD: 10, height: 14, kind: 'building' },
  { id: 'oq_3', label: 'Old Quarter Block 3', x: 154, z: -152, halfW: 10, halfD: 10, height: 11, kind: 'building' },

  { id: 'oq_4', label: 'Old Quarter Block 4', x: 73, z: -108, halfW: 14, halfD: 10, height: 11, kind: 'building' },
  { id: 'oq_5', label: 'Freight Offices East', x: 154, z: -108, halfW: 10, halfD: 10, height: 13.5, kind: 'building' },

  { id: 'oq_6', label: 'Market Hall West', x: 73, z: -58, halfW: 14, halfD: 12, height: 10, kind: 'building' },
  { id: 'oq_7', label: 'Custom House Block', x: 115, z: -58, halfW: 11, halfD: 12, height: 12.5, kind: 'building' },
  { id: 'oq_8', label: 'Timber Exchange', x: 154, z: -58, halfW: 10, halfD: 12, height: 11.5, kind: 'building' },

  { id: 'oq_9', label: 'Old Quarter South 1', x: 73, z: -6, halfW: 14, halfD: 16, height: 10.5, kind: 'building' },
  { id: 'oq_10', label: 'Old Quarter South 2', x: 154, z: -6, halfW: 10, halfD: 16, height: 12.0, kind: 'building' },

  // Narrow-street corner safety bollards around X = 96, Z = -34 intersection
  { id: 'bol_1', label: 'Alley Bollard NW', x: 91.2, z: -29.2, halfW: 0.45, halfD: 0.45, height: 1.1, kind: 'bollard' },
  { id: 'bol_2', label: 'Alley Bollard NE', x: 100.8, z: -29.2, halfW: 0.45, halfD: 0.45, height: 1.1, kind: 'bollard' },
  { id: 'bol_3', label: 'Alley Bollard SW', x: 91.2, z: -38.8, halfW: 0.45, halfD: 0.45, height: 1.1, kind: 'bollard' },
  { id: 'bol_4', label: 'Alley Bollard SE', x: 100.8, z: -38.8, halfW: 0.45, halfD: 0.45, height: 1.1, kind: 'bollard' },

  // --- South-East Container Port Terminal (X: +54..+168, Z: +70..+168) ---
  { id: 'se_1', label: 'Port Customs Hall', x: 68, z: 92, halfW: 10, halfD: 14, height: 11, kind: 'building' },
  { id: 'se_2', label: 'Container Crane Tower', x: 142, z: 90, halfW: 16, halfD: 12, height: 16, kind: 'building' },
  { id: 'se_cont_1', label: 'Port Stack A', x: 110, z: 80, halfW: 6.2, halfD: 1.6, height: 5.6, kind: 'container' },
  { id: 'se_cont_2', label: 'Port Stack B', x: 110, z: 84, halfW: 6.2, halfD: 1.6, height: 2.9, kind: 'container' },
  { id: 'se_3', label: 'Maritime Cargo Depot', x: 84, z: 148, halfW: 22, halfD: 14, height: 12, kind: 'building' },
  { id: 'se_4', label: 'East Harbor Silos', x: 146, z: 148, halfW: 16, halfD: 14, height: 17, kind: 'building' },

  // --- South-West District (X: -168..+12, Z: +70..+168) ---
  { id: 'sw_1', label: 'Tanker Refinery Office', x: -158, z: 92, halfW: 8, halfD: 14, height: 11, kind: 'building' },
  { id: 'sw_2', label: 'South Freight Transit', x: -46, z: 90, halfW: 26, halfD: 12, height: 10, kind: 'building' },
  { id: 'sw_3', label: 'Bus Maintenance Hall', x: -46, z: 148, halfW: 26, halfD: 14, height: 12, kind: 'building' },
  { id: 'sw_4', label: 'Heavy Haulage Yard', x: -140, z: 148, halfW: 20, halfD: 14, height: 11.5, kind: 'building' },

  // --- 3-Lane Highway Median Barrier Segments (leaves intersections open!) ---
  { id: 'med_ns_n', label: 'N-S Highway Median North', x: 32, z: -134, halfW: 0.75, halfD: 40, height: 0.75, kind: 'median' },
  { id: 'med_ns_m', label: 'N-S Highway Median Mid', x: 32, z: -22, halfW: 0.75, halfD: 48, height: 0.75, kind: 'median' },
  { id: 'med_ns_s', label: 'N-S Highway Median South', x: 32, z: 150, halfW: 0.75, halfD: 24, height: 0.75, kind: 'median' },

  { id: 'med_ew_w', label: 'E-W Expressway Median West', x: -144, z: 50, halfW: 30, halfD: 0.75, height: 0.75, kind: 'median' },
  { id: 'med_ew_c', label: 'E-W Expressway Median Mid', x: -44, z: 50, halfW: 48, halfD: 0.75, height: 0.75, kind: 'median' },
  { id: 'med_ew_e', label: 'E-W Expressway Median East', x: 114, z: 50, halfW: 56, halfD: 0.75, height: 0.75, kind: 'median' },
];

export const SIDEWALK_ISLANDS: SidewalkIsland[] = [
  { x: -142, z: -136, w: 50, d: 52 },
  { x: -48, z: -136, w: 72, d: 52 },
  { x: -142, z: -40, w: 50, d: 64 },
  { x: 73, z: -152, w: 34, d: 28 },
  { x: 115, z: -152, w: 28, d: 28 },
  { x: 154, z: -152, w: 28, d: 28 },
  { x: 73, z: -108, w: 34, d: 28 },
  { x: 154, z: -108, w: 28, d: 28 },
  { x: 73, z: -58, w: 34, d: 34 },
  { x: 115, z: -58, w: 28, d: 34 },
  { x: 154, z: -58, w: 28, d: 34 },
  { x: 73, z: -6, w: 34, d: 42 },
  { x: 154, z: -6, w: 28, d: 42 },
  { x: 112, z: 90, w: 110, d: 40 },
  { x: 114, z: 148, w: 112, d: 40 },
  { x: -46, z: 90, w: 80, d: 38 },
  { x: -46, z: 148, w: 80, d: 40 },
  { x: -140, z: 148, w: 54, d: 40 },
];

export const PARKING_BAYS: ParkingBay[] = [
  {
    id: 'bay_depot_apron',
    name: 'Depot Bay #1 (Apron)',
    difficulty: 'Standard',
    x: -22,
    z: 14,
    heading: 0,
    width: 4.3,
    length: 14.5,
    hint: 'Line up inside the depot bay and press [T] to drop or brake to lock.',
  },
  {
    id: 'bay_warehouse_reverse',
    name: 'Warehouse Dock #2 (Reverse)',
    difficulty: 'Precision',
    x: -66,
    z: -12,
    heading: Math.PI / 2,
    reverseRecommended: true,
    width: 4.3,
    length: 14.5,
    hint: 'Back carefully between yellow barriers using Reverse [R] or [Q].',
  },
  {
    id: 'bay_container_dock',
    name: 'Container Terminal Dock #3',
    difficulty: 'Standard',
    x: 92,
    z: 92,
    heading: Math.PI,
    width: 4.4,
    length: 15.0,
    hint: 'Port Intermodal Dock — drop or hook the 40ft container trailer with [T].',
  },
  {
    id: 'bay_fuel_weigh',
    name: 'Fuel & Tanker Yard Bay #4',
    difficulty: 'Standard',
    x: -136,
    z: 96,
    heading: 0,
    width: 4.4,
    length: 15.0,
    hint: 'Weigh & Fuel Yard — drop or hook the stainless fuel tanker with [T].',
  },
  {
    id: 'bay_alley_squeeze',
    name: 'Old-Quarter Narrow Bay #5',
    difficulty: 'Tight',
    x: 96,
    z: -10,
    heading: 0,
    width: 3.9,
    length: 13.5,
    hint: 'Tight urban street slot — watch corner bollards & trailer swing.',
  },
  {
    id: 'bay_east_hub',
    name: 'East Logistics Hub Bay #6',
    difficulty: 'Tight',
    x: 134,
    z: -112,
    heading: 0,
    width: 4.4,
    length: 15.0,
    hint: 'NE Freight Hub — drop or pick up the heavy steel-coil flatbed with [T].',
  },
];

export const INITIAL_TRAILER_SPAWNS: TrailerBaySpawn[] = [
  {
    id: 'tr_auman_container',
    name: 'Auman Galaxy 40ft Container',
    variant: 'container',
    livery: 'auman_silver',
    x: -24,
    z: -14.55,
    heading: 0,
    attachedToPlayer: true,
    parkedBayId: null,
  },
  {
    id: 'tr_port_container',
    name: '40ft Intermodal Container',
    variant: 'container',
    livery: 'ocean_blue',
    x: 92,
    z: 92,
    heading: Math.PI,
    attachedToPlayer: false,
    parkedBayId: 'bay_container_dock',
  },
  {
    id: 'tr_fuel_tanker',
    name: 'Cryo & Fuel Stainless Tanker',
    variant: 'tanker',
    livery: 'amber_chrome',
    x: -136,
    z: 96,
    heading: 0,
    attachedToPlayer: false,
    parkedBayId: 'bay_fuel_weigh',
  },
  {
    id: 'tr_steel_flatbed',
    name: 'Heavy Steel-Coil Flatbed',
    variant: 'flatbed',
    livery: 'crimson_haul',
    x: 134,
    z: -112,
    heading: 0,
    attachedToPlayer: false,
    parkedBayId: 'bay_east_hub',
  },
];

/**
 * Multi-lane traffic loops spanning the 3-lane highways, outer expressway, and city collectors.
 * Grand N-S Highway (X = +32):
 *   Southbound (+Z) 3 lanes: X = 21.0 (slow/truck), 24.8 (mid), 28.6 (fast)
 *   Northbound (-Z) 3 lanes: X = 43.0 (slow/truck), 39.2 (mid), 35.4 (fast)
 * Grand E-W Expressway (Z = +50):
 *   Eastbound (+X) 3 lanes: Z = 53.4 (fast), 57.2 (mid), 61.0 (slow/truck)
 *   Westbound (-X) 3 lanes: Z = 46.6 (fast), 42.8 (mid), 39.0 (slow/truck)
 */
export const TRAFFIC_ROUTES: TrafficWaypoint[][] = [
  // Route 0: Outer 480m Ring Expressway (Clockwise)
  [
    { x: -186, z: -186, speedLimitMs: 18.0 },
    { x: 186, z: -186, speedLimitMs: 18.0 },
    { x: 186, z: 186, speedLimitMs: 18.0 },
    { x: -186, z: 186, speedLimitMs: 18.0 },
  ],
  // Route 1: Outer Ring Expressway (Counter-Clockwise inner lane)
  [
    { x: -180, z: -180, speedLimitMs: 16.5 },
    { x: -180, z: 180, speedLimitMs: 16.5 },
    { x: 180, z: 180, speedLimitMs: 16.5 },
    { x: 180, z: -180, speedLimitMs: 16.5 },
  ],
  // Route 2: Grand N-S 3-Lane Highway Fast Lane <-> Mid-North & South Arterials
  [
    { x: 28.2, z: -180, speedLimitMs: 19.5 },
    { x: 28.2, z: 180, speedLimitMs: 19.5 },
    { x: 35.8, z: 180, speedLimitMs: 19.5 },
    { x: 35.8, z: -180, speedLimitMs: 19.5 },
  ],
  // Route 3: Grand N-S 3-Lane Highway Middle Lane <-> East Ring
  [
    { x: 24.4, z: -180, speedLimitMs: 16.5 },
    { x: 24.4, z: 118, speedLimitMs: 16.5 },
    { x: 180, z: 118, speedLimitMs: 14.5 },
    { x: 180, z: -84, speedLimitMs: 14.5 },
    { x: 39.6, z: -84, speedLimitMs: 16.5 },
    { x: 39.6, z: -180, speedLimitMs: 16.5 },
  ],
  // Route 4: Grand N-S 3-Lane Highway Outer Truck Lane -> Grand E-W 3-Lane Expressway
  [
    { x: 20.6, z: -180, speedLimitMs: 13.5 },
    { x: 20.6, z: 60.5, speedLimitMs: 13.5 },
    { x: 180, z: 60.5, speedLimitMs: 15.0 },
    { x: 180, z: 39.5, speedLimitMs: 15.0 },
    { x: 43.2, z: 39.5, speedLimitMs: 13.5 },
    { x: 43.2, z: -180, speedLimitMs: 13.5 },
  ],
  // Route 5: Grand E-W 3-Lane Expressway Full Cross-Map Fast Lane
  [
    { x: -180, z: 53.6, speedLimitMs: 19.0 },
    { x: 180, z: 53.6, speedLimitMs: 19.0 },
    { x: 180, z: 46.4, speedLimitMs: 19.0 },
    { x: -180, z: 46.4, speedLimitMs: 19.0 },
  ],
  // Route 6: Grand E-W 3-Lane Expressway Middle Lane -> West Freight Collector
  [
    { x: -104, z: -84, speedLimitMs: 13.0 },
    { x: -104, z: 57.2, speedLimitMs: 15.0 },
    { x: 180, z: 57.2, speedLimitMs: 16.0 },
    { x: 180, z: 42.8, speedLimitMs: 16.0 },
    { x: -104, z: 42.8, speedLimitMs: 13.0 },
    { x: -104, z: -84, speedLimitMs: 13.0 },
  ],
  // Route 7: Old-Quarter & Mid-North Connector (passes through narrow street Z = -34!)
  [
    { x: 39.6, z: -34, speedLimitMs: 10.5 },
    { x: 180, z: -34, speedLimitMs: 10.5 },
    { x: 180, z: -84, speedLimitMs: 13.0 },
    { x: 39.6, z: -84, speedLimitMs: 13.0 },
  ],
];

export function getZoneName(x: number, z: number): string {
  if (x > 16 && x < 48) return 'GRAND N-S 3-LANE HIGHWAY';
  if (z > 34 && z < 66) return 'GRAND E-W 3-LANE EXPRESSWAY';
  if (x < -10 && x > -80 && z > -42 && z < 32) return 'GALAXY FREIGHT DEPOT';
  if (x > 50 && x < 172 && z > -170 && z < 30) return 'OLD-QUARTER & LOGISTICS HUB';
  if (x > 50 && z > 66 && z < 174) return 'INTERMODAL CONTAINER PORT';
  if (x < -110 && z > 66 && z < 174) return 'FUEL & REFINERY YARD';
  if (Math.abs(x) > 170 || Math.abs(z) > 170) return 'COASTAL EXPRESS RING';
  return 'METROPOLIS FREIGHT DISTRICT';
}
