import * as THREE from 'three';
import {
  createAumanSideLiveryTexture,
  createBumperPlateTexture,
  createCorrugatedTexture,
  createFotonVisorTexture,
  createTrailerLiveryTexture,
} from './proceduralTextures';
import type { TrafficKind, TrailerLivery, TrailerVariant, VehicleId, VehicleSpec } from '../sim/types';

export interface VehicleRig {
  root: THREE.Group;
  bodyGroup: THREE.Group; // pitches & rolls with suspension
  steerPivots: THREE.Group[];
  steerRatios: number[];
  wheelMeshes: THREE.Object3D[];
  brakeLightMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  roofLightMat?: THREE.MeshStandardMaterial;
  reverseLightMat?: THREE.MeshStandardMaterial;
}

function makeWheelAssembly(
  radius: number,
  width: number,
  dual: boolean,
  rimMat: THREE.Material,
  tireMat: THREE.Material,
  hubMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();

  const addSingle = (xOffset: number) => {
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.x = xOffset;
    tire.castShadow = true;
    tire.receiveShadow = true;
    g.add(tire);

    const rimGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 18);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.x = xOffset;
    g.add(rim);

    const hubGeo = new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, width + 0.05, 12);
    hubGeo.rotateZ(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.x = xOffset;
    g.add(hub);
  };

  if (dual) {
    addSingle(-width * 0.54);
    addSingle(width * 0.54);
  } else {
    addSingle(0);
  }

  return g;
}

function addContactShadow(root: THREE.Group, width: number, length: number, shadowTex: THREE.Texture): void {
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.45, length * 1.24), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.02;
  root.add(plane);
}

export function buildPlayerVehicleRig(
  id: VehicleId,
  spec: VehicleSpec,
  maxAniso: number,
  shadowTex: THREE.Texture,
): VehicleRig {
  switch (id) {
    case 'auman_8x4':
      return buildAumanGalaxy8x4(spec, maxAniso, shadowTex);
    case 'sport_coupe':
      return buildSportCoupe(spec, shadowTex);
    case 'city_bus':
      return buildCityBus(spec, shadowTex);
    case 'box_truck':
      return buildBoxTruck(spec, maxAniso, shadowTex);
  }
}

