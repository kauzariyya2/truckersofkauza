import { createInitialGearbox, stepGearboxAndDrivetrain } from './gearbox';
import type {
  ControlInputs,
  ParkingBay,
  ParkingStatus,
  TrafficVehicleState,
  TrailerLivery,
  TrailerState,
  TrailerVariant,
  VehiclePhysicsState,
  VehicleSpec,
  WorldBoxCollider,
} from './types';
import { INITIAL_TRAILER_SPAWNS, PARKING_BAYS, WORLD_COLLIDERS, WORLD_HALF_EXTENT } from './worldData';

export const HERO_SPAWN = {
  x: -24,
  z: -8,
  heading: 0,
};

export const HITCH_LOCAL_Z = -2.25;
export const TRAILER_KINGPIN_TO_CENTER = 4.3;
export const TRAILER_KINGPIN_TO_AXLE = 8.1;
export const TRAILER_LENGTH = 12.2;
export const TRAILER_WIDTH = 2.48;
export const TRAILER_MASS_KG = 16800;

export const TRAILER_VARIANT_SPECS: Record<
  TrailerVariant,
  {
    label: string;
    length: number;
    width: number;
    massKg: number;
    kingpinToCenter: number;
    kingpinToAxle: number;
  }
> = {
  container: {
    label: '40ft Container',
    length: 12.2,
    width: 2.48,
    massKg: 16800,
    kingpinToCenter: 4.3,
    kingpinToAxle: 8.1,
  },
  tanker: {
    label: 'Fuel Tanker',
    length: 11.0,
    width: 2.48,
    massKg: 14500,
    kingpinToCenter: 3.85,
    kingpinToAxle: 7.2,
  },
  flatbed: {
    label: 'Coil Flatbed',
    length: 12.0,
    width: 2.54,
    massKg: 18200,
    kingpinToCenter: 4.2,
    kingpinToAxle: 7.9,
  },
};

function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

export function createTrailerState(
  id: string,
  name: string,
  variant: TrailerVariant,
  livery: TrailerLivery,
  x: number,
  z: number,
  heading: number,
  attached: boolean,
  parkedBayId: string | null = null,
): TrailerState {
  const vSpec = TRAILER_VARIANT_SPECS[variant];
  return {
    id,
    name,
    variant,
    livery,
    attached,
    x,
    z,
    heading,
    wheelSpinAngle: 0,
    length: vSpec.length,
    width: vSpec.width,
    massKg: vSpec.massKg,
    kingpinToCenter: vSpec.kingpinToCenter,
    kingpinToAxle: vSpec.kingpinToAxle,
    parkedBayId,
  };
}

export function createInitialWorldTrailers(): TrailerState[] {
  return INITIAL_TRAILER_SPAWNS.map((s) =>
    createTrailerState(s.id, s.name, s.variant, s.livery, s.x, s.z, s.heading, s.attachedToPlayer, s.parkedBayId),
  );
}

export function createInitialVehicleState(
  spec: VehicleSpec,
  spawn = HERO_SPAWN,
  autoClutch = true,
  withTrailer = spec.id === 'auman_8x4',
  initialTrailer?: TrailerState | null,
): VehiclePhysicsState {
  const sinH = Math.sin(spawn.heading);
  const cosH = Math.cos(spawn.heading);
  const hitchX = spawn.x + sinH * HITCH_LOCAL_Z;
  const hitchZ = spawn.z + cosH * HITCH_LOCAL_Z;

  let trailer: TrailerState | null = null;
  if (withTrailer) {
    if (initialTrailer) {
      initialTrailer.attached = true;
      initialTrailer.parkedBayId = null;
      initialTrailer.x = hitchX - sinH * initialTrailer.kingpinToCenter;
      initialTrailer.z = hitchZ - cosH * initialTrailer.kingpinToCenter;
      initialTrailer.heading = spawn.heading;
      trailer = initialTrailer;
    } else {
      trailer = createTrailerState(
        'tr_auman_container',
        'Auman Galaxy 40ft Container',
        'container',
        'auman_silver',
        hitchX - sinH * TRAILER_KINGPIN_TO_CENTER,
        hitchZ - cosH * TRAILER_KINGPIN_TO_CENTER,
        spawn.heading,
        true,
        null,
      );
    }
  }

  return {
    x: spawn.x,
    z: spawn.z,
    heading: spawn.heading,
    vx: 0,
    vz: 0,
    forwardSpeed: 0,
    lateralSpeed: 0,
    yawRate: 0,
    steerAngle: 0,
    wheelSpinAngle: 0,
    pitch: 0,
    pitchVel: 0,
    roll: 0,
    rollVel: 0,
    gearbox: createInitialGearbox(spec, autoClutch),
    handbrake: false,
    braking: false,
    throttleInput: 0,
    headlightsOn: true,
    roofLightsOn: true,
    distanceDrivenM: 0,
    damageCount: 0,
    lastCollisionImpulse: 0,
    trailer,
  };
}

