import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ProceduralVehicleAudio } from '../audio/engineAudio';
import { setDirectGear, shiftGearDown, shiftGearUp } from '../sim/gearbox';
import { createInitialPedestrians, stepPedestrians } from '../sim/pedestrians';
import { createInitialTraffic, stepTrafficAI } from '../sim/trafficAI';
import type {
  CameraMode,
  ControlInputs,
  CustomCameraSettings,
  DriveControlKey,
  GamePhase,
  GearValue,
  HudSnapshot,
  TrailerLivery,
  TrailerState,
  TrailerVariant,
  VehicleId,
  VehiclePhysicsState,
} from '../sim/types';
import {
  HERO_SPAWN,
  HITCH_LOCAL_Z,
  TRAILER_VARIANT_SPECS,
  createInitialVehicleState,
  createInitialWorldTrailers,
  createTrailerState,
  evaluateParkingStatus,
  findNearbyHookableTrailer,
  stepVehiclePhysics,
  toggleWorldTrailerCoupling,
} from '../sim/vehiclePhysics';
import { VEHICLE_ORDER, VEHICLE_SPECS } from '../sim/vehicles';
import { PARKING_BAYS, getZoneName } from '../sim/worldData';
import { buildPedestrianMesh, type PedestrianMeshHandle } from '../three/pedestrianModels';
import { createContactShadowTexture } from '../three/proceduralTextures';
import {
  type SemiTrailerRig,
  type TrafficMeshHandle,
  type VehicleRig,
  buildPlayerVehicleRig,
  buildSemiTrailerRig,
  buildTrafficVehicleMesh,
} from '../three/vehicleModels';
import { buildSimulationWorld } from '../three/worldBuilder';

export interface GameController {
  switchVehicle: (id: VehicleId) => void;
  cycleVehicle: () => void;
  shiftUp: () => void;
  shiftDown: () => void;
  setGear: (gear: GearValue) => void;
  setDriveControl: (key: DriveControlKey, amount: number) => void;
  toggleHandbrake: () => void;
  toggleAutoClutch: () => void;
  toggleLights: () => void;
  toggleTrailer: () => void;
  customizeTrailer: (variant: TrailerVariant, livery: TrailerLivery) => void;
  cycleCamera: () => void;
  setCameraMode: (mode: CameraMode) => void;
  setCustomCamera: (settings: CustomCameraSettings) => void;
  resetVehicle: () => void;
  teleportToBay: (bayId: string) => void;
  honk: () => void;
  toggleMute: () => boolean;
  initAudio: () => void;
}

interface GameCanvasProps {
  phase: GamePhase;
  selectedVehicle: VehicleId;
  customCamera: CustomCameraSettings;
  onCustomCameraChange: (next: CustomCameraSettings) => void;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onPhaseChange: (nextPhase: GamePhase) => void;
  onBayCompleted: (bayId: string, bayName: string) => void;
  onMuteChange: (muted: boolean) => void;
}

const CAMERA_MODES: CameraMode[] = ['chase', 'cab', 'top', 'orbit', 'custom'];

// Pre-allocated scratch helpers (Zero-GC render loop)
const _camDesired = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _tempColor = new THREE.Color();

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  scale: number;
  isSpark: boolean;
}

const PARTICLE_POOL_SIZE = 48;