function buildAumanGalaxy8x4(
  spec: VehicleSpec,
  maxAniso: number,
  shadowTex: THREE.Texture,
): VehicleRig {
  const root = new THREE.Group();
  addContactShadow(root, spec.width, spec.length, shadowTex);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Materials with strong roughness/metalness contrast
  const silverPaint = new THREE.MeshPhysicalMaterial({
    color: 0x9aa4b2,
    metalness: 0.46,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.72,
  });
  const obsidianTrim = new THREE.MeshStandardMaterial({
    color: 0x161920,
    metalness: 0.22,
    roughness: 0.72,
  });
  const chassisDark = new THREE.MeshStandardMaterial({
    color: 0x111419,
    metalness: 0.45,
    roughness: 0.65,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf5,
    metalness: 0.94,
    roughness: 0.12,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0b1522,
    metalness: 0.2,
    roughness: 0.08,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1a1d22,
    metalness: 0.05,
    roughness: 0.88,
  });
  const cyanLedMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const amberMarkerMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.9,
    roughness: 0.3,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xf0f9ff,
    emissive: 0xdbeafe,
    emissiveIntensity: 2.4,
    roughness: 0.15,
  });
  const roofLightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: 0xef4444,
    emissiveIntensity: 0.65,
    roughness: 0.3,
  });
  const reverseLightMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });

  // 1. Heavy 8x4 Ladder Chassis Rails + Side Skirts + Fifth Wheel Coupler
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 7.1), chassisDark);
  chassis.position.set(0, 0.92, -0.15);
  chassis.castShadow = true;
  bodyGroup.add(chassis);

  // Side skirts with amber LED markers between axles 2 and 3
  const skirtGeo = new THREE.BoxGeometry(0.14, 0.56, 1.82);
  for (const sx of [-1.14, 1.14]) {
    const skirt = new THREE.Mesh(skirtGeo, obsidianTrim);
    skirt.position.set(sx, 0.92, -0.15);
    skirt.castShadow = true;
    bodyGroup.add(skirt);

    // Amber marker LEDs along side skirt & rear fenders
    for (const mz of [2.05, 0.45, -0.45, -2.3]) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.14), amberMarkerMat);
      marker.position.set(sx + Math.sign(sx) * 0.06, 0.72, mz);
      bodyGroup.add(marker);
    }
  }

  // Rear fenders over tandem drive axles
  const rearFender = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.22, 2.75), obsidianTrim);
  rearFender.position.set(0, 1.24, -2.3);
  rearFender.castShadow = true;
  bodyGroup.add(rearFender);

  // Fifth-wheel coupler saddle
  const fifthWheelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.62, 0.16, 18), chassisDark);
  fifthWheelBase.position.set(0, 1.38, -2.25);
  bodyGroup.add(fifthWheelBase);
  const fifthWheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 8, 18), chromeMat);
  fifthWheelRing.rotation.x = Math.PI / 2;
  fifthWheelRing.position.set(0, 1.46, -2.25);
  bodyGroup.add(fifthWheelRing);

  // 2. High-Roof Sleeper Cab (Multi-material sides with Crowned Lion & Auman Galaxy livery!)
  const liveryLeft = new THREE.MeshStandardMaterial({
    map: createAumanSideLiveryTexture(maxAniso, false),
    metalness: 0.48,
    roughness: 0.32,
  });
  const liveryRight = new THREE.MeshStandardMaterial({
    map: createAumanSideLiveryTexture(maxAniso, true),
    metalness: 0.48,
    roughness: 0.32,
  });

  // Main cab core (x: 2.38 wide, y: 2.42 tall, z: 2.55 deep, centered at z=+2.28)
  const cabMats = [
    liveryLeft,    // +X (left side of truck facing +Z)
    liveryRight,   // -X (right side)
    silverPaint,   // +Y top
    obsidianTrim,  // -Y bottom
    silverPaint,   // +Z front
    obsidianTrim,  // -Z rear cab wall
  ];
  const cabBox = new THREE.Mesh(new THREE.BoxGeometry(2.38, 2.28, 2.52), cabMats);
  cabBox.position.set(0, 2.34, 2.22);
  cabBox.castShadow = true;
  cabBox.receiveShadow = true;
  bodyGroup.add(cabBox);

  // Aero high-roof dome & upper wing fairing
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.48, 2.26), silverPaint);
  roofCap.position.set(0, 3.62, 2.12);
  roofCap.castShadow = true;
  bodyGroup.add(roofCap);

  // Rear cab aero side deflectors
  for (const sx of [-1.2, 1.2]) {
    const deflector = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.35, 0.45), obsidianTrim);
    deflector.position.set(sx, 2.5, 0.88);
    bodyGroup.add(deflector);
  }

  // Windshield (sloped dark optical glass)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.94, 0.08), glassMat);
  windshield.position.set(0, 2.78, 3.47);
  windshield.rotation.x = -0.14;
  bodyGroup.add(windshield);

  // Side cab windows
  for (const sx of [-1.2, 1.2]) {
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 1.02), glassMat);
    sideWin.position.set(sx, 2.78, 2.86);
    bodyGroup.add(sideWin);

    // Tall wing mirrors on chrome arms
    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.06), obsidianTrim);
    mirrorArm.position.set(sx + Math.sign(sx) * 0.14, 2.82, 3.35);
    bodyGroup.add(mirrorArm);
    const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.52, 0.18), silverPaint);
    mirrorHousing.position.set(sx + Math.sign(sx) * 0.25, 2.68, 3.38);
    mirrorHousing.castShadow = true;
    bodyGroup.add(mirrorHousing);
  }

  // Sunvisor with illuminated FOTON header
  const visorMat = new THREE.MeshStandardMaterial({
    map: createFotonVisorTexture(maxAniso),
    roughness: 0.28,
    metalness: 0.4,
    emissive: 0x1e3a5f,
    emissiveIntensity: 0.45,
  });
  const visor = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.34, 0.24), [
    obsidianTrim,
    obsidianTrim,
    obsidianTrim,
    obsidianTrim,
    visorMat,
    obsidianTrim,
  ]);
  visor.position.set(0, 3.44, 3.5);
  visor.rotation.x = 0.16;
  bodyGroup.add(visor);

  // 6-Lamp Chrome & LED Roof Spotlight Bar (Signature feature from photo!)
  const roofBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.98, 10), chromeMat);
  roofBar.rotation.z = Math.PI / 2;
  roofBar.position.set(0, 3.92, 2.98);
  bodyGroup.add(roofBar);

  for (let i = 0; i < 6; i++) {
    const lx = -0.82 + i * 0.328;
    const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.14, 14), obsidianTrim);
    lampHousing.rotation.x = Math.PI / 2;
    lampHousing.position.set(lx, 3.96, 3.04);
    bodyGroup.add(lampHousing);

    const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.095, 14), roofLightMat);
    lampLens.position.set(lx, 3.96, 3.115);
    bodyGroup.add(lampLens);
  }

  // 3. Signature Front V-Grille with Icy-Blue Cyan LED Strips & Glowing Foton Emblem
  const grilleRecess = new THREE.Mesh(new THREE.BoxGeometry(1.78, 1.05, 0.14), obsidianTrim);
  grilleRecess.position.set(0, 1.66, 3.45);
  bodyGroup.add(grilleRecess);

  // Horizontal metallic slats + flanking cyan LED accent strips
  for (let row = 0; row < 4; row++) {
    const slatY = 1.98 - row * 0.22;
    const slatW = 1.54 - row * 0.12;
    const slat = new THREE.Mesh(new THREE.BoxGeometry(slatW, 0.07, 0.08), silverPaint);
    slat.position.set(0, slatY, 3.52);
    bodyGroup.add(slat);

    // Cyan LED chevrons on left & right of grille slats
    for (const side of [-1, 1]) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.06), cyanLedMat);
      led.position.set(side * (slatW * 0.44 + 0.07), slatY, 3.535);
      led.rotation.z = side * 0.28;
      bodyGroup.add(led);
    }
  }

  // Central Foton circular emblem with glowing cyan halo ring
  const emblemRing = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.032, 10, 24), cyanLedMat);
  emblemRing.position.set(0, 1.88, 3.56);
  bodyGroup.add(emblemRing);
  const emblemCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 20), chromeMat);
  emblemCore.rotation.x = Math.PI / 2;
  emblemCore.position.set(0, 1.88, 3.54);
  bodyGroup.add(emblemCore);

  // Sculpted Front Bumper, Stacked Headlights & Lower Cyan Lip
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.56, 0.32), silverPaint);
  bumper.position.set(0, 0.84, 3.46);
  bumper.castShadow = true;
  bodyGroup.add(bumper);

  const plateMat = new THREE.MeshStandardMaterial({
    map: createBumperPlateTexture('AUMAN GALAXY', maxAniso),
    roughness: 0.4,
  });
  const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.04), plateMat);
  frontPlate.position.set(0, 0.92, 3.63);
  bodyGroup.add(frontPlate);

  // Vertical stacked LED headlights + lower cyan brow strips
  for (const sx of [-0.94, 0.94]) {
    const hlPod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.12), obsidianTrim);
    hlPod.position.set(sx, 0.96, 3.58);
    bodyGroup.add(hlPod);

    const hlLens = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.06), headlightMat);
    hlLens.position.set(sx, 0.96, 3.62);
    bodyGroup.add(hlLens);

    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.06), cyanLedMat);
    drl.position.set(sx, 0.64, 3.62);
    bodyGroup.add(drl);
  }

  // Rear LED tail-light bar
  for (const sx of [-0.92, 0.92]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), brakeLightMat);
    tail.position.set(sx, 0.92, -3.72);
    bodyGroup.add(tail);

    const rev = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), reverseLightMat);
    rev.position.set(sx * 0.62, 0.92, -3.72);
    bodyGroup.add(rev);
  }

  // 4. Four Axles (8x4 Twin-Steer Front + Dual Rear Tandem)
  const steerPivots: THREE.Group[] = [];
  const steerRatios: number[] = [];
  const wheelMeshes: THREE.Object3D[] = [];

  spec.axlePositionsZ.forEach((az, axleIdx) => {
    const isSteer = spec.steerAxleIndices.includes(axleIdx);
    const isDualRear = axleIdx >= 2;
    const ratioIdx = spec.steerAxleIndices.indexOf(axleIdx);
    const ratio = ratioIdx >= 0 ? spec.steerAxleRatios[ratioIdx] : 0;

    for (const side of [-1, 1]) {
      const wheelPivot = new THREE.Group();
      wheelPivot.position.set(side * (isDualRear ? 0.96 : 1.06), spec.wheelRadius, az);
      root.add(wheelPivot);

      const wheel = makeWheelAssembly(
        spec.wheelRadius,
        0.31,
        isDualRear,
        chromeMat,
        tireMat,
        obsidianTrim,
      );
      wheelPivot.add(wheel);
      wheelMeshes.push(wheel);

      if (isSteer) {
        steerPivots.push(wheelPivot);
        steerRatios.push(ratio);
      }
    }
  });

  return {
    root,
    bodyGroup,
    steerPivots,
    steerRatios,
    wheelMeshes,
    brakeLightMat,
    headlightMat,
    roofLightMat,
    reverseLightMat,
  };
}

