import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialGearbox,
  setDirectGear,
  shiftGearDown,
  shiftGearUp,
  stepGearboxAndDrivetrain,
} from './gearbox';
import { createInitialPedestrians, stepPedestrians } from './pedestrians';
import { createInitialTraffic, stepTrafficAI } from './trafficAI';
import {
  HITCH_LOCAL_Z,
  TRAILER_LENGTH,
  TRAILER_WIDTH,
  createInitialVehicleState,
  createInitialWorldTrailers,
  evaluateParkingStatus,
  findNearbyHookableTrailer,
  resolveObbVsAabb,
  stepVehiclePhysics,
  toggleTrailerCoupling,
  toggleWorldTrailerCoupling,
} from './vehiclePhysics';
import { VEHICLE_SPECS } from './vehicles';
import { PARKING_BAYS, WORLD_COLLIDERS } from './worldData';

test('manual gearbox shifts sequentially across R, N, 1..6 and guards Reverse at speed', () => {
  const spec = VEHICLE_SPECS.auman_8x4;
  let gb = createInitialGearbox(spec, true);
  assert.equal(gb.gear, 'N');

  // Shift up from N -> 1 -> 2
  let res = shiftGearUp(gb, 0, spec);
  assert.equal(res.shifted, true);
  assert.equal(res.next.gear, 1);

  res = shiftGearUp(res.next, 4.0, spec);
  assert.equal(res.shifted, true);
  assert.equal(res.next.gear, 2);

  // Shift down to N -> R when stationary
  res = shiftGearDown(gb, 0, spec);
  assert.equal(res.shifted, true);
  assert.equal(res.next.gear, 'R');

  // Guard: cannot shift from N into Reverse while rolling forward fast
  const blockedRev = shiftGearDown(gb, 6.0, spec);
  assert.equal(blockedRev.shifted, false);
  assert.equal(blockedRev.next.gear, 'N');
});

test('clutch disengagement lets engine rev freely without applying drive force', () => {
  const spec = VEHICLE_SPECS.auman_8x4;
  let gb = createInitialGearbox(spec, false);
  gb = setDirectGear(gb, 1, 0, spec).next;

  const stepWithClutch = stepGearboxAndDrivetrain(gb, spec, 0, 1.0, 1, 0.04);
  assert.equal(stepWithClutch.driveForceN, 0);
  assert.ok(stepWithClutch.gearbox.rpm > spec.idleRpm);

  const stepWithPartialClutch = stepGearboxAndDrivetrain(gb, spec, 0, 1.0, 0.4, 0.04);
  assert.equal(stepWithPartialClutch.gearbox.clutch, 0.4);
  assert.ok(stepWithPartialClutch.driveForceN > 0);

  const stepEngaged = stepGearboxAndDrivetrain(
    { ...gb, rpm: 1400 },
    spec,
    2.5,
    1.0,
    0,
    0.04,
  );
  assert.ok(stepEngaged.driveForceN > 5000);
});

test('8x4 tractor accelerates in 1st gear, steers left, and brakes to a stop', () => {
  const spec = VEHICLE_SPECS.auman_8x4;
  const state = createInitialVehicleState(spec, { x: 0, z: 0, heading: 0 }, true);
  state.handbrake = false;
  state.gearbox = setDirectGear(state.gearbox, 1, 0, spec).next;

  // Accelerate straight for 2 seconds
  for (let i = 0; i < 50; i++) {
    stepVehiclePhysics(
      state,
      spec,
      { throttle: 1, brake: 0, steer: 0, clutch: 0, handbrake: false },
      0.04,
      [],
      [],
    );
  }
  assert.ok(state.forwardSpeed > 4.0, `Expected forward speed > 4 m/s, got ${state.forwardSpeed}`);
  assert.ok(state.z > 3.0, `Expected forward travel along +Z, got ${state.z}`);

  // Steer left (+1) for 1 second -> heading should increase
  const headingBefore = state.heading;
  for (let i = 0; i < 25; i++) {
    stepVehiclePhysics(
      state,
      spec,
      { throttle: 0.7, brake: 0, steer: 1, clutch: 0, handbrake: false },
      0.04,
      [],
      [],
    );
  }
  assert.ok(state.heading > headingBefore + 0.1, 'Steering left should increase heading');

  // Brake to stop
  for (let i = 0; i < 80; i++) {
    stepVehiclePhysics(
      state,
      spec,
      { throttle: 0, brake: 1, steer: 0, clutch: 0, handbrake: false },
      0.04,
      [],
      [],
    );
  }
  assert.ok(Math.abs(state.forwardSpeed) < 0.15, `Expected stop, got ${state.forwardSpeed}`);
});

