import type { TrafficKind, TrafficVehicleState, TrafficWaypoint, VehiclePhysicsState } from './types';
import { TRAFFIC_ROUTES } from './worldData';

interface TrafficBlueprint {
  kind: TrafficKind;
  length: number;
  width: number;
  colors: number[];
}

const TRAFFIC_BLUEPRINTS: TrafficBlueprint[] = [
  { kind: 'sedan', length: 4.5, width: 1.85, colors: [0x2a4d69, 0x7c8691, 0x9e2a2b, 0xd9dce0, 0x1e252e] },
  { kind: 'taxi', length: 4.5, width: 1.85, colors: [0xf2b705] },
  { kind: 'sport', length: 4.35, width: 1.9, colors: [0xc1121f, 0x0077b6, 0xe85d04] },
  { kind: 'city_bus', length: 10.2, width: 2.52, colors: [0x1d4e89, 0x2b7a78] },
  { kind: 'box_truck', length: 7.2, width: 2.4, colors: [0xe6e8ec, 0x3d5a80] },
  { kind: 'semi_tractor', length: 6.8, width: 2.5, colors: [0x6c757d, 0x212529, 0x8d1b1b] },
];

export function createInitialTraffic(routes: TrafficWaypoint[][] = TRAFFIC_ROUTES): TrafficVehicleState[] {
  const vehicles: TrafficVehicleState[] = [];
  // Deterministic diverse traffic mix across all 8 highway & city routes (26 vehicles)
  const spawnSchedule: Array<{ routeIdx: number; wpIdx: number; kind: TrafficKind; colorIdx: number }> = [
    { routeIdx: 0, wpIdx: 0, kind: 'semi_tractor', colorIdx: 0 },
    { routeIdx: 0, wpIdx: 1, kind: 'city_bus', colorIdx: 0 },
    { routeIdx: 0, wpIdx: 2, kind: 'sedan', colorIdx: 0 },
    { routeIdx: 0, wpIdx: 3, kind: 'box_truck', colorIdx: 0 },

    { routeIdx: 1, wpIdx: 0, kind: 'taxi', colorIdx: 0 },
    { routeIdx: 1, wpIdx: 1, kind: 'sport', colorIdx: 1 },
    { routeIdx: 1, wpIdx: 2, kind: 'semi_tractor', colorIdx: 1 },
    { routeIdx: 1, wpIdx: 3, kind: 'city_bus', colorIdx: 1 },

    // N-S 3-Lane Highway Fast Lane
    { routeIdx: 2, wpIdx: 0, kind: 'sport', colorIdx: 0 },
    { routeIdx: 2, wpIdx: 1, kind: 'sedan', colorIdx: 2 },
    { routeIdx: 2, wpIdx: 2, kind: 'taxi', colorIdx: 0 },
    { routeIdx: 2, wpIdx: 3, kind: 'sport', colorIdx: 2 },

    // N-S 3-Lane Highway Middle Lane
    { routeIdx: 3, wpIdx: 0, kind: 'sedan', colorIdx: 1 },
    { routeIdx: 3, wpIdx: 2, kind: 'city_bus', colorIdx: 0 },
    { routeIdx: 3, wpIdx: 4, kind: 'box_truck', colorIdx: 1 },

    // N-S 3-Lane Highway Truck Lane -> E-W 3-Lane Expressway
    { routeIdx: 4, wpIdx: 0, kind: 'semi_tractor', colorIdx: 2 },
    { routeIdx: 4, wpIdx: 2, kind: 'box_truck', colorIdx: 0 },
    { routeIdx: 4, wpIdx: 4, kind: 'semi_tractor', colorIdx: 0 },

    // E-W 3-Lane Expressway Fast Lane
    { routeIdx: 5, wpIdx: 0, kind: 'sport', colorIdx: 1 },
    { routeIdx: 5, wpIdx: 1, kind: 'sedan', colorIdx: 3 },
    { routeIdx: 5, wpIdx: 2, kind: 'taxi', colorIdx: 0 },

    // E-W 3-Lane Expressway Middle Lane -> West Freight Collector
    { routeIdx: 6, wpIdx: 0, kind: 'city_bus', colorIdx: 1 },
    { routeIdx: 6, wpIdx: 2, kind: 'sedan', colorIdx: 4 },
    { routeIdx: 6, wpIdx: 4, kind: 'box_truck', colorIdx: 1 },

    // Old Quarter Narrow Connector
    { routeIdx: 7, wpIdx: 0, kind: 'sedan', colorIdx: 0 },
    { routeIdx: 7, wpIdx: 2, kind: 'taxi', colorIdx: 0 },
  ];

  for (let i = 0; i < spawnSchedule.length; i++) {
    const s = spawnSchedule[i];
    const route = routes[s.routeIdx];
    if (!route || route.length < 2) continue;
    const wp = route[s.wpIdx % route.length];
    const nextWp = route[(s.wpIdx + 1) % route.length];
    const heading = Math.atan2(nextWp.x - wp.x, nextWp.z - wp.z);
    const bp = TRAFFIC_BLUEPRINTS.find((b) => b.kind === s.kind) ?? TRAFFIC_BLUEPRINTS[0];

    vehicles.push({
      id: `tv_${i}`,
      kind: s.kind,
      colorHex: bp.colors[s.colorIdx % bp.colors.length],
      routeIndex: s.routeIdx,
      waypointIndex: (s.wpIdx + 1) % route.length,
      x: wp.x,
      z: wp.z,
      heading,
      speed: wp.speedLimitMs * 0.7,
      targetSpeed: wp.speedLimitMs,
      wheelSpin: 0,
      length: bp.length,
      width: bp.width,
      braking: false,
      honkingTimer: 0,
    });
  }

  return vehicles;
}