export const GameCanvas = forwardRef<GameController, GameCanvasProps>(function GameCanvas(
  {
    phase,
    selectedVehicle,
    customCamera,
    onCustomCameraChange,
    onHudUpdate,
    onPhaseChange,
    onBayCompleted,
    onMuteChange,
  },
  ref,
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;
  const driveControlsRef = useRef<Record<DriveControlKey, number> | null>(null);

  const customCamRef = useRef<CustomCameraSettings>(customCamera);
  customCamRef.current = customCamera;

  const callbacksRef = useRef({
    onCustomCameraChange,
    onHudUpdate,
    onPhaseChange,
    onBayCompleted,
    onMuteChange,
  });
  callbacksRef.current = {
    onCustomCameraChange,
    onHudUpdate,
    onPhaseChange,
    onBayCompleted,
    onMuteChange,
  };

  const simRef = useRef<{
    vehicleId: VehicleId;
    playerState: VehiclePhysicsState;
    worldTrailers: TrailerState[];
    syncTrailerMesh: (tr: TrailerState) => void;
    rebuildAllTrailers: () => void;
    cameraMode: CameraMode;
    baysCompleted: Set<string>;
    parkHoldTimer: number;
    trailersDeliveredCount: number;
    trailerNotice: string | null;
    trailerNoticeTimer: number;
    audio: ProceduralVehicleAudio;
    switchRig: (id: VehicleId) => void;
    spawnParticles: (x: number, y: number, z: number, count: number, isSpark: boolean) => void;
    hitstopTimer: number;
    shakeTrauma: number;
    orbitAngle: number;
    snapCamera: boolean;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    initAudio: () => {
      simRef.current?.audio.init();
    },
    switchVehicle: (id: VehicleId) => {
      const sim = simRef.current;
      if (!sim || sim.vehicleId === id) return;
      sim.audio.init();
      sim.switchRig(id);
    },
    cycleVehicle: () => {
      const sim = simRef.current;
      if (!sim) return;
      sim.audio.init();
      const idx = VEHICLE_ORDER.indexOf(sim.vehicleId);
      const nextId = VEHICLE_ORDER[(idx + 1) % VEHICLE_ORDER.length];
      sim.switchRig(nextId);
    },
    shiftUp: () => {
      const sim = simRef.current;
      if (!sim) return;
      sim.audio.init();
      const spec = VEHICLE_SPECS[sim.vehicleId];
      const res = shiftGearUp(sim.playerState.gearbox, sim.playerState.forwardSpeed, spec);
      if (res.shifted) {
        sim.playerState.gearbox = res.next;
        sim.audio.playGearShift();
      }
    },
    shiftDown: () => {
      const sim = simRef.current;
      if (!sim) return;
      sim.audio.init();
      const spec = VEHICLE_SPECS[sim.vehicleId];
      const res = shiftGearDown(sim.playerState.gearbox, sim.playerState.forwardSpeed, spec);
      if (res.shifted) {
        sim.playerState.gearbox = res.next;
        sim.audio.playGearShift();
      }
    },
    setDriveControl: (key: DriveControlKey, amount: number) => {
      const driveControls = driveControlsRef.current;
      if (!driveControls) return;
      driveControls[key] = Math.max(0, Math.min(1, amount));
      if (amount > 0) {
        simRef.current?.audio.init();
      }
    },
    setGear: (gear: GearValue) => {
      const sim = simRef.current;
      if (!sim) return;
      sim.audio.init();
      const spec = VEHICLE_SPECS[sim.vehicleId];
      const res = setDirectGear(sim.playerState.gearbox, gear, sim.playerState.forwardSpeed, spec);
      if (res.shifted) {
        sim.playerState.gearbox = res.next;
        sim.audio.playGearShift();
      }
    },
    toggleHandbrake: () => {
      const sim = simRef.current;
      if (!sim) return;
      sim.audio.init();
      sim.playerState.handbrake = !sim.playerState.handbrake;
      if (VEHICLE_SPECS[sim.vehicleId].hasAirBrakes) {
        sim.audio.playAirBrakeHiss();
      }
    },
    toggleAutoClutch: () => {
      const sim = simRef.current;
      if (!sim) return;
      sim.playerState.gearbox.autoClutch = !sim.playerState.gearbox.autoClutch;
    },
    toggleLights: () => {
      const sim = simRef.current;
      if (!sim) return;
      sim.playerState.headlightsOn = !sim.playerState.headlightsOn;
      sim.playerState.roofLightsOn = sim.playerState.headlightsOn;
    },
    toggleTrailer: () => {
      const sim = simRef.current;
      if (!sim) return;
      sim.audio.init();
      const spec = VEHICLE_SPECS[sim.vehicleId];
      const res = toggleWorldTrailerCoupling(sim.playerState, spec, sim.worldTrailers, PARKING_BAYS);
      sim.trailerNotice = res.message;
      sim.trailerNoticeTimer = 3.6;
      if (res.changed) {
        sim.audio.playAirBrakeHiss();
        if (res.droppedInBay) {
          sim.trailersDeliveredCount += 1;
          sim.baysCompleted.add(res.droppedInBay.id);
          sim.audio.playParkLockChime();
        }
      }
    },
    customizeTrailer: (variant: TrailerVariant, livery: TrailerLivery) => {
      const sim = simRef.current;
      if (!sim) return;
      sim.audio.init();
      const vSpec = TRAILER_VARIANT_SPECS[variant];
      const liveryTitle =
        livery === 'auman_silver'
          ? 'Auman Galaxy'
          : livery === 'ocean_blue'
            ? 'Pacific'
            : livery === 'crimson_haul'
              ? 'Apex'
              : 'Energy';
      const customName = `${liveryTitle} ${vSpec.label}`;

      if (sim.playerState.trailer && sim.playerState.trailer.attached) {
        const tr = sim.playerState.trailer;
        tr.variant = variant;
        tr.livery = livery;
        tr.name = customName;
        tr.length = vSpec.length;
        tr.width = vSpec.width;
        tr.massKg = vSpec.massKg;
        tr.kingpinToCenter = vSpec.kingpinToCenter;
        tr.kingpinToAxle = vSpec.kingpinToAxle;
        const sinH = Math.sin(sim.playerState.heading);
        const cosH = Math.cos(sim.playerState.heading);
        const hx = sim.playerState.x + sinH * HITCH_LOCAL_Z;
        const hz = sim.playerState.z + cosH * HITCH_LOCAL_Z;
        tr.x = hx - Math.sin(tr.heading) * tr.kingpinToCenter;
        tr.z = hz - Math.cos(tr.heading) * tr.kingpinToCenter;
        sim.syncTrailerMesh(tr);
        sim.trailerNotice = `Custom build ready: ${customName}`;
        sim.trailerNoticeTimer = 3.4;
      } else {
        // Spawn or update a custom trailer right in Depot Bay #1 so the driver can back in & hook it!
        const bay = PARKING_BAYS[0];
        let depotTr = sim.worldTrailers.find((t) => t.id === 'tr_custom_bay1');
        if (!depotTr) {
          depotTr = createTrailerState(
            'tr_custom_bay1',
            customName,
            variant,
            livery,
            bay.x,
            bay.z,
            bay.heading,
            false,
            bay.id,
          );
          sim.worldTrailers.push(depotTr);
        } else {
          depotTr.name = customName;
          depotTr.variant = variant;
          depotTr.livery = livery;
          depotTr.length = vSpec.length;
          depotTr.width = vSpec.width;
          depotTr.massKg = vSpec.massKg;
          depotTr.kingpinToCenter = vSpec.kingpinToCenter;
          depotTr.kingpinToAxle = vSpec.kingpinToAxle;
          depotTr.x = bay.x;
          depotTr.z = bay.z;
          depotTr.heading = bay.heading;
          depotTr.attached = false;
          depotTr.parkedBayId = bay.id;
        }
        sim.syncTrailerMesh(depotTr);
        sim.trailerNotice = `Staged ${customName} in ${bay.name}`;
        sim.trailerNoticeTimer = 4.0;
      }
    },
    cycleCamera: () => {
      const sim = simRef.current;
      if (!sim) return;
      const idx = CAMERA_MODES.indexOf(sim.cameraMode);
      sim.cameraMode = CAMERA_MODES[(idx + 1) % CAMERA_MODES.length];
      sim.snapCamera = true;
    },
    setCameraMode: (mode: CameraMode) => {
      if (simRef.current) {
        simRef.current.cameraMode = mode;
        simRef.current.snapCamera = true;
      }
    },
    setCustomCamera: (settings: CustomCameraSettings) => {
      customCamRef.current = settings;
      callbacksRef.current.onCustomCameraChange(settings);
    },
    resetVehicle: () => {
      const sim = simRef.current;
      if (!sim) return;
      const spec = VEHICLE_SPECS[sim.vehicleId];
      const autoClutch = sim.playerState.gearbox.autoClutch;
      sim.worldTrailers = createInitialWorldTrailers();
      const starterTrailer = sim.worldTrailers.find((t) => t.attached) ?? null;
      if (spec.id !== 'auman_8x4' && starterTrailer) {
        starterTrailer.attached = false;
        starterTrailer.parkedBayId = 'bay_depot_apron';
        starterTrailer.x = PARKING_BAYS[0].x;
        starterTrailer.z = PARKING_BAYS[0].z;
        starterTrailer.heading = PARKING_BAYS[0].heading;
      }
      sim.playerState = createInitialVehicleState(
        spec,
        HERO_SPAWN,
        autoClutch,
        spec.id === 'auman_8x4',
        starterTrailer,
      );
      sim.playerState.handbrake = false;
      sim.parkHoldTimer = 0;
      sim.snapCamera = true;
      sim.rebuildAllTrailers();
    },
    teleportToBay: (bayId: string) => {
      const sim = simRef.current;
      if (!sim) return;
      const bay = PARKING_BAYS.find((b) => b.id === bayId);
      if (!bay) return;
      const spec = VEHICLE_SPECS[sim.vehicleId];
      const autoClutch = sim.playerState.gearbox.autoClutch;
      const activeTrailer = sim.playerState.trailer;
      const approachDist = activeTrailer ? 22.0 : 18.0;
      const sx = bay.x - Math.sin(bay.heading) * approachDist;
      const sz = bay.z - Math.cos(bay.heading) * approachDist;
      sim.playerState = createInitialVehicleState(
        spec,
        { x: sx, z: sz, heading: bay.heading },
        autoClutch,
        Boolean(activeTrailer && activeTrailer.attached),
        activeTrailer,
      );
      sim.playerState.handbrake = false;
      sim.parkHoldTimer = 0;
      sim.snapCamera = true;
    },
    honk: () => {
      const sim = simRef.current;
      if (!sim) return;
      sim.audio.init();
      const cat = VEHICLE_SPECS[sim.vehicleId].category;
      sim.audio.playHorn(cat !== 'car');
    },
    toggleMute: () => {
      const sim = simRef.current;
      if (!sim) return false;
      const next = !sim.audio.isMuted();
      sim.audio.setMuted(next);
      callbacksRef.current.onMuteChange(next);
      return next;
    },
  }));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: isSoftwareGl,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      54,
      (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight),
      0.15,
      720,
    );

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createContactShadowTexture();
    const world = buildSimulationWorld(scene, maxAniso, isSoftwareGl);

    // 2. Player Vehicle Rig & Persistent World Trailer Fleet
    let currentVehicleId: VehicleId = selectedVehicle;
    let worldTrailers = createInitialWorldTrailers();
    const starterTrailer =
      currentVehicleId === 'auman_8x4' ? worldTrailers.find((t) => t.attached) ?? null : null;
    if (currentVehicleId !== 'auman_8x4') {
      for (const t of worldTrailers) {
        if (t.attached) {
          t.attached = false;
          t.parkedBayId = 'bay_depot_apron';
          t.x = PARKING_BAYS[0].x;
          t.z = PARKING_BAYS[0].z;
          t.heading = PARKING_BAYS[0].heading;
        }
      }
    }

    let playerState = createInitialVehicleState(
      VEHICLE_SPECS[currentVehicleId],
      HERO_SPAWN,
      true,
      Boolean(starterTrailer),
      starterTrailer,
    );
    let playerRig: VehicleRig = buildPlayerVehicleRig(
      currentVehicleId,
      VEHICLE_SPECS[currentVehicleId],
      maxAniso,
      shadowTex,
    );
    playerRig.root.position.set(playerState.x, 0, playerState.z);
    playerRig.root.rotation.y = playerState.heading;
    scene.add(playerRig.root);

    const trailerRigs = new Map<string, SemiTrailerRig>();
    const syncTrailerMesh = (tr: TrailerState) => {
      const prev = trailerRigs.get(tr.id);
      if (prev) {
        scene.remove(prev.root);
      }
      const rig = buildSemiTrailerRig(
        maxAniso,
        shadowTex,
        tr.variant,
        tr.livery,
        tr.length,
        tr.kingpinToCenter,
      );
      rig.root.position.set(tr.x, 0, tr.z);
      rig.root.rotation.y = tr.heading;
      rig.landingGearGroup.position.y = tr.attached ? 0.42 : 0.0;
      scene.add(rig.root);
      trailerRigs.set(tr.id, rig);
    };

    const rebuildAllTrailers = () => {
      trailerRigs.forEach((rig) => scene.remove(rig.root));
      trailerRigs.clear();
      const activeTrailers = simRef.current ? simRef.current.worldTrailers : worldTrailers;
      for (const tr of activeTrailers) {
        syncTrailerMesh(tr);
      }
    };
    rebuildAllTrailers();

    // 3. Autonomous Mixed Traffic Rigs (26 vehicles across 3-lane highways & city roads)
    const trafficStates = createInitialTraffic();
    const trafficHandles: TrafficMeshHandle[] = trafficStates.map((tv) => {
      const h = buildTrafficVehicleMesh(tv.kind, tv.colorHex, shadowTex);
      h.root.position.set(tv.x, 0, tv.z);
      h.root.rotation.y = tv.heading;
      scene.add(h.root);
      return h;
    });

    // 4. Animated 3D Pedestrians (36 people walking sidewalks, depot aprons & crosswalks)
    const pedestrians = createInitialPedestrians();
    const pedHandles: PedestrianMeshHandle[] = pedestrians.map((p) => {
      const h = buildPedestrianMesh(p, shadowTex);
      h.root.position.set(p.x, 0, p.z);
      h.root.rotation.y = p.heading;
      scene.add(h.root);
      return h;
    });

    // 5. Pooled Particle Ring Buffer
    const particlePool: ParticleSlot[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      maxAge: 0.7,
      scale: 0.2,
      isSpark: false,
    }));
    let particleCursor = 0;

    const particleGeo = new THREE.IcosahedronGeometry(0.25, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 });
    const particleInst = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_POOL_SIZE);
    particleInst.frustumCulled = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      _dummyObj.position.set(0, -100, 0);
      _dummyObj.scale.setScalar(0.001);
      _dummyObj.updateMatrix();
      particleInst.setMatrixAt(i, _dummyObj.matrix);
      particleInst.setColorAt(i, _tempColor.setHex(0x94a3b8));
    }
    particleInst.instanceMatrix.needsUpdate = true;
    if (particleInst.instanceColor) particleInst.instanceColor.needsUpdate = true;
    scene.add(particleInst);

    const spawnParticles = (x: number, y: number, z: number, count: number, isSpark: boolean) => {
      for (let i = 0; i < count; i++) {
        const slot = particlePool[particleCursor];
        particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
        slot.active = true;
        slot.x = x + (Math.random() - 0.5) * 0.6;
        slot.y = y + Math.random() * 0.4;
        slot.z = z + (Math.random() - 0.5) * 0.6;
        slot.vx = (Math.random() - 0.5) * (isSpark ? 7 : 1.6);
        slot.vy = isSpark ? 2 + Math.random() * 4 : 0.8 + Math.random() * 1.4;
        slot.vz = (Math.random() - 0.5) * (isSpark ? 7 : 1.6);
        slot.age = 0;
        slot.maxAge = isSpark ? 0.35 + Math.random() * 0.2 : 0.55 + Math.random() * 0.4;
        slot.scale = isSpark ? 0.35 : 0.55 + Math.random() * 0.45;
        slot.isSpark = isSpark;
      }
    };

    const audio = new ProceduralVehicleAudio();
    const raycaster = new THREE.Raycaster();

    const switchRig = (nextId: VehicleId) => {
      scene.remove(playerRig.root);
      currentVehicleId = nextId;
      const prevX = playerState.x;
      const prevZ = playerState.z;
      const prevHeading = playerState.heading;
      const autoClutch = playerState.gearbox.autoClutch;
      const prevDist = playerState.distanceDrivenM;
      const prevDamage = playerState.damageCount;

      // Leave any currently attached trailer safely parked on its landing gear when switching away from 8x4
      if (playerState.trailer && nextId !== 'auman_8x4') {
        playerState.trailer.attached = false;
      }
      const keepAttached = nextId === 'auman_8x4' ? playerState.trailer : null;

      playerState = createInitialVehicleState(
        VEHICLE_SPECS[nextId],
        { x: prevX, z: prevZ, heading: prevHeading },
        autoClutch,
        Boolean(keepAttached),
        keepAttached,
      );
      playerState.handbrake = false;
      playerState.distanceDrivenM = prevDist;
      playerState.damageCount = prevDamage;
      playerRig = buildPlayerVehicleRig(nextId, VEHICLE_SPECS[nextId], maxAniso, shadowTex);
      playerRig.root.position.set(playerState.x, 0, playerState.z);
      playerRig.root.rotation.y = playerState.heading;
      scene.add(playerRig.root);
      if (simRef.current) {
        simRef.current.vehicleId = nextId;
        simRef.current.playerState = playerState;
      }
    };

    simRef.current = {
      vehicleId: currentVehicleId,
      playerState,
      worldTrailers,
      syncTrailerMesh,
      rebuildAllTrailers,
      cameraMode: 'chase',
      baysCompleted: new Set<string>(),
      parkHoldTimer: 0,
      trailersDeliveredCount: 0,
      trailerNotice: null,
      trailerNoticeTimer: 0,
      audio,
      switchRig,
      spawnParticles,
      hitstopTimer: 0,
      shakeTrauma: 0,
      orbitAngle: 0.62,
      snapCamera: false,
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Unified Keyboard, Drag & Wheel Input State
    const keysHeld = new Set<string>();
    const driveControls: Record<DriveControlKey, number> = {
      KeyW: 0,
      KeyS: 0,
      KeyA: 0,
      KeyD: 0,
      KeyC: 0,
    };
    driveControlsRef.current = driveControls;
    const driveControlKeys: DriveControlKey[] = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyC'];
    const clearHeldControls = () => {
      keysHeld.clear();
      driveControlKeys.forEach((key) => {
        driveControls[key] = 0;
      });
    };
    let pointerNormX = 0;
    let pointerNormY = 0;
    let isDraggingOrbit = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const curPhase = phaseRef.current;

      if (curPhase === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          audio.init();
          playerState.handbrake = false;
          callbacksRef.current.onPhaseChange('playing');
          return;
        }
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (curPhase === 'playing') {
          e.preventDefault();
          clearHeldControls();
          callbacksRef.current.onPhaseChange('paused');
          return;
        } else if (curPhase === 'paused') {
          e.preventDefault();
          callbacksRef.current.onPhaseChange('playing');
          return;
        }
      }

      if (curPhase !== 'playing') return;

      const sim = simRef.current!;
      const spec = VEHICLE_SPECS[sim.vehicleId];

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) {
        e.preventDefault();
      }

      if (!e.repeat) {
        audio.init();
        if (code === 'KeyE') {
          const res = shiftGearUp(sim.playerState.gearbox, sim.playerState.forwardSpeed, spec);
          if (res.shifted) {
            sim.playerState.gearbox = res.next;
            audio.playGearShift();
          }
        } else if (code === 'KeyQ') {
          const res = shiftGearDown(sim.playerState.gearbox, sim.playerState.forwardSpeed, spec);
          if (res.shifted) {
            sim.playerState.gearbox = res.next;
            audio.playGearShift();
          }
        } else if (code === 'KeyN') {
          const res = setDirectGear(sim.playerState.gearbox, 'N', sim.playerState.forwardSpeed, spec);
          if (res.shifted) {
            sim.playerState.gearbox = res.next;
            audio.playGearShift();
          }
        } else if (code === 'KeyR') {
          const res = setDirectGear(sim.playerState.gearbox, 'R', sim.playerState.forwardSpeed, spec);
          if (res.shifted) {
            sim.playerState.gearbox = res.next;
            audio.playGearShift();
          }
        } else if (code.startsWith('Digit')) {
          const n = Number(code.replace('Digit', ''));
          if (n >= 1 && n <= 6) {
            const res = setDirectGear(sim.playerState.gearbox, n as GearValue, sim.playerState.forwardSpeed, spec);
            if (res.shifted) {
              sim.playerState.gearbox = res.next;
              audio.playGearShift();
            }
          }
        } else if (code === 'Space') {
          sim.playerState.handbrake = !sim.playerState.handbrake;
          if (spec.hasAirBrakes) audio.playAirBrakeHiss();
        } else if (code === 'KeyK') {
          sim.playerState.gearbox.autoClutch = !sim.playerState.gearbox.autoClutch;
        } else if (code === 'KeyV') {
          const idx = CAMERA_MODES.indexOf(sim.cameraMode);
          sim.cameraMode = CAMERA_MODES[(idx + 1) % CAMERA_MODES.length];
        } else if (code === 'KeyL') {
          sim.playerState.headlightsOn = !sim.playerState.headlightsOn;
          sim.playerState.roofLightsOn = sim.playerState.headlightsOn;
        } else if (code === 'KeyT') {
          const res = toggleWorldTrailerCoupling(sim.playerState, spec, sim.worldTrailers, PARKING_BAYS);
          sim.trailerNotice = res.message;
          sim.trailerNoticeTimer = 3.6;
          if (res.changed) {
            audio.playAirBrakeHiss();
            if (res.droppedInBay) {
              sim.trailersDeliveredCount += 1;
              sim.baysCompleted.add(res.droppedInBay.id);
              audio.playParkLockChime();
            }
          }
        } else if (code === 'KeyH') {
          audio.playHorn(spec.category !== 'car');
        } else if (code === 'KeyM') {
          const muted = !audio.isMuted();
          audio.setMuted(muted);
          callbacksRef.current.onMuteChange(muted);
        } else if (code === 'Tab') {
          const idx = VEHICLE_ORDER.indexOf(sim.vehicleId);
          switchRig(VEHICLE_ORDER[(idx + 1) % VEHICLE_ORDER.length]);
        } else if (code === 'KeyI') {
          sim.playerState.gearbox.stalled = false;
          sim.playerState.gearbox.rpm = spec.idleRpm;
        }
      }

      keysHeld.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };

    const handleClearHeld = () => {
      clearHeldControls();
      isDraggingOrbit = false;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        pointerNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNormY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      }
      if (isDraggingOrbit && simRef.current) {
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        if (simRef.current.cameraMode === 'custom') {
          const cur = customCamRef.current;
          const nextCam: CustomCameraSettings = {
            ...cur,
            yawDeg: Math.round(((cur.yawDeg - dx * 0.45 + 540) % 360) - 180),
            height: Number(Math.max(1.2, Math.min(16, cur.height + dy * 0.03)).toFixed(1)),
          };
          customCamRef.current = nextCam;
          callbacksRef.current.onCustomCameraChange(nextCam);
        } else {
          simRef.current.orbitAngle -= dx * 0.007;
        }
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (phaseRef.current === 'playing') {
        isDraggingOrbit = true;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
      }
    };

    const handlePointerUp = () => {
      isDraggingOrbit = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (phaseRef.current !== 'playing' || !simRef.current) return;
      if (simRef.current.cameraMode === 'custom') {
        e.preventDefault();
        const cur = customCamRef.current;
        const nextCam: CustomCameraSettings = {
          ...cur,
          distance: Number(Math.max(5.5, Math.min(34, cur.distance + e.deltaY * 0.012)).toFixed(1)),
        };
        customCamRef.current = nextCam;
        callbacksRef.current.onCustomCameraChange(nextCam);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleClearHeld);
    document.addEventListener('visibilitychange', handleClearHeld);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = Math.max(1, container.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    camera.position.set(-7.8, 3.5, 6.0);
    camera.lookAt(-29.8, 1.9, -12.0);

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let hudEmitAccumulator = 0;
    let exhaustTimer = 0;
    let titleCamTimer = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const sim = simRef.current!;
      const spec = VEHICLE_SPECS[sim.vehicleId];
      const curPhase = phaseRef.current;

      if (sim.trailerNoticeTimer > 0) {
        sim.trailerNoticeTimer = Math.max(0, sim.trailerNoticeTimer - dt);
        if (sim.trailerNoticeTimer === 0) sim.trailerNotice = null;
      }

      playerState = sim.playerState;
      playerRig.root.position.set(playerState.x, 0, playerState.z);
      playerRig.root.rotation.y = playerState.heading;

      // Sync ALL persistent world trailers (coupled + parked in bays!)
      for (let i = 0; i < sim.worldTrailers.length; i++) {
        const tr = sim.worldTrailers[i];
        const rig = trailerRigs.get(tr.id);
        if (!rig) continue;
        rig.root.position.set(tr.x, 0, tr.z);
        rig.root.rotation.y = tr.heading;
        const targetGearY = tr.attached ? 0.42 : 0.0;
        rig.landingGearGroup.position.y +=
          (targetGearY - rig.landingGearGroup.position.y) * Math.min(1, 10 * dt);
        for (let w = 0; w < rig.wheelMeshes.length; w++) {
          rig.wheelMeshes[w].rotation.x = tr.wheelSpinAngle;
        }
        rig.brakeLightMat.emissiveIntensity =
          curPhase === 'playing' && tr.attached && playerState.braking ? 2.8 : 0.45;
        rig.reverseLightMat.emissiveIntensity =
          curPhase === 'playing' && tr.attached && playerState.gearbox.gear === 'R' ? 2.2 : 0.0;
      }

      // Update Traffic AI & Animated Pedestrians in Title & Playing
      if (curPhase === 'title' || curPhase === 'playing') {
        const activePlayer = curPhase === 'playing' ? playerState : null;
        stepTrafficAI(trafficStates, activePlayer, dt);
        for (let i = 0; i < trafficStates.length; i++) {
          const ts = trafficStates[i];
          const th = trafficHandles[i];
          th.root.position.set(ts.x, 0, ts.z);
          th.root.rotation.y = ts.heading;
          th.brakeMat.emissiveIntensity = ts.braking ? 2.2 : 0.45;
          for (let w = 0; w < th.wheels.length; w++) {
            th.wheels[w].rotation.x = ts.wheelSpin;
          }
        }

        stepPedestrians(pedestrians, activePlayer, trafficStates, dt);
        for (let i = 0; i < pedestrians.length; i++) {
          const p = pedestrians[i];
          const ph = pedHandles[i];
          ph.root.position.set(p.x, 0, p.z);
          ph.root.rotation.y = p.heading;
          const swing = Math.sin(p.walkPhase) * 0.55;
          ph.leftLeg.rotation.x = swing;
          ph.rightLeg.rotation.x = -swing;
          ph.leftArm.rotation.x = -swing * 0.72;
          ph.rightArm.rotation.x = swing * 0.72;
        }
      }

      if (curPhase === 'playing') {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
        } else {
          const throttle = Math.max(
            driveControls.KeyW,
            keysHeld.has('KeyW') || keysHeld.has('ArrowUp') ? 1 : 0,
          );
          const brake = Math.max(
            driveControls.KeyS,
            keysHeld.has('KeyS') || keysHeld.has('ArrowDown') ? 1 : 0,
          );
          const steerLeft = Math.max(
            driveControls.KeyA,
            keysHeld.has('KeyA') || keysHeld.has('ArrowLeft') ? 1 : 0,
          );
          const steerRight = Math.max(
            driveControls.KeyD,
            keysHeld.has('KeyD') || keysHeld.has('ArrowRight') ? 1 : 0,
          );
          const clutch = Math.max(
            driveControls.KeyC,
            keysHeld.has('KeyC') || keysHeld.has('ShiftLeft') || keysHeld.has('ShiftRight') ? 1 : 0,
          );

          const inputs: ControlInputs = {
            throttle,
            brake,
            steer: steerLeft - steerRight,
            clutch,
            handbrake: playerState.handbrake,
          };

          const prevSpeed = Math.abs(playerState.forwardSpeed);
          const { collisionImpulse } = stepVehiclePhysics(
            playerState,
            spec,
            inputs,
            dt,
            undefined,
            trafficStates,
            sim.worldTrailers,
          );

          if (collisionImpulse > 2.2) {
            sim.shakeTrauma = Math.min(1, sim.shakeTrauma + Math.min(0.85, collisionImpulse * 0.09));
            sim.hitstopTimer = collisionImpulse > 6 ? 0.045 : 0;
            audio.playCollision(collisionImpulse);
            spawnParticles(
              playerState.x + Math.sin(playerState.heading) * (spec.length * 0.45),
              0.9,
              playerState.z + Math.cos(playerState.heading) * (spec.length * 0.45),
              12,
              true,
            );
          } else if (prevSpeed > 5 && brake > 0.5 && spec.hasAirBrakes && Math.random() < 0.02) {
            audio.playAirBrakeHiss();
          }

          exhaustTimer += dt;
          if (exhaustTimer > 0.14 && (throttle > 0.3 || Math.abs(playerState.forwardSpeed) > 6)) {
            exhaustTimer = 0;
            spawnParticles(
              playerState.x - Math.sin(playerState.heading) * (spec.length * 0.4),
              0.35,
              playerState.z - Math.cos(playerState.heading) * (spec.length * 0.4),
              1,
              false,
            );
          }
        }

        audio.updateEngine(
          playerState.gearbox.rpm,
          spec.idleRpm,
          spec.maxRpm,
          spec.enginePitchBaseHz,
          playerState.throttleInput,
          playerState.gearbox.stalled,
          spec.category !== 'car',
          true,
        );

        playerRig.root.position.set(playerState.x, 0, playerState.z);
        playerRig.root.rotation.y = playerState.heading;
        playerRig.bodyGroup.rotation.x = playerState.pitch;
        playerRig.bodyGroup.rotation.z = playerState.roll;

        for (let i = 0; i < playerRig.steerPivots.length; i++) {
          playerRig.steerPivots[i].rotation.y = playerState.steerAngle * playerRig.steerRatios[i];
        }
        for (let i = 0; i < playerRig.wheelMeshes.length; i++) {
          playerRig.wheelMeshes[i].rotation.x = playerState.wheelSpinAngle;
        }

        playerRig.brakeLightMat.emissiveIntensity = playerState.braking ? 2.8 : 0.65;
        playerRig.headlightMat.emissiveIntensity = playerState.headlightsOn ? 2.5 : 0.25;
        if (playerRig.roofLightMat) {
          playerRig.roofLightMat.emissiveIntensity = playerState.roofLightsOn ? 2.4 : 0.2;
        }
        if (playerRig.reverseLightMat) {
          playerRig.reverseLightMat.emissiveIntensity = playerState.gearbox.gear === 'R' ? 2.2 : 0.0;
        }

        const parkingStatus = evaluateParkingStatus(playerState, spec, PARKING_BAYS);
        world.bayVisuals.forEach((bv, id) => {
          const isNearest = parkingStatus.nearestBay?.id === id;
          if (isNearest && parkingStatus.isParkedCleanly) {
            bv.frameMat.color.setHex(0x4ade80);
            bv.frameMat.emissive.setHex(0x22c55e);
            bv.frameMat.emissiveIntensity = 2.4;
          } else if (isNearest && parkingStatus.isInside) {
            bv.frameMat.color.setHex(0xfbbf24);
            bv.frameMat.emissive.setHex(0xf59e0b);
            bv.frameMat.emissiveIntensity = 2.0;
          } else {
            bv.frameMat.color.setHex(0x38bdf8);
            bv.frameMat.emissive.setHex(0x0284c7);
            bv.frameMat.emissiveIntensity = 1.25;
          }
        });

        if (parkingStatus.isParkedCleanly && parkingStatus.nearestBay) {
          sim.parkHoldTimer += dt;
          if (sim.parkHoldTimer > 0.65 && !sim.baysCompleted.has(parkingStatus.nearestBay.id)) {
            sim.baysCompleted.add(parkingStatus.nearestBay.id);
            audio.playParkLockChime();
            callbacksRef.current.onBayCompleted(parkingStatus.nearestBay.id, parkingStatus.nearestBay.name);
          }
        } else {
          sim.parkHoldTimer = 0;
        }

        // Camera Modes: Chase, Cab, Top, Orbit, and Custom View
        const sinH = Math.sin(playerState.heading);
        const cosH = Math.cos(playerState.heading);
        const hasAttachedTrailer = Boolean(playerState.trailer && playerState.trailer.attached);

        const camLerp = (alpha: number) => (sim.snapCamera ? 1 : alpha);

        if (sim.cameraMode === 'cab') {
          const off = spec.cabViewOffset;
          const worldX = playerState.x + off.x * -cosH + off.z * sinH;
          const worldZ = playerState.z + off.x * sinH + off.z * cosH;
          _camDesired.set(worldX, off.y, worldZ);
          _camLook.set(worldX + sinH * 18, off.y - 0.55, worldZ + cosH * 18);
          camera.position.lerp(_camDesired, camLerp(1 - Math.exp(-24 * dt)));
          camera.lookAt(_camLook);
        } else if (sim.cameraMode === 'top') {
          const backShift = hasAttachedTrailer ? 7.5 : 4;
          const topHeight = hasAttachedTrailer ? 32 : 24;
          _camDesired.set(playerState.x - sinH * backShift, topHeight, playerState.z - cosH * backShift);
          _camLook.set(
            playerState.x - sinH * (hasAttachedTrailer ? 4 : 0),
            0.5,
            playerState.z - cosH * (hasAttachedTrailer ? 4 : 0),
          );
          camera.position.lerp(_camDesired, camLerp(1 - Math.exp(-8 * dt)));
          camera.lookAt(_camLook);
        } else if (sim.cameraMode === 'orbit') {
          if (!isDraggingOrbit) sim.orbitAngle += dt * 0.16;
          const dist = (spec.chaseDistance + (hasAttachedTrailer ? 6.5 : 0)) * 1.05;
          const focusX = playerState.x - sinH * (hasAttachedTrailer ? 3.2 : 0);
          const focusZ = playerState.z - cosH * (hasAttachedTrailer ? 3.2 : 0);
          _camDesired.set(
            focusX + Math.sin(sim.orbitAngle) * dist,
            spec.chaseHeight * (hasAttachedTrailer ? 1.15 : 0.9),
            focusZ + Math.cos(sim.orbitAngle) * dist,
          );
          _camLook.set(focusX, 1.85, focusZ);
          camera.position.lerp(_camDesired, camLerp(1 - Math.exp(-9 * dt)));
          camera.lookAt(_camLook);
        } else if (sim.cameraMode === 'custom') {
          const cfg = customCamRef.current;
          const relAngle = playerState.heading + (cfg.yawDeg * Math.PI) / 180;
          const focusX = playerState.x - sinH * (hasAttachedTrailer ? 2.4 : 0);
          const focusZ = playerState.z - cosH * (hasAttachedTrailer ? 2.4 : 0);
          _camDesired.set(
            focusX - Math.sin(relAngle) * cfg.distance,
            cfg.height,
            focusZ - Math.cos(relAngle) * cfg.distance,
          );
          _rayOrigin.set(focusX, 2.0, focusZ);
          _rayDir.copy(_camDesired).sub(_rayOrigin);
          const rayLen = _rayDir.length();
          if (rayLen > 0.1) {
            _rayDir.divideScalar(rayLen);
            raycaster.set(_rayOrigin, _rayDir);
            raycaster.far = rayLen;
            const hits = raycaster.intersectObjects(world.collidableMeshes, false);
            if (hits.length > 0 && hits[0].distance > 2.2) {
              _camDesired.copy(_rayOrigin).addScaledVector(_rayDir, hits[0].distance - 0.65);
            }
          }
          _camLook.set(focusX, cfg.lookHeight, focusZ);
          camera.position.lerp(_camDesired, camLerp(1 - Math.exp(-9.5 * dt)));
          camera.lookAt(_camLook);
        } else {
          const speedBoost = Math.min(3.5, Math.abs(playerState.forwardSpeed) * 0.12);
          const trailerExtra = hasAttachedTrailer ? 9.6 : 0;
          const dist = spec.chaseDistance + trailerExtra + speedBoost;
          const height = spec.chaseHeight + (hasAttachedTrailer ? 3.2 : 0);
          _camDesired.set(
            playerState.x - sinH * dist,
            height,
            playerState.z - cosH * dist,
          );
          _rayOrigin.set(playerState.x, 2.0, playerState.z);
          _rayDir.copy(_camDesired).sub(_rayOrigin);
          const rayLen = _rayDir.length();
          if (rayLen > 0.1) {
            _rayDir.divideScalar(rayLen);
            raycaster.set(_rayOrigin, _rayDir);
            raycaster.far = rayLen;
            const hits = raycaster.intersectObjects(world.collidableMeshes, false);
            if (hits.length > 0 && hits[0].distance > 2.2) {
              _camDesired.copy(_rayOrigin).addScaledVector(_rayDir, hits[0].distance - 0.65);
            }
          }

          const lookForward = hasAttachedTrailer ? 2.8 : 4.5;
          _camLook.set(playerState.x + sinH * lookForward, 1.8, playerState.z + cosH * lookForward);
          camera.position.lerp(_camDesired, camLerp(1 - Math.exp(-8.5 * dt)));
          camera.lookAt(_camLook);
        }
        sim.snapCamera = false;

        if (sim.shakeTrauma > 0.005) {
          const shake = sim.shakeTrauma * sim.shakeTrauma * 0.35;
          camera.position.x += (Math.random() - 0.5) * shake;
          camera.position.y += (Math.random() - 0.5) * shake * 0.7;
          sim.shakeTrauma = Math.max(0, sim.shakeTrauma - dt * 2.4);
        }

        hudEmitAccumulator += dt;
        if (hudEmitAccumulator >= 0.08) {
          hudEmitAccumulator = 0;
          const nearbyTr =
            !hasAttachedTrailer && spec.id === 'auman_8x4'
              ? findNearbyHookableTrailer(playerState, sim.worldTrailers)
              : null;
          const activeTr = playerState.trailer;
          callbacksRef.current.onHudUpdate({
            speedKmh: Math.round(Math.abs(playerState.forwardSpeed) * 3.6),
            rpm: Math.round(playerState.gearbox.rpm),
            redlineRpm: spec.redlineRpm,
            maxRpm: spec.maxRpm,
            gear: playerState.gearbox.gear,
            clutch: playerState.gearbox.clutch,
            stalled: playerState.gearbox.stalled,
            autoClutch: playerState.gearbox.autoClutch,
            handbrake: playerState.handbrake,
            braking: playerState.braking,
            headlightsOn: playerState.headlightsOn,
            roofLightsOn: playerState.roofLightsOn,
            trailerAttached: hasAttachedTrailer,
            trailerSupported: spec.id === 'auman_8x4',
            activeTrailerName: activeTr ? activeTr.name : null,
            activeTrailerVariant: activeTr ? activeTr.variant : 'container',
            activeTrailerLivery: activeTr ? activeTr.livery : 'auman_silver',
            nearbyHookableTrailer: nearbyTr ? nearbyTr.name : null,
            trailerActionNotice: sim.trailerNotice,
            trailersDeliveredCount: sim.trailersDeliveredCount,
            vehicleId: sim.vehicleId,
            vehicleName: spec.name,
            zoneName: getZoneName(playerState.x, playerState.z),
            distanceKm: Number((playerState.distanceDrivenM / 1000).toFixed(2)),
            collisions: playerState.damageCount,
            baysCompleted: Array.from(sim.baysCompleted),
            parking: parkingStatus,
            cameraMode: sim.cameraMode,
            playerX: playerState.x,
            playerZ: playerState.z,
            playerHeading: playerState.heading,
            trafficDots: trafficStates.map((t) => ({ x: t.x, z: t.z, kind: t.kind })),
            trailerDots: sim.worldTrailers.map((tr) => ({ x: tr.x, z: tr.z, attached: tr.attached })),
          });
        }
      } else if (curPhase === 'title') {
        audio.updateEngine(spec.idleRpm, spec.idleRpm, spec.maxRpm, spec.enginePitchBaseHz, 0, false, true, false);
        titleCamTimer += dt;
        const sway = Math.sin(titleCamTimer * 0.35) * 0.65;
        _camDesired.set(
          -7.8 + pointerNormX * 0.9 + sway,
          3.5 - pointerNormY * 0.25,
          6.0 + sway * 0.45,
        );
        _camLook.set(-29.8, 1.9, -12.0);
        camera.position.lerp(_camDesired, 1 - Math.exp(-4.5 * dt));
        camera.lookAt(_camLook);
      } else {
        audio.updateEngine(0, spec.idleRpm, spec.maxRpm, spec.enginePitchBaseHz, 0, true, true, false);
      }

      let dirtyParticles = false;
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particlePool[i];
        if (!p.active) continue;
        dirtyParticles = true;
        p.age += dt;
        if (p.age >= p.maxAge) {
          p.active = false;
          _dummyObj.position.set(0, -100, 0);
          _dummyObj.scale.setScalar(0.001);
          _dummyObj.updateMatrix();
          particleInst.setMatrixAt(i, _dummyObj.matrix);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.isSpark) p.vy -= 12 * dt;
        const lifeT = p.age / p.maxAge;
        const s = p.isSpark ? p.scale * (1 - lifeT) : p.scale * (0.6 + lifeT * 1.4);
        _dummyObj.position.set(p.x, p.y, p.z);
        _dummyObj.scale.setScalar(Math.max(0.01, s));
        _dummyObj.updateMatrix();
        particleInst.setMatrixAt(i, _dummyObj.matrix);
        particleInst.setColorAt(i, _tempColor.setHex(p.isSpark ? 0xfbbf24 : 0x94a3b8));
      }
      if (dirtyParticles) {
        particleInst.instanceMatrix.needsUpdate = true;
        if (particleInst.instanceColor) particleInst.instanceColor.needsUpdate = true;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      driveControlsRef.current = null;
      clearHeldControls();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleClearHeld);
      document.removeEventListener('visibilitychange', handleClearHeld);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('pointerup', handlePointerUp);
      audio.dispose();
      world.dispose();
      shadowTex.dispose();
      envRT.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="webgl-viewport"
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#151e30]"
    />
  );
});