export function findNearbyHookableTrailer(
  state: VehiclePhysicsState,
  trailers: TrailerState[],
): TrailerState | null {
  const sinH = Math.sin(state.heading);
  const cosH = Math.cos(state.heading);
  const hx = state.x + sinH * HITCH_LOCAL_Z;
  const hz = state.z + cosH * HITCH_LOCAL_Z;

  let best: TrailerState | null = null;
  let bestDist = 4.4;

  for (let i = 0; i < trailers.length; i++) {
    const tr = trailers[i];
    if (tr.attached) continue;
    const kx = tr.x + Math.sin(tr.heading) * tr.kingpinToCenter;
    const kz = tr.z + Math.cos(tr.heading) * tr.kingpinToCenter;
    const dist = Math.hypot(hx - kx, hz - kz);
    const angleDiff = Math.abs(normalizeAngle(state.heading - tr.heading));
    if (dist <= bestDist && angleDiff < 1.42) {
      bestDist = dist;
      best = tr;
    }
  }
  return best;
}

export function scorePoseInBay(
  px: number,
  pz: number,
  pHeading: number,
  pWidth: number,
  pLength: number,
  bay: ParkingBay,
) {
  const sinB = Math.sin(bay.heading);
  const cosB = Math.cos(bay.heading);
  const dx = px - bay.x;
  const dz = pz - bay.z;
  const localForward = dx * sinB + dz * cosB;
  const localRight = dx * -cosB + dz * sinB;

  const halfBayW = bay.width * 0.5;
  const halfBayL = bay.length * 0.5;
  const halfVehW = pWidth * 0.5;
  const halfVehL = pLength * 0.5;

  const frontClearanceM = Math.max(0, halfBayL - (localForward + halfVehL));
  const rearClearanceM = Math.max(0, halfBayL - (-localForward + halfVehL));
  const leftClearanceM = Math.max(0, halfBayW - (-localRight + halfVehW));
  const rightClearanceM = Math.max(0, halfBayW - (localRight + halfVehW));

  let angleDiff = Math.abs(((pHeading - bay.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  angleDiff = Math.min(angleDiff, Math.abs(Math.PI - angleDiff));

  const posScore = Math.max(
    0,
    1 - ((Math.abs(localRight) / (halfBayW + 0.6)) * 0.55 + (Math.abs(localForward) / (halfBayL + 0.8)) * 0.45),
  );
  const angleScore = Math.max(0, 1 - angleDiff / (Math.PI / 4));
  const alignmentPct = Math.round(Math.max(0, Math.min(100, (posScore * 0.65 + angleScore * 0.35) * 100)));

  const isInside =
    Math.abs(localRight) + halfVehW <= halfBayW + 0.3 &&
    Math.abs(localForward) + halfVehL <= halfBayL + 0.8 &&
    angleDiff < 0.25;

  return {
    alignmentPct,
    isInside,
    frontClearanceM,
    rearClearanceM,
    leftClearanceM,
    rightClearanceM,
  };
}

export function toggleWorldTrailerCoupling(
  state: VehiclePhysicsState,
  spec: VehicleSpec,
  trailers: TrailerState[],
  bays: ParkingBay[] = PARKING_BAYS,
): { changed: boolean; attached: boolean; droppedInBay: ParkingBay | null; trailer: TrailerState | null; message: string } {
  if (spec.id !== 'auman_8x4') {
    return {
      changed: false,
      attached: false,
      droppedInBay: null,
      trailer: null,
      message: 'Switch to 8x4 Tractor to haul semi-trailers',
    };
  }

  // Drop currently coupled trailer
  if (state.trailer && state.trailer.attached) {
    const tr = state.trailer;
    tr.attached = false;
    state.trailer = null;

    // Check if dropped inside any bay
    let matchedBay: ParkingBay | null = null;
    for (let i = 0; i < bays.length; i++) {
      const b = bays[i];
      const sc = scorePoseInBay(tr.x, tr.z, tr.heading, tr.width, tr.length, b);
      if (sc.isInside && sc.alignmentPct >= 68) {
        matchedBay = b;
        break;
      }
    }
    tr.parkedBayId = matchedBay ? matchedBay.id : null;

    return {
      changed: true,
      attached: false,
      droppedInBay: matchedBay,
      trailer: tr,
      message: matchedBay
        ? `Delivered ${tr.name} to ${matchedBay.name}`
        : `Dropped ${tr.name} — landing gear deployed`,
    };
  }

  // Otherwise try hooking onto any nearby uncoupled trailer in the world
  const target = findNearbyHookableTrailer(state, trailers);
  if (target) {
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);
    const hx = state.x + sinH * HITCH_LOCAL_Z;
    const hz = state.z + cosH * HITCH_LOCAL_Z;
    target.attached = true;
    target.parkedBayId = null;
    target.x = hx - Math.sin(target.heading) * target.kingpinToCenter;
    target.z = hz - Math.cos(target.heading) * target.kingpinToCenter;
    state.trailer = target;
    return {
      changed: true,
      attached: true,
      droppedInBay: null,
      trailer: target,
      message: `Hooked ${target.name} — ready to haul`,
    };
  }

  return {
    changed: false,
    attached: false,
    droppedInBay: null,
    trailer: null,
    message: 'Back fifth-wheel near a parked trailer kingpin to hook [T]',
  };
}

/**
 * Legacy single-trailer toggle helper retained for compatibility with isolated unit tests.
 */
export function toggleTrailerCoupling(
  state: VehiclePhysicsState,
  spec: VehicleSpec,
): { changed: boolean; attached: boolean; message: string } {
  if (spec.id !== 'auman_8x4') {
    return { changed: false, attached: false, message: 'Only the 8x4 Tractor supports a semi-trailer' };
  }
  if (!state.trailer) {
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);
    const hx = state.x + sinH * HITCH_LOCAL_Z;
    const hz = state.z + cosH * HITCH_LOCAL_Z;
    state.trailer = createTrailerState(
      'tr_auman_container',
      'Auman Galaxy 40ft Container',
      'container',
      'auman_silver',
      hx - sinH * TRAILER_KINGPIN_TO_CENTER,
      hz - cosH * TRAILER_KINGPIN_TO_CENTER,
      state.heading,
      true,
    );
    return { changed: true, attached: true, message: 'Trailer coupled' };
  }

  if (state.trailer.attached) {
    state.trailer.attached = false;
    return { changed: true, attached: false, message: 'Trailer uncoupled — landing gear deployed' };
  }

  const sinH = Math.sin(state.heading);
  const cosH = Math.cos(state.heading);
  const hx = state.x + sinH * HITCH_LOCAL_Z;
  const hz = state.z + cosH * HITCH_LOCAL_Z;
  const kx = state.trailer.x + Math.sin(state.trailer.heading) * state.trailer.kingpinToCenter;
  const kz = state.trailer.z + Math.cos(state.trailer.heading) * state.trailer.kingpinToCenter;
  const dist = Math.hypot(hx - kx, hz - kz);
  const angleDiff = Math.abs(normalizeAngle(state.heading - state.trailer.heading));

  if (dist <= 4.2 && angleDiff < 1.42) {
    state.trailer.attached = true;
    state.trailer.x = hx - Math.sin(state.trailer.heading) * state.trailer.kingpinToCenter;
    state.trailer.z = hz - Math.cos(state.trailer.heading) * state.trailer.kingpinToCenter;
    return { changed: true, attached: true, message: 'Kingpin locked — trailer coupled' };
  }
  return { changed: false, attached: false, message: 'Back fifth-wheel closer to kingpin to couple' };
}

export interface PhysicsStepOutput {
  collisionImpulse: number;
}

/**
 * Computes OBB vs AABB minimum translation vector (MTV) in XZ plane.
 * Returns null if no overlap, or { nx, nz, depth } to push the OBB out of the AABB.
 */
export function resolveObbVsAabb(
  cx: number,
  cz: number,
  heading: number,
  halfW: number,
  halfL: number,
  box: WorldBoxCollider,
): { nx: number; nz: number; depth: number } | null {
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);

  const ux = -cosH;
  const uz = sinH;
  const vx = sinH;
  const vz = cosH;

  const dx = cx - box.x;
  const dz = cz - box.z;

  let minOverlap = Infinity;
  let bestNx = 0;
  let bestNz = 0;

  const axes: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [ux, uz],
    [vx, vz],
  ];

  for (let i = 0; i < 4; i++) {
    const ax = axes[i][0];
    const az = axes[i][1];

    const centerProj = dx * ax + dz * az;
    const vehRadius = Math.abs(ux * ax + uz * az) * halfW + Math.abs(vx * ax + vz * az) * halfL;
    const boxRadius = Math.abs(ax) * box.halfW + Math.abs(az) * box.halfD;

    const overlap = vehRadius + boxRadius - Math.abs(centerProj);
    if (overlap <= 0) return null;

    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = centerProj >= 0 ? 1 : -1;
      bestNx = ax * sign;
      bestNz = az * sign;
    }
  }

  return { nx: bestNx, nz: bestNz, depth: minOverlap };
}