function buildSportCoupe(spec: VehicleSpec, shadowTex: THREE.Texture): VehicleRig {
  const root = new THREE.Group();
  addContactShadow(root, spec.width, spec.length, shadowTex);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: 0xd62828,
    metalness: 0.36,
    roughness: 0.28,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.68,
  });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.65, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c141f, roughness: 0.08, metalness: 0.25 });
  const alloyMat = new THREE.MeshStandardMaterial({ color: 0xdde3ea, metalness: 0.9, roughness: 0.18 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.88 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.2,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: 0xef4444,
    emissiveIntensity: 0.65,
  });

  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.58, 4.35), paintMat);
  lowerHull.position.set(0, 0.56, 0);
  lowerHull.castShadow = true;
  bodyGroup.add(lowerHull);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.46, 2.05), glassMat);
  cabin.position.set(0, 1.04, -0.2);
  cabin.castShadow = true;
  bodyGroup.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 1.45), paintMat);
  roof.position.set(0, 1.28, -0.25);
  bodyGroup.add(roof);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.1, 0.35), carbonMat);
  splitter.position.set(0, 0.28, 2.12);
  bodyGroup.add(splitter);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.06, 0.28), carbonMat);
  wing.position.set(0, 1.02, -2.02);
  bodyGroup.add(wing);

  for (const sx of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.08), headlightMat);
    hl.position.set(sx, 0.62, 2.18);
    bodyGroup.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.08), brakeLightMat);
    tl.position.set(sx, 0.68, -2.18);
    bodyGroup.add(tl);
  }

  const steerPivots: THREE.Group[] = [];
  const steerRatios: number[] = [];
  const wheelMeshes: THREE.Object3D[] = [];

  spec.axlePositionsZ.forEach((az, idx) => {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.86, spec.wheelRadius, az);
      root.add(pivot);
      const wheel = makeWheelAssembly(spec.wheelRadius, 0.25, false, alloyMat, tireMat, carbonMat);
      pivot.add(wheel);
      wheelMeshes.push(wheel);
      if (idx === 0) {
        steerPivots.push(pivot);
        steerRatios.push(1);
      }
    }
  });

  return { root, bodyGroup, steerPivots, steerRatios, wheelMeshes, brakeLightMat, headlightMat };
}