function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

export function stepTrafficAI(
  traffic: TrafficVehicleState[],
  player: Pick<VehiclePhysicsState, 'x' | 'z'> | null,
  dt: number,
  routes: TrafficWaypoint[][] = TRAFFIC_ROUTES,
): void {
  const safeDt = Math.min(Math.max(dt, 0.0001), 0.05);

  for (let i = 0; i < traffic.length; i++) {
    const tv = traffic[i];
    const route = routes[tv.routeIndex];
    if (!route || route.length === 0) continue;

    tv.honkingTimer = Math.max(0, tv.honkingTimer - safeDt);

    const wp = route[tv.waypointIndex];
    const dx = wp.x - tv.x;
    const dz = wp.z - tv.z;
    const distToWp = Math.hypot(dx, dz);

    if (distToWp < 3.6) {
      tv.waypointIndex = (tv.waypointIndex + 1) % route.length;
    }

    const activeWp = route[tv.waypointIndex];
    const desiredHeading = Math.atan2(activeWp.x - tv.x, activeWp.z - tv.z);
    const headingError = normalizeAngle(desiredHeading - tv.heading);
    const maxTurnRate = tv.kind === 'city_bus' || tv.kind === 'semi_tractor' ? 1.55 : 2.3;
    const turnStep = Math.max(-maxTurnRate * safeDt, Math.min(maxTurnRate * safeDt, headingError * 4.5 * safeDt));
    tv.heading = normalizeAngle(tv.heading + turnStep);

    // Slow down gently for sharp corners
    const cornerFactor = Math.abs(headingError) > 0.35 ? 0.52 : 1.0;
    let desiredSpeed = activeWp.speedLimitMs * cornerFactor;

    // Lookahead sensor along forward vector for player or other traffic
    const fwdX = Math.sin(tv.heading);
    const fwdZ = Math.cos(tv.heading);
    const lookAheadDist = tv.length * 0.5 + 11.5;

    let blocked = false;
    let closeBlocked = false;

    if (player) {
      const pdx = player.x - tv.x;
      const pdz = player.z - tv.z;
      const proj = pdx * fwdX + pdz * fwdZ;
      const perp = Math.abs(pdx * -fwdZ + pdz * fwdX);
      if (proj > 0 && proj < lookAheadDist + 2.5 && perp < tv.width * 0.75 + 1.6) {
        blocked = true;
        if (proj < tv.length * 0.5 + 5.2) closeBlocked = true;
      }
    }

    for (let j = 0; j < traffic.length; j++) {
      if (i === j) continue;
      const other = traffic[j];
      const odx = other.x - tv.x;
      const odz = other.z - tv.z;
      const proj = odx * fwdX + odz * fwdZ;
      const perp = Math.abs(odx * -fwdZ + odz * fwdX);
      if (proj > 0 && proj < lookAheadDist + other.length * 0.45 && perp < (tv.width + other.width) * 0.5 + 0.6) {
        blocked = true;
        if (proj < (tv.length + other.length) * 0.5 + 3.4) {
          closeBlocked = true;
        }
      }
    }

    if (closeBlocked) {
      desiredSpeed = 0;
    } else if (blocked) {
      desiredSpeed = Math.min(desiredSpeed, 3.2);
    }

    tv.targetSpeed = desiredSpeed;
    tv.braking = desiredSpeed < tv.speed - 0.6 || closeBlocked;

    const accel = desiredSpeed > tv.speed ? 4.2 : 9.8;
    if (tv.speed < desiredSpeed) {
      tv.speed = Math.min(desiredSpeed, tv.speed + accel * safeDt);
    } else {
      tv.speed = Math.max(desiredSpeed, tv.speed - accel * safeDt);
    }

    tv.x += Math.sin(tv.heading) * tv.speed * safeDt;
    tv.z += Math.cos(tv.heading) * tv.speed * safeDt;
    tv.wheelSpin += (tv.speed / 0.42) * safeDt;
  }
}