export function stepVehiclePhysics(
  state: VehiclePhysicsState,
  spec: VehicleSpec,
  inputs: ControlInputs,
  dt: number,
  colliders: WorldBoxCollider[] = WORLD_COLLIDERS,
  traffic: TrafficVehicleState[] = [],
  worldTrailers: TrailerState[] = [],
): PhysicsStepOutput {
  const safeDt = Math.min(Math.max(dt, 0.0001), 0.05);
  state.lastCollisionImpulse = 0;

  state.throttleInput = inputs.throttle;
  state.braking = inputs.brake > 0.05 || state.handbrake;

  // 1. Decompose world velocity into vehicle local frame
  const sinH = Math.sin(state.heading);
  const cosH = Math.cos(state.heading);
  const rightX = -cosH;
  const rightZ = sinH;

  let vForward = state.vx * sinH + state.vz * cosH;
  let vLateral = state.vx * rightX + state.vz * rightZ;

  // 2. Smooth steering angle toward target (speed-sensitive damping at high speed)
  const speedAbs = Math.abs(vForward);
  const highSpeedSteerFactor = 1 / (1 + speedAbs * 0.028);
  const targetSteer = inputs.steer * spec.maxSteerRad * highSpeedSteerFactor;
  const steerRate = 3.6;
  state.steerAngle += (targetSteer - state.steerAngle) * Math.min(1, steerRate * safeDt);

  // 3. Gearbox & Drivetrain
  const drivetrain = stepGearboxAndDrivetrain(
    state.gearbox,
    spec,
    vForward,
    inputs.throttle,
    inputs.clutch,
    safeDt,
  );
  state.gearbox = drivetrain.gearbox;

  const attachedTrailer = state.trailer && state.trailer.attached ? state.trailer : null;
  const effectiveMass = spec.massKg + (attachedTrailer ? attachedTrailer.massKg * 0.72 : 0);

  // 4. Longitudinal forces (Drive + Engine Braking + Service Brakes + Handbrake + Aero/Rolling)
  let totalLongForce = drivetrain.driveForceN + drivetrain.engineBrakeForceN;

  if (Math.abs(vForward) > 0.01) {
    const rollRes = spec.rollingResistance + (attachedTrailer ? 420 : 0);
    const aeroDrag = spec.dragCoeff + (attachedTrailer ? 2.4 : 0);
    totalLongForce -= Math.sign(vForward) * (rollRes + aeroDrag * vForward * vForward);
  }

  const trailerBrakeBonus = attachedTrailer ? spec.maxBrakeForceN * 0.48 : 0;
  let brakeForceMag = inputs.brake * (spec.maxBrakeForceN + trailerBrakeBonus);
  if (state.handbrake) {
    brakeForceMag = Math.max(brakeForceMag, (spec.maxBrakeForceN + trailerBrakeBonus) * 0.85);
  }

  const accelLong = totalLongForce / effectiveMass;
  vForward += accelLong * safeDt;

  if (brakeForceMag > 0) {
    const brakeDecel = (brakeForceMag / effectiveMass) * safeDt;
    if (Math.abs(vForward) <= brakeDecel) {
      vForward = 0;
    } else {
      vForward -= Math.sign(vForward) * brakeDecel;
    }
  }

  if (Math.abs(vForward) < 0.08 && Math.abs(drivetrain.driveForceN) < spec.rollingResistance) {
    vForward = 0;
  }

  // 5. Bicycle / Ackermann Steering & Lateral Tire Grip
  if (Math.abs(vForward) > 0.04) {
    const curvature = Math.tan(state.steerAngle) / spec.wheelbase;
    const targetYawRate = vForward * curvature;
    const yawBlend = Math.min(1, 10.5 * safeDt);
    state.yawRate += (targetYawRate - state.yawRate) * yawBlend;
  } else {
    state.yawRate *= Math.max(0, 1 - 12 * safeDt);
  }

  state.heading += state.yawRate * safeDt;

  const effectiveGrip = state.handbrake && speedAbs > 4 ? spec.lateralGrip * 0.48 : spec.lateralGrip;
  vLateral *= Math.max(0, 1 - effectiveGrip * safeDt);

  const newSinH = Math.sin(state.heading);
  const newCosH = Math.cos(state.heading);
  const newRightX = -newCosH;
  const newRightZ = newSinH;

  state.vx = vForward * newSinH + vLateral * newRightX;
  state.vz = vForward * newCosH + vLateral * newRightZ;
  state.forwardSpeed = vForward;
  state.lateralSpeed = vLateral;

  const prevX = state.x;
  const prevZ = state.z;
  state.x += state.vx * safeDt;
  state.z += state.vz * safeDt;
  state.distanceDrivenM += Math.hypot(state.x - prevX, state.z - prevZ);

  state.wheelSpinAngle += (vForward / spec.wheelRadius) * safeDt;

  // 6. Suspension spring-damper pitch & roll
  const targetPitch =
    (accelLong - (brakeForceMag / spec.massKg) * Math.sign(vForward || 1)) *
    0.045 *
    spec.suspensionPitchScale *
    18;
  const clampedTargetPitch = Math.max(-0.075, Math.min(0.075, targetPitch));
  const lateralAccel = vForward * state.yawRate;
  const targetRoll = Math.max(
    -0.09,
    Math.min(0.09, lateralAccel * spec.suspensionRollScale * 0.28),
  );

  const springK = 36;
  const springD = 7.5;
  state.pitchVel += ((clampedTargetPitch - state.pitch) * springK - state.pitchVel * springD) * safeDt;
  state.pitch += state.pitchVel * safeDt;
  state.rollVel += ((targetRoll - state.roll) * springK - state.rollVel * springD) * safeDt;
  state.roll += state.rollVel * safeDt;

  // 7. Static World Bounds & OBB Colliders
  const halfW = spec.width * 0.5;
  const halfL = spec.length * 0.5;
  let maxImpulse = 0;

  const bound = WORLD_HALF_EXTENT - 4;
  if (state.x > bound) {
    state.x = bound;
    if (state.vx > 0) {
      maxImpulse = Math.max(maxImpulse, state.vx);
      state.vx *= -0.25;
    }
  } else if (state.x < -bound) {
    state.x = -bound;
    if (state.vx < 0) {
      maxImpulse = Math.max(maxImpulse, -state.vx);
      state.vx *= -0.25;
    }
  }
  if (state.z > bound) {
    state.z = bound;
    if (state.vz > 0) {
      maxImpulse = Math.max(maxImpulse, state.vz);
      state.vz *= -0.25;
    }
  } else if (state.z < -bound) {
    state.z = -bound;
    if (state.vz < 0) {
      maxImpulse = Math.max(maxImpulse, -state.vz);
      state.vz *= -0.25;
    }
  }

  for (let i = 0; i < colliders.length; i++) {
    const col = colliders[i];
    const maxR = halfL + Math.max(col.halfW, col.halfD) + 1.0;
    if (Math.abs(state.x - col.x) > maxR || Math.abs(state.z - col.z) > maxR) continue;

    const mtv = resolveObbVsAabb(state.x, state.z, state.heading, halfW, halfL, col);
    if (mtv) {
      state.x += mtv.nx * mtv.depth;
      state.z += mtv.nz * mtv.depth;
      const vn = state.vx * mtv.nx + state.vz * mtv.nz;
      if (vn < 0) {
        maxImpulse = Math.max(maxImpulse, -vn);
        state.vx -= (1 + 0.22) * vn * mtv.nx;
        state.vz -= (1 + 0.22) * vn * mtv.nz;
        state.vx *= 0.86;
        state.vz *= 0.86;
        state.forwardSpeed = state.vx * newSinH + state.vz * newCosH;
      }
    }
  }

  // 7.5 Collision with uncoupled parked trailers in bays (only blocks when cab drives into side/rear, allows sliding under kingpin from front!)
  for (let i = 0; i < worldTrailers.length; i++) {
    const wt = worldTrailers[i];
    if (wt.attached || wt === attachedTrailer) continue;
    const dx = state.x - wt.x;
    const dz = state.z - wt.z;
    if (dx * dx + dz * dz > 14 * 14) continue;
    // Allow tractor rear fifth wheel to slide gently near kingpin without harsh bounce
    const trSin = Math.sin(wt.heading);
    const trCos = Math.cos(wt.heading);
    const localRearZ = dx * trSin + dz * trCos;
    if (localRearZ > wt.kingpinToCenter - 1.5 && localRearZ < wt.length * 0.5 + 3.2) {
      // Tractor is aligning in front of kingpin: no harsh bounce so player can couple smoothly!
      continue;
    }
    // Simple OBB-proxy push against main trailer cargo body
    const dist = Math.hypot(dx, dz);
    const minDist = wt.width * 0.5 + spec.width * 0.45;
    if (Math.abs(localRearZ) < wt.length * 0.46 && dist < minDist && dist > 0.01) {
      const nx = dx / dist;
      const nz = dz / dist;
      state.x += nx * (minDist - dist);
      state.z += nz * (minDist - dist);
      const vn = state.vx * nx + state.vz * nz;
      if (vn < 0) {
        state.vx -= 1.1 * vn * nx;
        state.vz -= 1.1 * vn * nz;
        state.forwardSpeed = state.vx * newSinH + state.vz * newCosH;
      }
    }
  }

  // 8. Collision against Traffic Vehicles
  const playerRadius = (spec.width + spec.length) * 0.27;
  for (let i = 0; i < traffic.length; i++) {
    const tv = traffic[i];
    const tRadius = (tv.width + tv.length) * 0.27;
    const dx = state.x - tv.x;
    const dz = state.z - tv.z;
    const distSq = dx * dx + dz * dz;
    const minDist = playerRadius + tRadius * 0.85;
    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = minDist - dist;
      state.x += nx * overlap * 0.75;
      state.z += nz * overlap * 0.75;
      tv.x -= nx * overlap * 0.25;
      tv.z -= nz * overlap * 0.25;
      tv.speed = 0;
      tv.braking = true;
      tv.honkingTimer = 0.7;

      const relVx = state.vx - Math.sin(tv.heading) * tv.speed;
      const relVz = state.vz - Math.cos(tv.heading) * tv.speed;
      const vn = relVx * nx + relVz * nz;
      if (vn < 0) {
        maxImpulse = Math.max(maxImpulse, -vn);
        state.vx -= 1.25 * vn * nx;
        state.vz -= 1.25 * vn * nz;
        state.forwardSpeed = state.vx * newSinH + state.vz * newCosH;
      }
    }
  }

  // 8.5 Articulated Semi-Trailer Kingpin Kinematics & Trailer OBB Collisions
  if (attachedTrailer) {
    const tr = attachedTrailer;
    const curSinH = Math.sin(state.heading);
    const curCosH = Math.cos(state.heading);
    const hx = state.x + curSinH * HITCH_LOCAL_Z;
    const hz = state.z + curCosH * HITCH_LOCAL_Z;

    const vHitchX = state.vx + state.yawRate * curCosH * HITCH_LOCAL_Z;
    const vHitchZ = state.vz - state.yawRate * curSinH * HITCH_LOCAL_Z;

    const vPerp = vHitchX * -Math.cos(tr.heading) + vHitchZ * Math.sin(tr.heading);
    const trailerYawRate = -vPerp / tr.kingpinToAxle;
    tr.heading = normalizeAngle(tr.heading + trailerYawRate * safeDt);

    const artAngle = normalizeAngle(state.heading - tr.heading);
    const maxArt = 1.36;
    if (Math.abs(artAngle) > maxArt) {
      tr.heading = normalizeAngle(state.heading - Math.sign(artAngle) * maxArt);
      state.yawRate *= 0.35;
    }

    const trSin = Math.sin(tr.heading);
    const trCos = Math.cos(tr.heading);
    tr.x = hx - trSin * tr.kingpinToCenter;
    tr.z = hz - trCos * tr.kingpinToCenter;

    const vTrailerLong = vHitchX * trSin + vHitchZ * trCos;
    tr.wheelSpinAngle += (vTrailerLong / 0.52) * safeDt;

    const trHalfW = tr.width * 0.5;
    const trHalfL = tr.length * 0.5;
    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];
      const maxR = trHalfL + Math.max(col.halfW, col.halfD) + 1.0;
      if (Math.abs(tr.x - col.x) > maxR || Math.abs(tr.z - col.z) > maxR) continue;
      const mtv = resolveObbVsAabb(tr.x, tr.z, tr.heading, trHalfW, trHalfL, col);
      if (mtv) {
        tr.x += mtv.nx * mtv.depth;
        tr.z += mtv.nz * mtv.depth;
        state.x += mtv.nx * mtv.depth * 0.65;
        state.z += mtv.nz * mtv.depth * 0.65;
        const vn = state.vx * mtv.nx + state.vz * mtv.nz;
        if (vn < 0) {
          maxImpulse = Math.max(maxImpulse, -vn);
          state.vx -= 1.15 * vn * mtv.nx;
          state.vz -= 1.15 * vn * mtv.nz;
          state.forwardSpeed = state.vx * curSinH + state.vz * curCosH;
        }
        const nhx = state.x + curSinH * HITCH_LOCAL_Z;
        const nhz = state.z + curCosH * HITCH_LOCAL_Z;
        tr.x = nhx - trSin * tr.kingpinToCenter;
        tr.z = nhz - trCos * tr.kingpinToCenter;
      }
    }
  }

  if (maxImpulse > 1.6) {
    state.damageCount += 1;
    state.lastCollisionImpulse = maxImpulse;
  }

  return { collisionImpulse: maxImpulse };
}