test('OBB vs AABB resolves wall penetration and prevents spawning inside depot buildings', () => {
  const spec = VEHICLE_SPECS.auman_8x4;
  const state = createInitialVehicleState(spec);
  for (const col of WORLD_COLLIDERS) {
    const mtv = resolveObbVsAabb(state.x, state.z, state.heading, spec.width * 0.5, spec.length * 0.5, col);
    assert.equal(mtv, null, `Hero spawn overlapped collider ${col.id}`);
  }

  // Test deliberate penetration into a barrier
  const box = WORLD_COLLIDERS[0];
  const mtv = resolveObbVsAabb(box.x + box.halfW + 0.3, box.z, 0, 1.25, 3.8, box);
  assert.ok(mtv !== null && mtv.depth > 0.5);
});

test('parking evaluation detects clean alignment inside Depot Bay #1', () => {
  const spec = VEHICLE_SPECS.auman_8x4;
  const bay = PARKING_BAYS[0];
  const state = createInitialVehicleState(spec, { x: bay.x, z: bay.z, heading: bay.heading }, true);
  state.handbrake = true;
  state.forwardSpeed = 0;

  const status = evaluateParkingStatus(state, spec, PARKING_BAYS);
  assert.equal(status.nearestBay?.id, bay.id);
  assert.equal(status.isInside, true);
  assert.ok(status.alignmentPct >= 95);
  assert.equal(status.isParkedCleanly, true);
});

test('traffic AI includes diverse vehicle kinds and brakes behind player obstacle', () => {
  const traffic = createInitialTraffic();
  const kinds = new Set(traffic.map((t) => t.kind));
  assert.ok(kinds.has('sedan') && kinds.has('city_bus') && kinds.has('box_truck') && kinds.has('semi_tractor'));

  // Place player 10.5m ahead in lead's lane (within lookahead, enough stopping room from 18 m/s highway speed)
  const lead = traffic[0];
  const fakePlayer = {
    x: lead.x + Math.sin(lead.heading) * 10.5,
    z: lead.z + Math.cos(lead.heading) * 10.5,
  };
  const initialSpeed = lead.speed;
  for (let i = 0; i < 45; i++) {
    stepTrafficAI(traffic, fakePlayer, 0.04);
  }
  assert.ok(lead.speed < initialSpeed * 0.3, 'Traffic should brake smoothly when player blocks lane');
  assert.equal(lead.braking, true);
});

test('8x4 tractor spawns with coupled trailer that articulates on turns, decouples, and collides cleanly', () => {
  const spec = VEHICLE_SPECS.auman_8x4;
  const state = createInitialVehicleState(spec, { x: -24, z: -8, heading: 0 }, true);
  assert.ok(state.trailer !== null && state.trailer.attached === true);

  // Verify initial coupled trailer does not overlap any depot collider
  for (const col of WORLD_COLLIDERS) {
    const mtv = resolveObbVsAabb(
      state.trailer.x,
      state.trailer.z,
      state.trailer.heading,
      TRAILER_WIDTH * 0.5,
      TRAILER_LENGTH * 0.5,
      col,
    );
    assert.equal(mtv, null, `Coupled trailer at hero spawn overlapped collider ${col.id}`);
  }

  // Drive forward in 1st gear and turn left -> trailer heading should follow tractor heading smoothly within jackknife limit
  state.gearbox = setDirectGear(state.gearbox, 1, 0, spec).next;
  for (let i = 0; i < 90; i++) {
    stepVehiclePhysics(
      state,
      spec,
      { throttle: 1, brake: 0, steer: 0.75, clutch: 0, handbrake: false },
      0.04,
      [],
      [],
    );
  }
  assert.ok(state.heading > 0.35, `Expected tractor to turn left, heading=${state.heading}`);
  assert.ok(state.trailer.heading > 0.15, `Expected trailer to articulate into turn, heading=${state.trailer.heading}`);
  assert.ok(Math.abs(state.heading - state.trailer.heading) <= 1.37, 'Trailer articulation stayed within jackknife limit');

  // Uncouple trailer and verify tractor pulls away while trailer stays parked
  const uncoupleRes = toggleTrailerCoupling(state, spec);
  assert.equal(uncoupleRes.changed, true);
  assert.equal(uncoupleRes.attached, false);
  const droppedX = state.trailer.x;
  const droppedZ = state.trailer.z;

  for (let i = 0; i < 20; i++) {
    stepVehiclePhysics(
      state,
      spec,
      { throttle: 1, brake: 0, steer: 0, clutch: 0, handbrake: false },
      0.04,
      [],
      [],
    );
  }
  assert.equal(state.trailer.x, droppedX);
  assert.equal(state.trailer.z, droppedZ);

  // Too far away to re-couple
  const tooFarRes = toggleTrailerCoupling(state, spec);
  assert.equal(tooFarRes.changed, false);
  assert.equal(tooFarRes.attached, false);
});