function buildCityBus(spec: VehicleSpec, shadowTex: THREE.Texture): VehicleRig {
  const root = new THREE.Group();
  addContactShadow(root, spec.width, spec.length, shadowTex);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const busBlue = new THREE.MeshPhysicalMaterial({
    color: 0x1e4e79,
    metalness: 0.35,
    roughness: 0.36,
    clearcoat: 0.6,
  });
  const roofWhite = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
  const darkTrim = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.72 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a131f, roughness: 0.08, metalness: 0.25 });
  const alloyMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.82, roughness: 0.24 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.88 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 2.0,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: 0xef4444,
    emissiveIntensity: 0.65,
  });
  const destLedMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.8,
  });

  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.05, 10.2), busBlue);
  lowerBody.position.set(0, 1.02, 0);
  lowerBody.castShadow = true;
  bodyGroup.add(lowerBody);

  const windowBand = new THREE.Mesh(new THREE.BoxGeometry(2.48, 1.15, 10.1), glassMat);
  windowBand.position.set(0, 2.1, 0);
  windowBand.castShadow = true;
  bodyGroup.add(windowBand);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.32, 10.18), roofWhite);
  roof.position.set(0, 2.82, 0);
  bodyGroup.add(roof);

  // HVAC pods
  for (const hz of [1.8, -1.8]) {
    const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 1.9), roofWhite);
    hvac.position.set(0, 3.1, hz);
    bodyGroup.add(hvac);
  }

  // Front amber route board
  const routeSign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 0.08), destLedMat);
  routeSign.position.set(0, 2.75, 5.12);
  bodyGroup.add(routeSign);

  for (const sx of [-0.95, 0.95]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headlightMat);
    hl.position.set(sx, 0.82, 5.12);
    bodyGroup.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.08), brakeLightMat);
    tl.position.set(sx, 1.05, -5.12);
    bodyGroup.add(tl);
  }

  const steerPivots: THREE.Group[] = [];
  const steerRatios: number[] = [];
  const wheelMeshes: THREE.Object3D[] = [];

  spec.axlePositionsZ.forEach((az, idx) => {
    const isRear = idx === 1;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (isRear ? 0.98 : 1.08), spec.wheelRadius, az);
      root.add(pivot);
      const wheel = makeWheelAssembly(spec.wheelRadius, 0.29, isRear, alloyMat, tireMat, darkTrim);
      pivot.add(wheel);
      wheelMeshes.push(wheel);
      if (idx === 0) {
        steerPivots.push(pivot);
        steerRatios.push(1);
      }
    }
  });

  return { root, bodyGroup, steerPivots, steerRatios, wheelMeshes, brakeLightMat, headlightMat };
}

