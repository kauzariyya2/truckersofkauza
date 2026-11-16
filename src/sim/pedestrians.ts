import type { PedestrianState, TrafficVehicleState, VehiclePhysicsState } from './types';

function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

interface PedRouteSpec {
  role: 'worker' | 'civilian';
  shirtHex: number;
  pantsHex: number;
  speed: number;
  waypoints: Array<{ x: number; z: number }>;
}

const PEDESTRIAN_ROUTES: PedRouteSpec[] = [
  // Depot & Warehouse Dock Workers (walking around apron perimeter & container yard, clear of HERO_SPAWN)
  {
    role: 'worker',
    shirtHex: 0xf59e0b,
    pantsHex: 0x1e293b,
    speed: 1.45,
    waypoints: [
      { x: -37, z: -20 },
      { x: -37, z: 0 },
      { x: -29, z: 0 },
      { x: -29, z: -20 },
    ],
  },
  {
    role: 'worker',
    shirtHex: 0x84cc16,
    pantsHex: 0x1e293b,
    speed: 1.35,
    waypoints: [
      { x: -55, z: -28 },
      { x: -55, z: 8 },
      { x: -62, z: 8 },
      { x: -62, z: -28 },
    ],
  },
  {
    role: 'worker',
    shirtHex: 0xf97316,
    pantsHex: 0x0f172a,
    speed: 1.5,
    waypoints: [
      { x: -12, z: -26 },
      { x: -12, z: 22 },
      { x: -8, z: 22 },
      { x: -8, z: -26 },
    ],
  },
  {
    role: 'worker',
    shirtHex: 0xfacc15,
    pantsHex: 0x1e293b,
    speed: 1.4,
    waypoints: [
      { x: -50, z: -42 },
      { x: -26, z: -42 },
      { x: -26, z: -46 },
      { x: -50, z: -46 },
    ],
  },

  // Grand N-S Highway West & East Sidewalk / Crosswalk Civilians
  {
    role: 'civilian',
    shirtHex: 0x38bdf8,
    pantsHex: 0x1e293b,
    speed: 1.55,
    waypoints: [
      { x: 14, z: -28 },
      { x: 14, z: 24 },
      { x: 10, z: 24 },
      { x: 10, z: -28 },
    ],
  },
  {
    role: 'civilian',
    shirtHex: 0xe11d48,
    pantsHex: 0x0f172a,
    speed: 1.48,
    waypoints: [
      { x: 52, z: -26 },
      { x: 52, z: 24 },
      { x: 48, z: 24 },
      { x: 48, z: -26 },
    ],
  },
  {
    role: 'civilian',
    shirtHex: 0x10b981,
    pantsHex: 0x334155,
    speed: 1.42,
    waypoints: [
      { x: 52, z: -72 },
      { x: 52, z: -38 },
      { x: 48, z: -38 },
      { x: 48, z: -72 },
    ],
  },

  // Old Quarter Narrow Streets Pedestrians (walking along raised sidewalks & zebra crossings!)
  {
    role: 'civilian',
    shirtHex: 0x6366f1,
    pantsHex: 0x1e293b,
    speed: 1.38,
    waypoints: [
      { x: 58, z: -26 },
      { x: 89, z: -26 },
      { x: 89, z: -2 },
      { x: 58, z: -2 },
    ],
  },
  {
    role: 'civilian',
    shirtHex: 0xec4899,
    pantsHex: 0x1e293b,
    speed: 1.5,
    waypoints: [
      { x: 103, z: -42 },
      { x: 127, z: -42 },
      { x: 127, z: -74 },
      { x: 103, z: -74 },
    ],
  },
  {
    role: 'civilian',
    shirtHex: 0xf43f5e,
    pantsHex: 0x0f172a,
    speed: 1.45,
    waypoints: [
      { x: 89, z: -31 },
      { x: 103, z: -31 }, // Zebra crossing across narrow street X=96!
      { x: 103, z: -37 },
      { x: 89, z: -37 },
    ],
  },
  {
    role: 'worker',
    shirtHex: 0xf59e0b,
    pantsHex: 0x1e293b,
    speed: 1.4,
    waypoints: [
      { x: 142, z: -96 },
      { x: 142, z: -124 },
      { x: 165, z: -124 },
      { x: 165, z: -96 },
    ],
  },

  // Port Container Terminal & Customs Dock Workers
  {
    role: 'worker',
    shirtHex: 0x84cc16,
    pantsHex: 0x1e293b,
    speed: 1.52,
    waypoints: [
      { x: 82, z: 72 },
      { x: 124, z: 72 },
      { x: 124, z: 104 },
      { x: 82, z: 104 },
    ],
  },
  {
    role: 'worker',
    shirtHex: 0xf97316,
    pantsHex: 0x0f172a,
    speed: 1.38,
    waypoints: [
      { x: 58, z: 128 },
      { x: 112, z: 128 },
      { x: 112, z: 166 },
      { x: 58, z: 166 },
    ],
  },

  // Fuel & Refinery Yard + Bus Maintenance Walkers
  {
    role: 'worker',
    shirtHex: 0xfacc15,
    pantsHex: 0x1e293b,
    speed: 1.42,
    waypoints: [
      { x: -148, z: 72 },
      { x: -122, z: 72 },
      { x: -122, z: 105 },
      { x: -148, z: 105 },
    ],
  },
  {
    role: 'civilian',
    shirtHex: 0x0ea5e9,
    pantsHex: 0x1e293b,
    speed: 1.58,
    waypoints: [
      { x: -84, z: 128 },
      { x: -10, z: 128 },
      { x: -10, z: 166 },
      { x: -84, z: 166 },
    ],
  },
  {
    role: 'civilian',
    shirtHex: 0xa855f7,
    pantsHex: 0x0f172a,
    speed: 1.48,
    waypoints: [
      { x: -84, z: 72 },
      { x: -10, z: 72 },
      { x: -10, z: 106 },
      { x: -84, z: 106 },
    ],
  },

  // North-West Cross-Dock & Logistics Walkers
  {
    role: 'worker',
    shirtHex: 0xf59e0b,
    pantsHex: 0x1e293b,
    speed: 1.45,
    waypoints: [
      { x: -82, z: -112 },
      { x: -14, z: -112 },
      { x: -14, z: -160 },
      { x: -82, z: -160 },
    ],
  },
  {
    role: 'civilian',
    shirtHex: 0x14b8a6,
    pantsHex: 0x1e293b,
    speed: 1.5,
    waypoints: [
      { x: -116, z: -64 },
      { x: -164, z: -64 },
      { x: -164, z: -14 },
      { x: -116, z: -14 },
    ],
  },
];

