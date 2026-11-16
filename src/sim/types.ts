export type VehicleId = 'auman_8x4' | 'sport_coupe' | 'city_bus' | 'box_truck';

export type GearValue = 'R' | 'N' | 1 | 2 | 3 | 4 | 5 | 6;

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraMode = 'chase' | 'cab' | 'top' | 'orbit' | 'custom';

export interface CustomCameraSettings {
  distance: number;
  height: number;
  yawDeg: number; // relative to vehicle heading: 0 = behind, 180 = looking from front, 90 = side
  lookHeight: number;
}

export type TrailerVariant = 'container' | 'tanker' | 'flatbed';

export type TrailerLivery = 'auman_silver' | 'ocean_blue' | 'crimson_haul' | 'amber_chrome';

export interface VehicleSpec {
  id: VehicleId;
  name: string;
  subtitle: string;
  category: 'heavy_truck' | 'car' | 'bus' | 'cargo_truck';
  massKg: number;
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  wheelRadius: number;
  maxSteerRad: number;
  peakTorqueNm: number;
  idleRpm: number;
  redlineRpm: number;
  maxRpm: number;
  finalDrive: number;
  gearRatios: Record<GearValue, number>;
  maxBrakeForceN: number;
  dragCoeff: number;
  rollingResistance: number;
  lateralGrip: number;
  suspensionPitchScale: number;
  suspensionRollScale: number;
  /** Number of axles; twin-steer 8x4 has 4 axles where axles 0 and 1 steer */
  axlePositionsZ: number[];
  steerAxleIndices: number[];
  steerAxleRatios: number[];
  cabViewOffset: { x: number; y: number; z: number };
  chaseDistance: number;
  chaseHeight: number;
  enginePitchBaseHz: number;
  hasAirBrakes: boolean;
}

export interface GearboxState {
  gear: GearValue;
  rpm: number;
  clutch: number; // 0 = engaged (pedal up), 1 = disengaged (pedal pressed)
  stalled: boolean;
  autoClutch: boolean;
  shiftFlashTimer: number;
  lastShiftQuality: 'clean' | 'rev_match' | 'lug' | null;
}

export interface TrailerState {
  id: string;
  name: string;
  variant: TrailerVariant;
  livery: TrailerLivery;
  attached: boolean;
  x: number;
  z: number;
  heading: number;
  wheelSpinAngle: number;
  length: number;
  width: number;
  massKg: number;
  kingpinToCenter: number;
  kingpinToAxle: number;
  parkedBayId: string | null;
}

export interface VehiclePhysicsState {
  x: number;
  z: number;
  heading: number; // radians, 0 = +Z, forward = (sin(heading), cos(heading))
  vx: number; // world X velocity m/s
  vz: number; // world Z velocity m/s
  forwardSpeed: number; // signed m/s along heading
  lateralSpeed: number; // signed m/s perpendicular
  yawRate: number;
  steerAngle: number; // current front wheel steer angle (rad)
  wheelSpinAngle: number; // cumulative wheel rotation (rad)
  pitch: number; // rad (+ = nose up squat, - = nose down dive)
  pitchVel: number;
  roll: number; // rad
  rollVel: number;
  gearbox: GearboxState;
  handbrake: boolean;
  braking: boolean;
  throttleInput: number; // 0..1
  headlightsOn: boolean;
  roofLightsOn: boolean;
  distanceDrivenM: number;
  damageCount: number;
  lastCollisionImpulse: number;
  trailer: TrailerState | null;
}

export interface ControlInputs {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (right) .. +1 (left)
  clutch: boolean;
  handbrake: boolean;
}

export interface WorldBoxCollider {
  id: string;
  label: string;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  height: number;
  kind: 'building' | 'container' | 'bollard' | 'barrier' | 'pillar' | 'median';
}

export interface ParkingBay {
  id: string;
  name: string;
  difficulty: 'Standard' | 'Tight' | 'Precision';
  x: number;
  z: number;
  heading: number;
  reverseRecommended?: boolean;
  width: number;
  length: number;
  hint: string;
}

export interface ParkingStatus {
  nearestBay: ParkingBay | null;
  distanceM: number;
  alignmentPct: number; // 0..100
  isInside: boolean;
  isParkedCleanly: boolean;
  frontClearanceM: number;
  rearClearanceM: number;
  leftClearanceM: number;
  rightClearanceM: number;
}

export type TrafficKind = 'sedan' | 'taxi' | 'sport' | 'city_bus' | 'box_truck' | 'semi_tractor';

export interface TrafficWaypoint {
  x: number;
  z: number;
  speedLimitMs: number;
}

export interface TrafficVehicleState {
  id: string;
  kind: TrafficKind;
  colorHex: number;
  routeIndex: number;
  waypointIndex: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  targetSpeed: number;
  wheelSpin: number;
  length: number;
  width: number;
  braking: boolean;
  honkingTimer: number;
}

export interface PedestrianState {
  id: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  baseSpeed: number;
  walkPhase: number;
  role: 'worker' | 'civilian';
  shirtHex: number;
  pantsHex: number;
  waypoints: Array<{ x: number; z: number }>;
  wpIndex: number;
  waiting: boolean;
}

export interface HudSnapshot {
  speedKmh: number;
  rpm: number;
  redlineRpm: number;
  maxRpm: number;
  gear: GearValue;
  clutch: number;
  stalled: boolean;
  autoClutch: boolean;
  handbrake: boolean;
  braking: boolean;
  headlightsOn: boolean;
  roofLightsOn: boolean;
  trailerAttached: boolean;
  trailerSupported: boolean;
  activeTrailerName: string | null;
  activeTrailerVariant: TrailerVariant;
  activeTrailerLivery: TrailerLivery;
  nearbyHookableTrailer: string | null;
  trailerActionNotice: string | null;
  trailersDeliveredCount: number;
  vehicleId: VehicleId;
  vehicleName: string;
  zoneName: string;
  distanceKm: number;
  collisions: number;
  baysCompleted: string[];
  parking: ParkingStatus;
  cameraMode: CameraMode;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  trafficDots: Array<{ x: number; z: number; kind: TrafficKind }>;
  trailerDots: Array<{ x: number; z: number; attached: boolean }>;
}