function buildBoxTruck(spec: VehicleSpec, maxAniso: number, shadowTex: THREE.Texture): VehicleRig {
  const root = new THREE.Group();
  addContactShadow(root, spec.width, spec.length, shadowTex);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const cabPaint = new THREE.MeshPhysicalMaterial({ color: 0x335c67, metalness: 0.45, roughness: 0.34, clearcoat: 0.5 });
  const boxTex = createCorrugatedTexture('#e2e8f0', '#0284c7', maxAniso);
  const cargoMat = new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.52, metalness: 0.2 });
  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x161920, roughness: 0.72 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0b131e, roughness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.22 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.88 });
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xe0f2fe, emissiveIntensity: 2.0 });
  const brakeLightMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.65 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 6.9), chassisMat);
  chassis.position.set(0, 0.82, -0.1);
  bodyGroup.add(chassis);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.22, 1.9, 2.0), cabPaint);
  cab.position.set(0, 1.92, 2.35);
  cab.castShadow = true;
  bodyGroup.add(cab);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.78, 0.08), glassMat);
  windshield.position.set(0, 2.25, 3.34);
  bodyGroup.add(windshield);

  const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(2.42, 2.38, 4.95), cargoMat);
  cargoBox.position.set(0, 2.18, -1.18);
  cargoBox.castShadow = true;
  cargoBox.receiveShadow = true;
  bodyGroup.add(cargoBox);

  for (const sx of [-0.84, 0.84]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), headlightMat);
    hl.position.set(sx, 0.96, 3.38);
    bodyGroup.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), brakeLightMat);
    tl.position.set(sx, 0.88, -3.62);
    bodyGroup.add(tl);
  }

  const steerPivots: THREE.Group[] = [];
  const steerRatios: number[] = [];
  const wheelMeshes: THREE.Object3D[] = [];

  spec.axlePositionsZ.forEach((az, idx) => {
    const isRear = idx >= 1;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (isRear ? 0.94 : 1.0), spec.wheelRadius, az);
      root.add(pivot);
      const wheel = makeWheelAssembly(spec.wheelRadius, 0.27, isRear, rimMat, tireMat, chassisMat);
      pivot.add(wheel);
      wheelMeshes.push(wheel);
      if (idx === 0) {
        steerPivots.push(pivot);
        steerRatios.push(1);
      }
    }
  });

  return { root, bodyGroup, steerPivots, steerRatios, wheelMeshes, brakeLightMat, headlightMat };
}

export interface TrafficMeshHandle {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  brakeMat: THREE.MeshStandardMaterial;
}