export function evaluateParkingStatus(
  state: VehiclePhysicsState,
  spec: VehicleSpec,
  bays: ParkingBay[] = PARKING_BAYS,
): ParkingStatus {
  let nearest: ParkingBay | null = null;
  let minDist = Infinity;

  for (let i = 0; i < bays.length; i++) {
    const bay = bays[i];
    const d = Math.hypot(state.x - bay.x, state.z - bay.z);
    if (d < minDist) {
      minDist = d;
      nearest = bay;
    }
  }

  if (!nearest) {
    return {
      nearestBay: null,
      distanceM: 999,
      alignmentPct: 0,
      isInside: false,
      isParkedCleanly: false,
      frontClearanceM: 5,
      rearClearanceM: 5,
      leftClearanceM: 5,
      rightClearanceM: 5,
    };
  }

  let best = scorePoseInBay(state.x, state.z, state.heading, spec.width, spec.length, nearest);
  if (state.trailer) {
    const trScore = scorePoseInBay(
      state.trailer.x,
      state.trailer.z,
      state.trailer.heading,
      state.trailer.width,
      state.trailer.length,
      nearest,
    );
    if (trScore.alignmentPct > best.alignmentPct) {
      best = trScore;
    }
  }

  const isStopped = Math.abs(state.forwardSpeed) < 0.25 && (state.handbrake || state.braking);
  const isParkedCleanly = best.isInside && best.alignmentPct >= 75 && isStopped;

  return {
    nearestBay: nearest,
    distanceM: minDist,
    alignmentPct: best.alignmentPct,
    isInside: best.isInside,
    isParkedCleanly,
    frontClearanceM: best.frontClearanceM,
    rearClearanceM: best.rearClearanceM,
    leftClearanceM: best.leftClearanceM,
    rightClearanceM: best.rightClearanceM,
  };
}