test('all initial world trailers spawn cleanly without overlapping static colliders', () => {
  const worldTrailers = createInitialWorldTrailers();
  assert.equal(worldTrailers.length, 4);

  for (const tr of worldTrailers) {
    for (const col of WORLD_COLLIDERS) {
      const mtv = resolveObbVsAabb(tr.x, tr.z, tr.heading, tr.width * 0.5, tr.length * 0.5, col);
      assert.equal(mtv, null, `Trailer ${tr.id} overlapped collider ${col.id}`);
    }
  }
});

test('real bay drop-and-hook delivers trailer in bay and hooks another parked bay trailer', () => {
  const spec = VEHICLE_SPECS.auman_8x4;
  const worldTrailers = createInitialWorldTrailers();
  const starter = worldTrailers[0];
  const bay = PARKING_BAYS[0];

  // Position tractor so its coupled trailer sits squarely inside Bay #1
  const sinB = Math.sin(bay.heading);
  const cosB = Math.cos(bay.heading);
  const tractorX = bay.x + sinB * (starter.kingpinToCenter - HITCH_LOCAL_Z);
  const tractorZ = bay.z + cosB * (starter.kingpinToCenter - HITCH_LOCAL_Z);
  const state = createInitialVehicleState(
    spec,
    { x: tractorX, z: tractorZ, heading: bay.heading },
    true,
    true,
    starter,
  );

  // Drop starter trailer inside Bay #1
  const dropRes = toggleWorldTrailerCoupling(state, spec, worldTrailers, PARKING_BAYS);
  assert.equal(dropRes.changed, true);
  assert.equal(dropRes.attached, false);
  assert.equal(dropRes.droppedInBay?.id, 'bay_depot_apron');
  assert.equal(starter.parkedBayId, 'bay_depot_apron');
  assert.equal(state.trailer, null);

  // Move tractor to align its fifth-wheel with the parked 40ft container trailer (worldTrailers[1])
  const containerTr = worldTrailers[1];
  const kx = containerTr.x + Math.sin(containerTr.heading) * containerTr.kingpinToCenter;
  const kz = containerTr.z + Math.cos(containerTr.heading) * containerTr.kingpinToCenter;
  state.x = kx - Math.sin(containerTr.heading) * HITCH_LOCAL_Z;
  state.z = kz - Math.cos(containerTr.heading) * HITCH_LOCAL_Z;
  state.heading = containerTr.heading;

  const nearby = findNearbyHookableTrailer(state, worldTrailers);
  assert.equal(nearby?.id, containerTr.id);

  const hookRes = toggleWorldTrailerCoupling(state, spec, worldTrailers, PARKING_BAYS);
  assert.equal(hookRes.changed, true);
  assert.equal(hookRes.attached, true);
  assert.equal(hookRes.trailer?.id, containerTr.id);
  assert.equal(hookRes.trailer?.variant, 'container');
  assert.equal(containerTr.parkedBayId, null);
});

test('pedestrians advance walkPhase when unobstructed and yield near player vehicle', () => {
  const peds = createInitialPedestrians();
  assert.ok(peds.length >= 30, `Expected bustling city pedestrians, got ${peds.length}`);

  const lead = peds[0];
  const initialPhase = lead.walkPhase;
  const initialX = lead.x;
  const initialZ = lead.z;

  for (let i = 0; i < 15; i++) {
    stepPedestrians(peds, { x: 999, z: 999 }, [], 0.04);
  }
  assert.ok(lead.walkPhase > initialPhase, 'Pedestrian walkPhase should advance when walking');
  assert.ok(Math.hypot(lead.x - initialX, lead.z - initialZ) > 0.2, 'Pedestrian should move along sidewalk');
  assert.equal(lead.waiting, false);

  // Place player directly 3.5m ahead along pedestrian heading -> should yield and pause
  const aheadPlayer = {
    x: lead.x + Math.sin(lead.heading) * 3.5,
    z: lead.z + Math.cos(lead.heading) * 3.5,
  };
  for (let i = 0; i < 20; i++) {
    stepPedestrians(peds, aheadPlayer, [], 0.04);
  }
  assert.equal(lead.waiting, true);
  assert.ok(lead.speed < 0.25, `Expected yielding pedestrian to slow down, got ${lead.speed}`);
});