export function buildTrafficVehicleMesh(
  kind: TrafficKind,
  colorHex: number,
  shadowTex: THREE.Texture,
): TrafficMeshHandle {
  const root = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.45, roughness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x161920, roughness: 0.72 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0b1420, roughness: 0.1, metalness: 0.2 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.82, roughness: 0.24 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x17191e, roughness: 0.88 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfef08a, emissiveIntensity: 1.8 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.45 });

  let length = 4.4;
  let width = 1.85;
  let wheelRadius = 0.35;
  let axleZ = [1.35, -1.35];

  if (kind === 'city_bus') {
    length = 10.0;
    width = 2.48;
    wheelRadius = 0.48;
    axleZ = [3.0, -2.7];
    addContactShadow(root, width, length, shadowTex);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(2.46, 1.0, 9.8), bodyMat);
    lower.position.set(0, 1.0, 0);
    lower.castShadow = true;
    root.add(lower);

    const win = new THREE.Mesh(new THREE.BoxGeometry(2.44, 1.1, 9.7), glassMat);
    win.position.set(0, 2.05, 0);
    root.add(win);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.28, 9.8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 }));
    roof.position.set(0, 2.74, 0);
    root.add(roof);
  } else if (kind === 'box_truck') {
    length = 7.1;
    width = 2.38;
    wheelRadius = 0.46;
    axleZ = [2.1, -1.8];
    addContactShadow(root, width, length, shadowTex);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.18, 1.85, 1.9), bodyMat);
    cab.position.set(0, 1.85, 2.25);
    cab.castShadow = true;
    root.add(cab);

    const box = new THREE.Mesh(new THREE.BoxGeometry(2.38, 2.3, 4.8), new THREE.MeshStandardMaterial({ color: 0xdbe2ea, roughness: 0.55 }));
    box.position.set(0, 2.1, -1.1);
    box.castShadow = true;
    root.add(box);
  } else if (kind === 'semi_tractor') {
    length = 6.7;
    width = 2.45;
    wheelRadius = 0.5;
    axleZ = [2.0, -1.4, -2.6];
    addContactShadow(root, width, length, shadowTex);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.35, 6.2), darkMat);
    chassis.position.set(0, 0.85, -0.2);
    root.add(chassis);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.34, 2.25, 2.4), bodyMat);
    cab.position.set(0, 2.2, 1.85);
    cab.castShadow = true;
    root.add(cab);

    const win = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.1), glassMat);
    win.position.set(0, 2.65, 3.04);
    root.add(win);
  } else {
    // sedan, taxi, sport
    addContactShadow(root, width, length, shadowTex);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.62, 4.3), bodyMat);
    body.position.set(0, 0.62, 0);
    body.castShadow = true;
    root.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.52, 2.1), glassMat);
    cabin.position.set(0, 1.15, -0.15);
    root.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 1.4), bodyMat);
    roof.position.set(0, 1.42, -0.18);
    root.add(roof);

    if (kind === 'taxi') {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.16, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.5 }),
      );
      sign.position.set(0, 1.54, 0.05);
      root.add(sign);
    }
  }

  const lightZ = length * 0.48;
  for (const sx of [-width * 0.35, width * 0.35]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.06), headMat);
    hl.position.set(sx, 0.72, lightZ);
    root.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.06), brakeMat);
    tl.position.set(sx, 0.72, -lightZ);
    root.add(tl);
  }

  for (const az of axleZ) {
    for (const side of [-1, 1]) {
      const w = makeWheelAssembly(wheelRadius, 0.24, false, rimMat, tireMat, darkMat);
      w.position.set(side * (width * 0.46), wheelRadius, az);
      root.add(w);
      wheels.push(w);
    }
  }

  return { root, wheels, brakeMat };
}

export interface SemiTrailerRig {
  root: THREE.Group;
  wheelMeshes: THREE.Object3D[];
  landingGearGroup: THREE.Group;
  brakeLightMat: THREE.MeshStandardMaterial;
  reverseLightMat: THREE.MeshStandardMaterial;
}

const LIVERY_COLORS: Record<TrailerLivery, { base: string; accent: string; hex: number; roofHex: number }> = {
  auman_silver: { base: '#8e98a6', accent: '#38bdf8', hex: 0x8e98a6, roofHex: 0x3b4452 },
  ocean_blue: { base: '#1e40af', accent: '#7dd3fc', hex: 0x1e40af, roofHex: 0x1e3a8a },
  crimson_haul: { base: '#991b1b', accent: '#fbbf24', hex: 0x991b1b, roofHex: 0x450a0a },
  amber_chrome: { base: '#b45309', accent: '#fef08a', hex: 0xcbd5e1, roofHex: 0x94a3b8 },
};

