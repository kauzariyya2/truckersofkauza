import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAsphaltTextures, createCorrugatedTexture } from './proceduralTextures';
import { PARKING_BAYS, SIDEWALK_ISLANDS, WORLD_COLLIDERS } from '../sim/worldData';

export interface BayVisualHandle {
  id: string;
  frameMat: THREE.MeshStandardMaterial;
}

export interface WorldBuildResult {
  collidableMeshes: THREE.Object3D[];
  bayVisuals: Map<string, BayVisualHandle>;
  dispose: () => void;
}

export function buildSimulationWorld(
  scene: THREE.Scene,
  maxAniso: number,
  isSoftwareGl: boolean,
): WorldBuildResult {
  const collidableMeshes: THREE.Object3D[] = [];
  const bayVisuals = new Map<string, BayVisualHandle>();

  // 1. Twilight Sky Dome + Horizon-Matched Fog
  const fogColor = new THREE.Color(0x1e293d);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(0x1e293d, 0.0023);

  const skyGeo = new THREE.SphereGeometry(620, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x151e30) },
      uMid: { value: new THREE.Color(0x3a4a6b) },
      uHorizon: { value: new THREE.Color(0x8c6258) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      void main() {
        float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.24, h));
        col = mix(col, uTop, smoothstep(0.24, 0.72, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // 2. Warm/Cool Lighting Rig (<= 1 Shadow Caster)
  const hemi = new THREE.HemisphereLight(0x7aa2d4, 0x1e242e, 1.08);
  hemi.position.set(0, 120, 0);
  scene.add(hemi);

  const sunKey = new THREE.DirectionalLight(0xffbe82, 2.15);
  sunKey.position.set(95, 72, -105);
  if (!isSoftwareGl) {
    sunKey.castShadow = true;
    sunKey.shadow.mapSize.set(1024, 1024);
    sunKey.shadow.camera.near = 10;
    sunKey.shadow.camera.far = 360;
    sunKey.shadow.camera.left = -140;
    sunKey.shadow.camera.right = 140;
    sunKey.shadow.camera.top = 140;
    sunKey.shadow.camera.bottom = -140;
    sunKey.shadow.bias = -0.0005;
    sunKey.shadow.normalBias = 0.02;
  }
  scene.add(sunKey);

  const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.72);
  rimLight.position.set(-100, 45, 110);
  scene.add(rimLight);

  // Warm depot bay glow + cyan apron highlight (within 4-pointlight cap)
  const depotGlow = new THREE.PointLight(0xffa94d, 26, 36, 1.4);
  depotGlow.position.set(-37, 5.2, -12);
  scene.add(depotGlow);

  const apronGlow = new THREE.PointLight(0x7dd3fc, 10, 28, 1.6);
  apronGlow.position.set(-20, 4.5, -6);
  scene.add(apronGlow);

  // 3. Expanded 480m Terrain, Harbor Water & Asphalt Network
  const baseTerrainMat = new THREE.MeshStandardMaterial({
    color: 0x1e2b24,
    roughness: 0.92,
    metalness: 0.05,
  });
  const baseTerrain = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), baseTerrainMat);
  baseTerrain.rotation.x = -Math.PI / 2;
  baseTerrain.position.y = 0;
  baseTerrain.receiveShadow = true;
  scene.add(baseTerrain);

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x162638,
    roughness: 0.14,
    metalness: 0.72,
  });
  const waterPlane = new THREE.Mesh(new THREE.RingGeometry(275, 580, 48), waterMat);
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.y = 0.01;
  scene.add(waterPlane);

  const { map: asphaltMap, roughnessMap: asphaltRough } = createAsphaltTextures(maxAniso);
  asphaltMap.repeat.set(34, 34);
  asphaltRough.repeat.set(34, 34);
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x6c7380,
    map: asphaltMap,
    roughnessMap: asphaltRough,
    roughness: 0.94,
    metalness: 0.02,
    envMapIntensity: 0.14,
  });

  const roadBase = new THREE.Mesh(new THREE.PlaneGeometry(408, 408), asphaltMat);
  roadBase.rotation.x = -Math.PI / 2;
  roadBase.position.y = 0.025;
  roadBase.receiveShadow = true;
  scene.add(roadBase);

  // Raised Sidewalk / Curb Islands under city blocks
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x3b4250,
    roughness: 0.85,
    metalness: 0.08,
  });
  for (const padSpec of SIDEWALK_ISLANDS) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(padSpec.w, 0.14, padSpec.d), sidewalkMat);
    pad.position.set(padSpec.x, 0.07, padSpec.z);
    pad.receiveShadow = true;
    scene.add(pad);
  }

  // 4. Crisp 3-Lane Highway Markings, Edge Lines, Arterials & Zebra Crosswalks (Instanced for speed)
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.62,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const yellowLineMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.62,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // Solid edge & median lines on Grand N-S 3-Lane Highway (X = 32)
  for (const lx of [18.8, 45.2]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 384), stripeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(lx, 0.045, 0);
    scene.add(edge);
  }
  for (const lx of [30.7, 33.3]) {
    const medLine = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 384), yellowLineMat);
    medLine.rotation.x = -Math.PI / 2;
    medLine.position.set(lx, 0.045, 0);
    scene.add(medLine);
  }

  // Solid edge & median lines on Grand E-W 3-Lane Expressway (Z = 50)
  for (const lz of [36.8, 63.2]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(384, 0.28), stripeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.045, lz);
    scene.add(edge);
  }
  for (const lz of [48.7, 51.3]) {
    const medLine = new THREE.Mesh(new THREE.PlaneGeometry(384, 0.24), yellowLineMat);
    medLine.rotation.x = -Math.PI / 2;
    medLine.position.set(0, 0.045, lz);
    scene.add(medLine);
  }

  // Secondary arterial center yellow lines (Mid-North Z=-84, Mid-South Z=118, West Collector X=-104, Outer Ring ±184)
  for (const zPos of [-84, 118, -184, 184]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(368, 0.22), yellowLineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.045, zPos);
    scene.add(line);
  }
  for (const xPos of [-104, -184, 184]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 368), yellowLineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(xPos, 0.045, 0);
    scene.add(line);
  }

  // Instanced dashed white lane dividers across ALL 3-lane highway lanes + zebra crosswalks!
  const dashTransforms: Array<{ x: number; z: number; rotY: number; sx: number; sz: number }> = [];
  // 4 dashed dividers on Grand N-S 3-Lane Highway (separating 3 SB lanes & 3 NB lanes)
  for (const lx of [22.8, 26.8, 37.2, 41.2]) {
    for (let z = -184; z <= 184; z += 9) {
      if (Math.abs(z - 50) < 16 || Math.abs(z + 84) < 7 || Math.abs(z - 118) < 7) continue;
      dashTransforms.push({ x: lx, z, rotY: 0, sx: 0.22, sz: 3.8 });
    }
  }
  // 4 dashed dividers on Grand E-W 3-Lane Expressway (separating 3 WB lanes & 3 EB lanes)
  for (const lz of [40.8, 44.8, 55.2, 59.2]) {
    for (let x = -184; x <= 184; x += 9) {
      if (Math.abs(x - 32) < 16 || Math.abs(x + 104) < 7) continue;
      dashTransforms.push({ x, z: lz, rotY: Math.PI / 2, sx: 0.22, sz: 3.8 });
    }
  }
  // Zebra crosswalk bars at pedestrian crossings
  const crosswalks: Array<{ x: number; z: number; dir: 'x' | 'z' }> = [
    { x: 96, z: -31, dir: 'x' },
    { x: 96, z: -37, dir: 'x' },
    { x: 52, z: -34, dir: 'z' },
    { x: -12, z: 24, dir: 'x' },
    { x: -104, z: 28, dir: 'z' },
  ];
  for (const cw of crosswalks) {
    for (let k = -3; k <= 3; k++) {
      if (cw.dir === 'x') {
        dashTransforms.push({ x: cw.x + k * 0.9, z: cw.z, rotY: 0, sx: 0.45, sz: 2.6 });
      } else {
        dashTransforms.push({ x: cw.x, z: cw.z + k * 0.9, rotY: Math.PI / 2, sx: 0.45, sz: 2.6 });
      }
    }
  }

  const dashGeo = new THREE.PlaneGeometry(1, 1);
  dashGeo.rotateX(-Math.PI / 2);
  const dashInst = new THREE.InstancedMesh(dashGeo, stripeMat, dashTransforms.length);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < dashTransforms.length; i++) {
    const dt = dashTransforms[i];
    dummy.position.set(dt.x, 0.046, dt.z);
    dummy.rotation.set(0, dt.rotY, 0);
    dummy.scale.set(dt.sx, 1, dt.sz);
    dummy.updateMatrix();
    dashInst.setMatrixAt(i, dummy.matrix);
  }
  dashInst.instanceMatrix.needsUpdate = true;
  dashInst.computeBoundingSphere();
  scene.add(dashInst);

  // Overhead 3-Lane Highway Steel Gantries
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.72, roughness: 0.35 });
  const signMat = new THREE.MeshStandardMaterial({
    color: 0x065f46,
    emissive: 0x047857,
    emissiveIntensity: 0.35,
    roughness: 0.45,
  });
  const signTextBarMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe2e8f0,
    emissiveIntensity: 0.65,
  });
  const addHighwayGantry = (gx: number, gz: number, rotY: number) => {
    const g = new THREE.Group();
    g.position.set(gx, 0, gz);
    g.rotation.y = rotY;
    for (const px of [-14.2, 14.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 7.6, 10), gantryMat);
      post.position.set(px, 3.8, 0);
      g.add(post);
    }
    const truss = new THREE.Mesh(new THREE.BoxGeometry(29.2, 0.55, 0.55), gantryMat);
    truss.position.set(0, 7.4, 0);
    g.add(truss);
    for (const sx of [-7.0, 7.0]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.85, 0.16), signMat);
      board.position.set(sx, 7.3, 0);
      g.add(board);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.28, 0.2), signTextBarMat);
      bar.position.set(sx, 7.35, 0);
      g.add(bar);
    }
    scene.add(g);
  };
  addHighwayGantry(32, -64, 0);
  addHighwayGantry(32, 92, 0);
  addHighwayGantry(-68, 50, Math.PI / 2);
  addHighwayGantry(102, 50, Math.PI / 2);

  // 5. Buildings, Depot Warehouse Bay, Shipping Containers, Medians & Bollards
  const buildingWallMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.82, metalness: 0.1 });
  const warehouseSteelMat = new THREE.MeshStandardMaterial({
    map: createCorrugatedTexture('#475569', '#f59e0b', maxAniso),
    roughness: 0.56,
    metalness: 0.38,
  });
  const roofDarkMat = new THREE.MeshStandardMaterial({ color: 0x242b38, roughness: 0.7, metalness: 0.3 });
  const containerBlueMat = new THREE.MeshStandardMaterial({
    map: createCorrugatedTexture('#1e40af', '#cbd5e1', maxAniso),
    roughness: 0.55,
    metalness: 0.3,
  });
  const containerAmberMat = new THREE.MeshStandardMaterial({
    map: createCorrugatedTexture('#b45309', '#fde68a', maxAniso),
    roughness: 0.55,
    metalness: 0.3,
  });
  const containerRedMat = new THREE.MeshStandardMaterial({
    map: createCorrugatedTexture('#991b1b', '#e2e8f0', maxAniso),
    roughness: 0.55,
    metalness: 0.3,
  });
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.25 });
  const bollardCapMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.78 });
  const medianMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.78 });
  const windowLitMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });

  // Depot Warehouse Canopy Roof
  const depotRoof = new THREE.Mesh(new THREE.BoxGeometry(24, 0.55, 36), roofDarkMat);
  depotRoof.position.set(-41, 8.7, -11);
  depotRoof.castShadow = true;
  scene.add(depotRoof);

  for (const lz of [-20, -12, -4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 4.2), windowLitMat);
    strip.position.set(-34, 8.35, lz);
    scene.add(strip);
  }

  for (let i = 0; i < WORLD_COLLIDERS.length; i++) {
    const col = WORLD_COLLIDERS[i];
    const w = col.halfW * 2;
    const d = col.halfD * 2;

    if (col.kind === 'bollard') {
      const grp = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, col.height, 12), bollardMat);
      post.position.y = col.height * 0.5;
      post.castShadow = true;
      grp.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.18, 12), bollardCapMat);
      cap.position.y = col.height - 0.12;
      grp.add(cap);
      grp.position.set(col.x, 0.02, col.z);
      scene.add(grp);
      collidableMeshes.push(post);
      continue;
    }

    if (col.kind === 'median') {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, col.height, d), medianMat);
      mesh.position.set(col.x, col.height * 0.5 + 0.02, col.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      collidableMeshes.push(mesh);

      const capStrip = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 0.26), 0.1, Math.min(d, 0.26) === 0.26 ? d : d), yellowLineMat);
      capStrip.position.set(col.x, col.height + 0.04, col.z);
      scene.add(capStrip);
      continue;
    }

    if (col.kind === 'container') {
      const mat =
        col.id.includes('2') ? containerAmberMat : col.id.includes('3') ? containerRedMat : containerBlueMat;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, col.height, d), mat);
      mesh.position.set(col.x, col.height * 0.5 + 0.02, col.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      collidableMeshes.push(mesh);
      continue;
    }

    if (col.kind === 'barrier') {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, col.height, d), barrierMat);
      mesh.position.set(col.x, col.height * 0.5 + 0.02, col.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      collidableMeshes.push(mesh);
      continue;
    }

    const mat = col.id.startsWith('wh_') ? warehouseSteelMat : buildingWallMat;
    const bMesh = new THREE.Mesh(new THREE.BoxGeometry(w, col.height, d), mat);
    bMesh.position.set(col.x, col.height * 0.5 + 0.02, col.z);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    scene.add(bMesh);
    collidableMeshes.push(bMesh);

    if (col.kind === 'building' && !col.id.startsWith('wh_')) {
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.45, d + 0.4), roofDarkMat);
      cornice.position.set(col.x, col.height + 0.2, col.z);
      scene.add(cornice);

      const winBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.75, d * 0.7), windowLitMat);
      winBand.position.set(col.x, col.height * 0.62, col.z);
      scene.add(winBand);
    }
  }

  // Fuel Station Canopy over fuel_p1 & fuel_p2 (X=-136, Z=76)
  const fuelRoof = new THREE.Mesh(new THREE.BoxGeometry(20, 0.55, 7), roofDarkMat);
  fuelRoof.position.set(-136, 5.25, 76);
  fuelRoof.castShadow = true;
  scene.add(fuelRoof);

  // 6. Precision Parking & Freight Trailer Bays
  for (const bay of PARKING_BAYS) {
    const bayGroup = new THREE.Group();
    bayGroup.position.set(bay.x, 0.048, bay.z);
    bayGroup.rotation.y = bay.heading;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.35,
      roughness: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const hw = bay.width * 0.5;
    const hl = bay.length * 0.5;
    const barThick = 0.24;

    const leftBar = new THREE.Mesh(new THREE.PlaneGeometry(barThick, bay.length), frameMat);
    leftBar.rotation.x = -Math.PI / 2;
    leftBar.position.set(-hw, 0, 0);
    bayGroup.add(leftBar);

    const rightBar = new THREE.Mesh(new THREE.PlaneGeometry(barThick, bay.length), frameMat);
    rightBar.rotation.x = -Math.PI / 2;
    rightBar.position.set(hw, 0, 0);
    bayGroup.add(rightBar);

    const frontBar = new THREE.Mesh(new THREE.PlaneGeometry(bay.width + barThick, barThick), frameMat);
    frontBar.rotation.x = -Math.PI / 2;
    frontBar.position.set(0, 0, hl);
    bayGroup.add(frontBar);

    const backBar = new THREE.Mesh(new THREE.PlaneGeometry(bay.width + barThick, barThick), frameMat);
    backBar.rotation.x = -Math.PI / 2;
    backBar.position.set(0, 0, -hl);
    bayGroup.add(backBar);

    for (const cx of [-hw, hw]) {
      for (const cz of [-hl, hl]) {
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.6, 8), frameMat);
        cone.position.set(cx, 0.3, cz);
        bayGroup.add(cone);
      }
    }

    scene.add(bayGroup);
    bayVisuals.set(bay.id, { id: bay.id, frameMat });
  }

  // 7. Instanced Tropical Palm Trees across the 480m World
  const palmPositions: Array<[number, number]> = [
    [-64, -28], [-64, -22], [-66, 20], [-52, 24], [-18, -36],
    [14, -120], [14, -70], [14, -22], [14, 72], [14, 130], [14, 170],
    [50, -120], [50, -70], [50, -22], [50, 72], [50, 130], [50, 170],
    [-198, -198], [-150, -198], [-100, -198], [-50, -198], [0, -198], [60, -198], [120, -198], [198, -198],
    [198, -140], [198, -80], [198, -20], [198, 40], [198, 100], [198, 160], [198, 198],
    [140, 198], [80, 198], [0, 198], [-60, 198], [-120, 198], [-198, 198],
    [-198, 140], [-198, 80], [-198, 20], [-198, -40], [-198, -100], [-198, -150],
  ];

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 8.2, 8);
  trunkGeo.translate(0, 4.1, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4e3c30, roughness: 0.92 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPositions.length);
  trunkInst.castShadow = true;

  const frondParts: THREE.BufferGeometry[] = [];
  for (let f = 0; f < 7; f++) {
    const angle = (f / 7) * Math.PI * 2;
    const frond = new THREE.BoxGeometry(0.62, 0.12, 3.3);
    frond.translate(0, 0, 1.55);
    frond.rotateX(0.32);
    frond.rotateY(angle);
    frond.translate(0, 8.2, 0);
    frondParts.push(frond);
  }
  const crownGeo = mergeGeometries(frondParts);
  frondParts.forEach((g) => g.dispose());
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x264e34, roughness: 0.82 });
  const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, palmPositions.length);
  crownInst.castShadow = true;

  const tintColor = new THREE.Color();
  palmPositions.forEach(([px, pz], idx) => {
    const scale = 0.85 + ((idx * 37) % 30) / 100;
    const tiltX = (((idx * 13) % 10) - 5) * 0.015;
    const tiltZ = (((idx * 23) % 10) - 5) * 0.015;
    dummy.position.set(px, 0, pz);
    dummy.rotation.set(tiltX, idx * 1.1, tiltZ);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    crownInst.setMatrixAt(idx, dummy.matrix);

    const gShift = 0.88 + ((idx * 19) % 24) / 100;
    tintColor.setRGB(0.2 * gShift, 0.42 * gShift, 0.26 * gShift);
    crownInst.setColorAt(idx, tintColor);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();
  scene.add(trunkInst);
  scene.add(crownInst);

  // 8. Instanced Highway & Boulevard Streetlights
  const lightPositions: Array<[number, number, number]> = [
    [16.5, -140, 0], [16.5, -95, 0], [16.5, -45, 0], [16.5, 0, 0], [16.5, 80, 0], [16.5, 140, 0],
    [47.5, -140, Math.PI], [47.5, -95, Math.PI], [47.5, -45, Math.PI], [47.5, 0, Math.PI], [47.5, 80, Math.PI], [47.5, 140, Math.PI],
    [-140, 34.5, Math.PI / 2], [-70, 34.5, Math.PI / 2], [-10, 34.5, Math.PI / 2], [90, 34.5, Math.PI / 2], [150, 34.5, Math.PI / 2],
    [-140, 65.5, -Math.PI / 2], [-70, 65.5, -Math.PI / 2], [-10, 65.5, -Math.PI / 2], [90, 65.5, -Math.PI / 2], [150, 65.5, -Math.PI / 2],
  ];
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 7.2, 8);
  poleGeo.translate(0, 3.6, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lightPositions.length);

  const lampGeo = new THREE.BoxGeometry(1.1, 0.18, 0.4);
  lampGeo.translate(0.45, 7.15, 0);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfbbf24,
    emissiveIntensity: 1.8,
  });
  const lampInst = new THREE.InstancedMesh(lampGeo, lampMat, lightPositions.length);

  lightPositions.forEach(([lx, lz, rot], idx) => {
    dummy.position.set(lx, 0, lz);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(idx, dummy.matrix);
    lampInst.setMatrixAt(idx, dummy.matrix);
  });
  poleInst.instanceMatrix.needsUpdate = true;
  lampInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  lampInst.computeBoundingSphere();
  scene.add(poleInst);
  scene.add(lampInst);

  return {
    collidableMeshes,
    bayVisuals,
    dispose: () => {
      skyGeo.dispose();
      skyMat.dispose();
      asphaltMap.dispose();
      asphaltRough.dispose();
      dashGeo.dispose();
    },
  };
}
