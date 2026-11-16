import type { GearValue, GearboxState, VehicleSpec } from './types';

export const GEAR_SEQUENCE: GearValue[] = ['R', 'N', 1, 2, 3, 4, 5, 6];

export function createInitialGearbox(spec: VehicleSpec, autoClutch = true): GearboxState {
  return {
    gear: 'N',
    rpm: spec.idleRpm,
    clutch: 0,
    stalled: false,
    autoClutch,
    shiftFlashTimer: 0,
    lastShiftQuality: null,
  };
}

export function getTorqueMultiplier(rpm: number, spec: VehicleSpec): number {
  const norm = Math.max(
    0,
    Math.min(1, (rpm - spec.idleRpm) / Math.max(1, spec.redlineRpm - spec.idleRpm)),
  );
  // Diesel / performance torque curve: strong low-mid punch, tapers slightly near redline
  if (spec.category === 'heavy_truck' || spec.category === 'bus' || spec.category === 'cargo_truck') {
    // Broad flat diesel torque plateau between 20% and 75% of RPM band
    if (norm < 0.2) return 0.65 + (norm / 0.2) * 0.35;
    if (norm < 0.78) return 1.0;
    return 1.0 - ((norm - 0.78) / 0.22) * 0.28;
  }
  // Petrol coupe: builds toward higher RPM peak
  if (norm < 0.3) return 0.58 + (norm / 0.3) * 0.32;
  if (norm < 0.85) return 0.9 + ((norm - 0.3) / 0.55) * 0.12;
  return 1.02 - ((norm - 0.85) / 0.15) * 0.18;
}

export function shiftGearUp(
  gb: GearboxState,
  forwardSpeed: number,
  spec: VehicleSpec,
): { next: GearboxState; shifted: boolean } {
  const idx = GEAR_SEQUENCE.indexOf(gb.gear);
  if (idx >= GEAR_SEQUENCE.length - 1) return { next: gb, shifted: false };
  const target = GEAR_SEQUENCE[idx + 1];
  // Prevent slamming from Reverse into 1st while reversing fast (> 3 m/s)
  if (gb.gear === 'R' && forwardSpeed < -3.0 && target !== 'N') {
    return { next: { ...gb, gear: 'N', shiftFlashTimer: 0.2 }, shifted: true };
  }
  return applyGearChange(gb, target, forwardSpeed, spec);
}

export function shiftGearDown(
  gb: GearboxState,
  forwardSpeed: number,
  spec: VehicleSpec,
): { next: GearboxState; shifted: boolean } {
  const idx = GEAR_SEQUENCE.indexOf(gb.gear);
  if (idx <= 0) return { next: gb, shifted: false };
  const target = GEAR_SEQUENCE[idx - 1];
  // Prevent shifting into Reverse while rolling forward > 2.2 m/s
  if (target === 'R' && forwardSpeed > 2.2) {
    return { next: gb, shifted: false };
  }
  return applyGearChange(gb, target, forwardSpeed, spec);
}

export function setDirectGear(
  gb: GearboxState,
  target: GearValue,
  forwardSpeed: number,
  spec: VehicleSpec,
): { next: GearboxState; shifted: boolean } {
  if (gb.gear === target) return { next: gb, shifted: false };
  if (target === 'R' && forwardSpeed > 2.2) return { next: gb, shifted: false };
  if (gb.gear === 'R' && forwardSpeed < -3.0 && target !== 'N') return { next: gb, shifted: false };
  return applyGearChange(gb, target, forwardSpeed, spec);
}

function applyGearChange(
  gb: GearboxState,
  target: GearValue,
  forwardSpeed: number,
  spec: VehicleSpec,
): { next: GearboxState; shifted: boolean } {
  const ratio = spec.gearRatios[target];
  let quality: GearboxState['lastShiftQuality'] = 'clean';
  if (target !== 'N' && ratio !== 0) {
    const wheelRpm = (forwardSpeed / spec.wheelRadius) * (60 / (2 * Math.PI));
    const projectedEngineRpm = wheelRpm * ratio * spec.finalDrive;
    if (Math.abs(projectedEngineRpm - gb.rpm) < 350 && Math.abs(forwardSpeed) > 1.5) {
      quality = 'rev_match';
    } else if (projectedEngineRpm > 0 && projectedEngineRpm < spec.idleRpm * 0.78 && Math.abs(forwardSpeed) > 0.5) {
      quality = 'lug';
    }
  }
  return {
    shifted: true,
    next: {
      ...gb,
      gear: target,
      shiftFlashTimer: 0.24,
      lastShiftQuality: quality,
    },
  };
}

export interface DrivetrainStepResult {
  gearbox: GearboxState;
  driveForceN: number;
  engineBrakeForceN: number;
}

