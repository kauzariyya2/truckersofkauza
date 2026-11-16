import * as THREE from 'three';
import type { PedestrianState } from '../sim/types';

export interface PedestrianMeshHandle {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

const _sharedHeadGeo = new THREE.SphereGeometry(0.14, 10, 8);
const _sharedTorsoGeo = new THREE.BoxGeometry(0.42, 0.56, 0.24);
const _sharedVestStripeGeo = new THREE.BoxGeometry(0.44, 0.08, 0.26);
const _sharedHatGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.09, 10);
const _sharedLimbGeo = new THREE.BoxGeometry(0.13, 0.54, 0.14);
const _sharedShoeGeo = new THREE.BoxGeometry(0.14, 0.09, 0.2);

export function buildPedestrianMesh(
  ped: PedestrianState,
  shadowTex: THREE.Texture,
): PedestrianMeshHandle {
  const root = new THREE.Group();

  // Contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xdba986, roughness: 0.72 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: ped.shirtHex, roughness: 0.78 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: ped.pantsHex, roughness: 0.85 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
  const hatMat = new THREE.MeshStandardMaterial({
    color: ped.role === 'worker' ? 0xfacc15 : 0x1e293b,
    roughness: 0.45,
  });

  // Torso (grounded via leg height 0.72 + half torso 0.28 = 1.00)
  const torso = new THREE.Mesh(_sharedTorsoGeo, shirtMat);
  torso.position.set(0, 1.04, 0);
  torso.castShadow = true;
  root.add(torso);

  if (ped.role === 'worker') {
    const hiVisMat = new THREE.MeshStandardMaterial({
      color: 0xeef2ff,
      emissive: 0xfef08a,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    });
    const stripe = new THREE.Mesh(_sharedVestStripeGeo, hiVisMat);
    stripe.position.set(0, 1.02, 0);
    root.add(stripe);
  }

  // Head & Hard Hat / Hair
  const head = new THREE.Mesh(_sharedHeadGeo, skinMat);
  head.position.set(0, 1.48, 0);
  head.castShadow = true;
  root.add(head);

  const hat = new THREE.Mesh(_sharedHatGeo, hatMat);
  hat.position.set(0, 1.59, 0);
  root.add(hat);

  // Arms
  const makeArm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.28, 0);
    const arm = new THREE.Mesh(_sharedLimbGeo, shirtMat);
    arm.position.set(0, -0.24, 0);
    arm.castShadow = true;
    pivot.add(arm);
    root.add(pivot);
    return pivot;
  };
  const leftArm = makeArm(-0.28);
  const rightArm = makeArm(0.28);

  // Legs
  const makeLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.76, 0);
    const leg = new THREE.Mesh(_sharedLimbGeo, pantsMat);
    leg.position.set(0, -0.27, 0);
    leg.castShadow = true;
    pivot.add(leg);

    const shoe = new THREE.Mesh(_sharedShoeGeo, shoeMat);
    shoe.position.set(0, -0.71, 0.03);
    pivot.add(shoe);

    root.add(pivot);
    return pivot;
  };
  const leftLeg = makeLeg(-0.11);
  const rightLeg = makeLeg(0.11);

  return { root, leftArm, rightArm, leftLeg, rightLeg };
}