export function buildSemiTrailerRig(
  maxAniso: number,
  shadowTex: THREE.Texture,
  variant: TrailerVariant = 'container',
  livery: TrailerLivery = 'auman_silver',
  length = 12.2,
  kingpinLocalZ = 4.3,
): SemiTrailerRig {
  const root = new THREE.Group();
  const width = variant === 'flatbed' ? 2.54 : 2.5;
  addContactShadow(root, width, length, shadowTex);

  const pal = LIVERY_COLORS[livery];
  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x151820, metalness: 0.48, roughness: 0.65 });
  const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x11141a, metalness: 0.25, roughness: 0.72 });
  const roofMat = new THREE.MeshStandardMaterial({
    color: pal.roofHex,
    metalness: 0.28,
    roughness: 0.68,
    envMapIntensity: 0.24,
  });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.16 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.88 });
  const amberMarkerMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.9,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: 0xef4444,
    emissiveIntensity: 0.65,
  });
  const reverseLightMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
  });

  // 1. Underframe Steel Chassis Rails & Kingpin Plate
  const underframe = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.26, length - 0.35), chassisMat);
  underframe.position.set(0, 1.24, -0.05);
  root.add(underframe);

  const kingpin = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 12), chromeMat);
  kingpin.position.set(0, 1.12, kingpinLocalZ);
  root.add(kingpin);

  // Side amber LED clearance markers
  for (const sx of [-1.22, 1.22]) {
    for (const mz of [length * 0.42, length * 0.18, 0, -length * 0.18, -length * 0.42]) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.14), amberMarkerMat);
      marker.position.set(sx + Math.sign(sx) * 0.04, 1.38, mz);
      root.add(marker);
    }
  }

  // 2. Variant Superstructure
  if (variant === 'container') {
    // 40ft ISO Intermodal Container mounted on skeleton chassis frame
    const sideTexL = createTrailerLiveryTexture(maxAniso, false, livery);
    const sideTexR = createTrailerLiveryTexture(maxAniso, true, livery);
    const corrMat = new THREE.MeshStandardMaterial({
      map: createCorrugatedTexture(pal.base, pal.accent, maxAniso),
      metalness: 0.25,
      roughness: 0.52,
    });
    const cSideL = new THREE.MeshStandardMaterial({ map: sideTexL, metalness: 0.28, roughness: 0.48 });
    const cSideR = new THREE.MeshStandardMaterial({ map: sideTexR, metalness: 0.28, roughness: 0.48 });

    const isoBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.44, 2.68, length - 0.15),
      [cSideL, cSideR, corrMat, chassisMat, corrMat, corrMat],
    );
    isoBox.position.set(0, 2.72, 0);
    isoBox.castShadow = true;
    isoBox.receiveShadow = true;
    root.add(isoBox);

    // Twist-lock corner bolsters
    for (const cx of [-1.22, 1.22]) {
      for (const cz of [length * 0.46, -length * 0.46]) {
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.26), obsidianMat);
        lock.position.set(cx, 1.38, cz);
        root.add(lock);
      }
    }
    for (const rx of [-0.45, 0.45]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.4, 8), chromeMat);
      rod.position.set(rx, 2.72, -length * 0.5 + 0.03);
      root.add(rod);
    }
  } else if (variant === 'tanker') {
    // Stainless / Livery Cryo & Fuel Barrel Tanker
    const tankMat = new THREE.MeshStandardMaterial({
      color: livery === 'auman_silver' || livery === 'amber_chrome' ? 0xdbe4ee : pal.hex,
      metalness: 0.72,
      roughness: 0.22,
      envMapIntensity: 0.78,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: livery === 'amber_chrome' ? 0xd97706 : 0x0f172a,
      roughness: 0.42,
      metalness: 0.35,
    });

    const barrelLen = length - 1.1;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, barrelLen, 20), tankMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 2.55, 0);
    barrel.castShadow = true;
    root.add(barrel);

    // Elliptical front & rear tank dome caps
    for (const ez of [barrelLen * 0.5, -barrelLen * 0.5]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.12, 18, 12), tankMat);
      cap.scale.set(1, 1, 0.42);
      cap.position.set(0, 2.55, ez);
      root.add(cap);
    }

    // Structural mounting saddles & stripe bands
    for (const bz of [barrelLen * 0.3, 0, -barrelLen * 0.3]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.32, 20), bandMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 2.55, bz);
      root.add(ring);

      const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.16, 12), obsidianMat);
      hatch.position.set(0, 3.74, bz);
      root.add(hatch);
    }

    // Top safety catwalk & rear ladder
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, barrelLen * 0.85), chassisMat);
    catwalk.position.set(0, 3.7, 0);
    root.add(catwalk);

    const valveBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 0.42), obsidianMat);
    valveBox.position.set(0, 1.45, -length * 0.32);
    root.add(valveBox);
  } else {
    // Heavy Steel-Coil Flatbed Trailer
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x5c432d, roughness: 0.86, metalness: 0.05 });
    const railMat = new THREE.MeshStandardMaterial({ color: pal.hex, roughness: 0.45, metalness: 0.45 });
    const coilMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.86, roughness: 0.25 });
    const crateMat = new THREE.MeshStandardMaterial({
      map: createCorrugatedTexture('#92400e', '#f59e0b', maxAniso),
      roughness: 0.72,
    });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, length), deckMat);
    deck.position.set(0, 1.44, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    root.add(deck);

    for (const sx of [-width * 0.49, width * 0.49]) {
      const rubRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, length), railMat);
      rubRail.position.set(sx, 1.45, 0);
      root.add(rubRail);
    }

    // Front steel headache rack
    const rack = new THREE.Mesh(new THREE.BoxGeometry(2.44, 1.65, 0.14), railMat);
    rack.position.set(0, 2.35, length * 0.5 - 0.12);
    rack.castShadow = true;
    root.add(rack);

    // 2 Massive strapped industrial steel coils + freight crate
    for (const cz of [2.5, -0.4]) {
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 1.4, 18), coilMat);
      coil.rotation.z = Math.PI / 2;
      coil.position.set(0, 2.36, cz);
      coil.castShadow = true;
      root.add(coil);

      const strap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.7), obsidianMat);
      strap.position.set(0, 1.6, cz);
      root.add(strap);
    }

    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.25, 2.4), crateMat);
    crate.position.set(0, 2.16, -3.4);
    crate.castShadow = true;
    root.add(crate);
  }

  // 3. Retractable Landing Gear Legs
  const landingGearGroup = new THREE.Group();
  const legZ = kingpinLocalZ - 1.9;
  for (const sx of [-0.66, 0.66]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, 0.16), chassisMat);
    leg.position.set(sx, 0.65, legZ);
    landingGearGroup.add(leg);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.34), obsidianMat);
    pad.position.set(sx, 0.04, legZ);
    landingGearGroup.add(pad);
  }
  const crossBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), chassisMat);
  crossBrace.rotation.z = Math.PI / 2;
  crossBrace.position.set(0, 0.42, legZ);
  landingGearGroup.add(crossBrace);
  landingGearGroup.position.y = 0.42;
  root.add(landingGearGroup);

  // 4. ICC Underride Bumper, Mudflaps & Tail/Brake/Reverse Lights
  const iccBumper = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.18, 0.18), chromeMat);
  iccBumper.position.set(0, 0.68, -length * 0.5 + 0.06);
  root.add(iccBumper);

  for (const sx of [-0.94, 0.94]) {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.04), obsidianMat);
    flap.position.set(sx, 0.62, -length * 0.5 + 0.32);
    root.add(flap);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.08), brakeLightMat);
    tail.position.set(sx, 1.18, -length * 0.5 - 0.02);
    root.add(tail);

    const rev = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), reverseLightMat);
    rev.position.set(sx * 0.6, 1.18, -length * 0.5 - 0.02);
    root.add(rev);
  }

  // 5. Rear Tandem / Tridem Dual-Tire Axles
  const wheelMeshes: THREE.Object3D[] = [];
  const wheelRadius = 0.52;
  const axleZs = variant === 'container' || variant === 'flatbed' ? [-2.4, -3.7, -5.0] : [-2.85, -4.15];
  for (const az of axleZs) {
    for (const side of [-1, 1]) {
      const wheel = makeWheelAssembly(wheelRadius, 0.3, true, chromeMat, tireMat, obsidianMat);
      wheel.position.set(side * 0.96, wheelRadius, az);
      root.add(wheel);
      wheelMeshes.push(wheel);
    }
  }

  return { root, wheelMeshes, landingGearGroup, brakeLightMat, reverseLightMat };
}