export function stepGearboxAndDrivetrain(
  gb: GearboxState,
  spec: VehicleSpec,
  forwardSpeed: number,
  throttle: number,
  clutchPressed: boolean,
  dt: number,
): DrivetrainStepResult {
  const ratio = spec.gearRatios[gb.gear];
  const shiftFlashTimer = Math.max(0, gb.shiftFlashTimer - dt);

  // Determine effective clutch disengagement (0 = fully locked, 1 = fully disengaged)
  let effectiveClutch = clutchPressed ? 1 : 0;

  if (!clutchPressed && gb.autoClutch) {
    // Auto-clutch smoothly slips at launch speed in 1st/R or during brief shift flash
    if (shiftFlashTimer > 0.08) {
      effectiveClutch = 0.88;
    } else if (gb.gear === 1 || gb.gear === 'R') {
      const launchSlipSpeed = 2.8;
      if (Math.abs(forwardSpeed) < launchSlipSpeed) {
        const slip = 1 - Math.abs(forwardSpeed) / launchSlipSpeed;
        effectiveClutch = throttle > 0.05 ? slip * 0.72 : 0.92;
      }
    }
  }

  // Wheel RPM from road speed (signed)
  const wheelRadPerSec = forwardSpeed / spec.wheelRadius;
  const wheelRpm = (wheelRadPerSec * 60) / (2 * Math.PI);
  const coupledEngineRpm = ratio !== 0 ? wheelRpm * ratio * spec.finalDrive : spec.idleRpm;

  let rpm = gb.rpm;
  let stalled = gb.stalled;

  // Auto-recover stall if user presses clutch or shifts to Neutral with throttle
  if (stalled && (clutchPressed || (gb.gear === 'N' && throttle > 0.1))) {
    stalled = false;
    rpm = spec.idleRpm;
  }

  if (stalled) {
    rpm = Math.max(0, rpm - 1600 * dt);
    return {
      gearbox: {
        ...gb,
        rpm,
        clutch: effectiveClutch,
        stalled: true,
        shiftFlashTimer,
      },
      driveForceN: 0,
      engineBrakeForceN: Math.abs(forwardSpeed) > 0.2 && effectiveClutch < 0.5 ? -Math.sign(forwardSpeed) * 900 : 0,
    };
  }

  // Free-revving target RPM when in Neutral or clutch pressed
  const revCeiling = spec.redlineRpm + 180;
  const freeTargetRpm = spec.idleRpm + throttle * (revCeiling - spec.idleRpm);

  if (gb.gear === 'N' || ratio === 0) {
    const rate = throttle > 0.05 ? 6.5 : 3.2;
    rpm += (freeTargetRpm - rpm) * Math.min(1, rate * dt);
  } else {
    const engagement = 1 - effectiveClutch;
    // Blend between free-revving RPM and wheel-coupled RPM
    const slipBoost = throttle * (spec.category === 'heavy_truck' ? 580 : 1200) * effectiveClutch;
    const targetRpm =
      effectiveClutch > 0.85
        ? freeTargetRpm
        : Math.max(spec.idleRpm * 0.55, coupledEngineRpm + slipBoost) * engagement +
          freeTargetRpm * effectiveClutch;

    const blendRate = 8.0 + engagement * 12.0;
    rpm += (targetRpm - rpm) * Math.min(1, blendRate * dt);
  }

  // Soft rev limiter bounce
  if (rpm > spec.maxRpm) {
    rpm = spec.maxRpm - (rpm - spec.maxRpm) * 0.4;
  }

  // Stall check: in high gear (2..6) at very low speed with clutch engaged and low RPM
  if (
    gb.gear !== 'N' &&
    effectiveClutch < 0.25 &&
    ((!gb.autoClutch && rpm < spec.idleRpm * 0.58) ||
      (gb.autoClutch && typeof gb.gear === 'number' && gb.gear >= 3 && Math.abs(forwardSpeed) < 1.0 && throttle < 0.15))
  ) {
    stalled = true;
  }

  rpm = Math.max(0, Math.min(spec.maxRpm, rpm));

  // Compute longitudinal drive force at wheels
  let driveForceN = 0;
  let engineBrakeForceN = 0;

  if (gb.gear !== 'N' && ratio !== 0 && !stalled) {
    const engagement = Math.max(0, 1 - effectiveClutch);
    const revLimiterCut = rpm >= spec.redlineRpm + 140 ? 0.15 : 1.0;
    const torqueMult = getTorqueMultiplier(Math.max(rpm, spec.idleRpm), spec);
    const engineTorque = spec.peakTorqueNm * torqueMult * throttle * revLimiterCut;
    const wheelTorque = engineTorque * ratio * spec.finalDrive * 0.88; // ~12% drivetrain loss
    driveForceN = (wheelTorque / spec.wheelRadius) * engagement;

    // Engine braking when off throttle in gear and rolling
    if (throttle < 0.05 && Math.abs(forwardSpeed) > 0.6 && effectiveClutch < 0.5) {
      const gearRatioMag = Math.abs(ratio);
      engineBrakeForceN =
        -Math.sign(forwardSpeed) *
        (spec.massKg * 0.085) *
        Math.min(3.5, gearRatioMag * 0.55) *
        (1 - effectiveClutch);
    }
  }

  return {
    gearbox: {
      ...gb,
      rpm,
      clutch: effectiveClutch,
      stalled,
      shiftFlashTimer,
    },
    driveForceN,
    engineBrakeForceN,
  };
}