export function createInitialPedestrians(): PedestrianState[] {
  const peds: PedestrianState[] = [];
  for (let i = 0; i < PEDESTRIAN_ROUTES.length; i++) {
    const r = PEDESTRIAN_ROUTES[i];
    // Spawn 2 people per patrol loop (staggered on opposite sides) for 36 bustling people across the city!
    for (let offset = 0; offset < 2; offset++) {
      const startWp = (offset * 2) % r.waypoints.length;
      const nextWp = (startWp + 1) % r.waypoints.length;
      const p0 = r.waypoints[startWp];
      const p1 = r.waypoints[nextWp];
      const heading = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      peds.push({
        id: `ped_${i}_${offset}`,
        x: p0.x,
        z: p0.z,
        heading,
        speed: r.speed * (offset === 0 ? 1 : 0.92),
        baseSpeed: r.speed * (offset === 0 ? 1 : 0.92),
        walkPhase: i * 0.9 + offset * 1.7,
        role: r.role,
        shirtHex: offset === 0 ? r.shirtHex : ((r.shirtHex ^ 0x223311) & 0xffffff),
        pantsHex: r.pantsHex,
        waypoints: r.waypoints,
        wpIndex: nextWp,
        waiting: false,
      });
    }
  }
  return peds;
}

export function stepPedestrians(
  peds: PedestrianState[],
  player: Pick<VehiclePhysicsState, 'x' | 'z'> | null,
  traffic: TrafficVehicleState[],
  dt: number,
): void {
  const safeDt = Math.min(Math.max(dt, 0.0001), 0.05);

  for (let i = 0; i < peds.length; i++) {
    const p = peds[i];
    const target = p.waypoints[p.wpIndex];
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.7) {
      p.wpIndex = (p.wpIndex + 1) % p.waypoints.length;
    }

    const nextTarget = p.waypoints[p.wpIndex];
    const desiredHeading = Math.atan2(nextTarget.x - p.x, nextTarget.z - p.z);
    const err = normalizeAngle(desiredHeading - p.heading);
    p.heading = normalizeAngle(p.heading + err * Math.min(1, 6.5 * safeDt));

    // Yield / wait if player or traffic vehicle is dangerously close ahead
    let shouldWait = false;
    const fwdX = Math.sin(p.heading);
    const fwdZ = Math.cos(p.heading);

    if (player) {
      const pdx = player.x - p.x;
      const pdz = player.z - p.z;
      const dSq = pdx * pdx + pdz * pdz;
      if (dSq < 6.5 * 6.5) {
        const proj = pdx * fwdX + pdz * fwdZ;
        if (proj > -1.0) shouldWait = true;
      }
      // Gentle safety bump-aside if truck touches pedestrian
      if (dSq < 2.2 * 2.2 && dSq > 0.001) {
        const d = Math.sqrt(dSq);
        p.x -= (pdx / d) * (2.2 - d);
        p.z -= (pdz / d) * (2.2 - d);
      }
    }

    if (!shouldWait) {
      for (let t = 0; t < traffic.length; t++) {
        const tv = traffic[t];
        const tdx = tv.x - p.x;
        const tdz = tv.z - p.z;
        const dSq = tdx * tdx + tdz * tdz;
        if (dSq < 5.5 * 5.5) {
          shouldWait = true;
          break;
        }
      }
    }

    p.waiting = shouldWait;
    const targetSpeed = shouldWait ? 0 : p.baseSpeed;
    p.speed += (targetSpeed - p.speed) * Math.min(1, 8 * safeDt);

    p.x += Math.sin(p.heading) * p.speed * safeDt;
    p.z += Math.cos(p.heading) * p.speed * safeDt;
    if (p.speed > 0.05) {
      p.walkPhase += p.speed * safeDt * 3.8;
    } else {
      p.walkPhase = 0;
    }
  }
}
