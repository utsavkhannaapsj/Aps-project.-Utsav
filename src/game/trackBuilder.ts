import * as THREE from 'three';
import { Obstacle, TrackWaypoint } from '../types/game';
import {
  createAsphaltTexture,
  createCheckeredTexture,
  createKerbTexture,
  createTerrainTexture,
} from './proceduralGraphics';
import { TRACK_WIDTH } from './raceLogic';

export interface BuiltTrack {
  trackMesh: THREE.Mesh;
  kerbLeftMesh: THREE.Mesh;
  kerbRightMesh: THREE.Mesh;
  finishLineMesh: THREE.Mesh;
  terrainMesh: THREE.Mesh;
  environmentGroup: THREE.Group;
  obstacles: Obstacle[];
}

/**
 * Generate complete 3D track meshes, curbs, finish line, and environment props
 */
export function buildTrackScene(waypoints: TrackWaypoint[]): BuiltTrack {
  const n = waypoints.length;

  // 1. Build Track Surface Ribbon
  const trackPositions: number[] = [];
  const trackUvs: number[] = [];
  const trackIndices: number[] = [];

  // Kerb geometries (left and right)
  const kerbLPositions: number[] = [];
  const kerbLUvs: number[] = [];
  const kerbLIndices: number[] = [];

  const kerbRPositions: number[] = [];
  const kerbRUvs: number[] = [];
  const kerbRIndices: number[] = [];

  const kerbWidth = 1.6;

  for (let i = 0; i < n; i++) {
    const wp = waypoints[i];
    const halfW = wp.width * 0.5;

    // Track road left & right
    const lx = wp.x - wp.normalX * halfW;
    const lz = wp.z - wp.normalZ * halfW;
    const rx = wp.x + wp.normalX * halfW;
    const rz = wp.z + wp.normalZ * halfW;

    const vCoord = wp.distance * 0.15; // Texture repeat rate along track

    trackPositions.push(lx, 0.04, lz);
    trackUvs.push(0, vCoord);

    trackPositions.push(rx, 0.04, rz);
    trackUvs.push(1, vCoord);

    // Left Kerb
    const kl_outer_x = lx - wp.normalX * kerbWidth;
    const kl_outer_z = lz - wp.normalZ * kerbWidth;
    kerbLPositions.push(kl_outer_x, 0.05, kl_outer_z);
    kerbLUvs.push(0, wp.distance * 0.4);
    kerbLPositions.push(lx, 0.05, lz);
    kerbLUvs.push(1, wp.distance * 0.4);

    // Right Kerb
    const kr_outer_x = rx + wp.normalX * kerbWidth;
    const kr_outer_z = rz + wp.normalZ * kerbWidth;
    kerbRPositions.push(rx, 0.05, rz);
    kerbRUvs.push(0, wp.distance * 0.4);
    kerbRPositions.push(kr_outer_x, 0.05, kr_outer_z);
    kerbRUvs.push(1, wp.distance * 0.4);
  }

  // Create indexed quads between i and (i+1)%n
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;

    const i0 = i * 2;
    const i1 = i * 2 + 1;
    const i2 = next * 2;
    const i3 = next * 2 + 1;

    // Road indices
    trackIndices.push(i0, i1, i2);
    trackIndices.push(i1, i3, i2);

    // Left Kerb
    kerbLIndices.push(i0, i1, i2);
    kerbLIndices.push(i1, i3, i2);

    // Right Kerb
    kerbRIndices.push(i0, i1, i2);
    kerbRIndices.push(i1, i3, i2);
  }

  // Asphalt road mesh
  const trackGeo = new THREE.BufferGeometry();
  trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(trackPositions, 3));
  trackGeo.setAttribute('uv', new THREE.Float32BufferAttribute(trackUvs, 2));
  trackGeo.setIndex(trackIndices);
  trackGeo.computeVertexNormals();

  const asphaltTex = createAsphaltTexture();
  const trackMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.85,
    metalness: 0.1,
  });
  const trackMesh = new THREE.Mesh(trackGeo, trackMat);
  trackMesh.receiveShadow = true;

  // Kerbs
  const kerbTex = createKerbTexture();
  const kerbMat = new THREE.MeshStandardMaterial({
    map: kerbTex,
    roughness: 0.6,
  });

  const kerbLGeo = new THREE.BufferGeometry();
  kerbLGeo.setAttribute('position', new THREE.Float32BufferAttribute(kerbLPositions, 3));
  kerbLGeo.setAttribute('uv', new THREE.Float32BufferAttribute(kerbLUvs, 2));
  kerbLGeo.setIndex(kerbLIndices);
  kerbLGeo.computeVertexNormals();
  const kerbLeftMesh = new THREE.Mesh(kerbLGeo, kerbMat);

  const kerbRGeo = new THREE.BufferGeometry();
  kerbRGeo.setAttribute('position', new THREE.Float32BufferAttribute(kerbRPositions, 3));
  kerbRGeo.setAttribute('uv', new THREE.Float32BufferAttribute(kerbRUvs, 2));
  kerbRGeo.setIndex(kerbRIndices);
  kerbRGeo.computeVertexNormals();
  const kerbRightMesh = new THREE.Mesh(kerbRGeo, kerbMat);

  // Checkered start/finish line
  const finishGeo = new THREE.PlaneGeometry(TRACK_WIDTH, 4);
  finishGeo.rotateX(-Math.PI / 2);
  const finishMat = new THREE.MeshStandardMaterial({
    map: createCheckeredTexture(),
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const finishLineMesh = new THREE.Mesh(finishGeo, finishMat);
  const wp0 = waypoints[0];
  finishLineMesh.position.set(wp0.x, 0.06, wp0.z);
  finishLineMesh.rotation.y = Math.atan2(wp0.tangentX, wp0.tangentZ);

  // Large surrounding terrain
  const terrainGeo = new THREE.PlaneGeometry(1000, 1000, 32, 32);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: createTerrainTexture(),
    roughness: 0.95,
    metalness: 0.05,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.position.y = 0;
  terrainMesh.receiveShadow = true;

  // Environment Group: Grandstands, start gantry, floodlights, trees, tire walls
  const environmentGroup = new THREE.Group();

  // Start Gantry / Arch
  const gantryGroup = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(1.0, 8.5, 1.0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
  const postL = new THREE.Mesh(postGeo, postMat);
  postL.position.set(-wp0.normalX * (TRACK_WIDTH * 0.5 + 2.5), 4.25, -wp0.normalZ * (TRACK_WIDTH * 0.5 + 2.5));
  const postR = new THREE.Mesh(postGeo, postMat);
  postR.position.set(wp0.normalX * (TRACK_WIDTH * 0.5 + 2.5), 4.25, wp0.normalZ * (TRACK_WIDTH * 0.5 + 2.5));

  const beamGeo = new THREE.BoxGeometry(TRACK_WIDTH + 6, 1.6, 1.2);
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(wp0.x, 8.0, wp0.z);
  beam.rotation.y = Math.atan2(wp0.tangentX, wp0.tangentZ) + Math.PI / 2;

  gantryGroup.add(postL);
  gantryGroup.add(postR);
  gantryGroup.add(beam);
  environmentGroup.add(gantryGroup);

  // Grandstand along the main straight (placed far back from track edge)
  const grandstandGeo = new THREE.BoxGeometry(70, 16, 14);
  const grandstandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const grandstand = new THREE.Mesh(grandstandGeo, grandstandMat);
  grandstand.position.set(wp0.x - wp0.normalX * 42, 8, wp0.z - wp0.normalZ * 42 - 20);
  grandstand.rotation.y = Math.atan2(wp0.tangentX, wp0.tangentZ);
  grandstand.castShadow = true;
  environmentGroup.add(grandstand);

  // Stadium Floodlight Towers (placed at 6 strategic turns)
  const towerIndices = [10, 45, 80, 130, 180, 230];
  const towerGeo = new THREE.CylinderGeometry(0.5, 0.8, 22, 8);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
  const lampGeo = new THREE.BoxGeometry(4, 2, 1.5);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffedd5,
    emissiveIntensity: 2.5,
  });

  towerIndices.forEach((idx) => {
    if (idx < n) {
      const wp = waypoints[idx];
      const side = idx % 2 === 0 ? 1 : -1;
      const tx = wp.x + wp.normalX * (wp.width * 0.5 + 8) * side;
      const tz = wp.z + wp.normalZ * (wp.width * 0.5 + 8) * side;

      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(tx, 11, tz);
      tower.castShadow = true;

      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(tx, 22, tz);
      lamp.rotation.y = Math.atan2(wp.x - tx, wp.z - tz);

      environmentGroup.add(tower);
      environmentGroup.add(lamp);
    }
  });

  // Trackside tire walls and barriers at sharp corners
  const tireGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.2, 10);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

  for (let i = 0; i < n; i += 12) {
    const wp = waypoints[i];
    if (wp.curvature > 0.02) {
      // Place outer barrier wall
      const bx = wp.x + wp.normalX * (wp.width * 0.5 + 2.2);
      const bz = wp.z + wp.normalZ * (wp.width * 0.5 + 2.2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.position.set(bx, 0.6, bz);
      tire.castShadow = true;
      environmentGroup.add(tire);
    }
  }

  // 2. Populate Curated Track Obstacles
  // Types:
  // - Boost pads (giving big speed burst)
  // - Oil slicks (causes spin-outs)
  // - Barrier cones (slows down car on hit)
  // - Hazard blockers (heavy barricades that move across track or guard chicane corners)
  const obstacles: Obstacle[] = [
    // Boost pad exiting turn 1 into straight
    {
      id: 'boost_1',
      type: 'boost_pad',
      x: waypoints[Math.floor(n * 0.12)].x,
      y: 0,
      z: waypoints[Math.floor(n * 0.12)].z,
      radius: 3.2,
      rotation: 0,
      active: true,
    },
    // Oil slick in chicane apex
    {
      id: 'oil_1',
      type: 'oil_slick',
      x: waypoints[Math.floor(n * 0.22)].x + waypoints[Math.floor(n * 0.22)].normalX * 2,
      y: 0,
      z: waypoints[Math.floor(n * 0.22)].z + waypoints[Math.floor(n * 0.22)].normalZ * 2,
      radius: 2.8,
      rotation: 0,
      active: true,
    },
    // Barrier cones in S-bend
    {
      id: 'cone_1',
      type: 'barrier_cone',
      x: waypoints[Math.floor(n * 0.35)].x - waypoints[Math.floor(n * 0.35)].normalX * 3,
      y: 0,
      z: waypoints[Math.floor(n * 0.35)].z - waypoints[Math.floor(n * 0.35)].normalZ * 3,
      radius: 1.5,
      rotation: 0,
      active: true,
    },
    // Boost pad on back straight
    {
      id: 'boost_2',
      type: 'boost_pad',
      x: waypoints[Math.floor(n * 0.58)].x,
      y: 0,
      z: waypoints[Math.floor(n * 0.58)].z,
      radius: 3.2,
      rotation: 0,
      active: true,
    },
    // Moving hazard blocker in technical sector
    {
      id: 'hazard_1',
      type: 'hazard_blocker',
      x: waypoints[Math.floor(n * 0.72)].x,
      y: 0,
      z: waypoints[Math.floor(n * 0.72)].z,
      radius: 2.4,
      rotation: 0,
      active: true,
      isMoving: true,
      moveRange: 5.5,
      moveSpeed: 2.2,
      baseX: waypoints[Math.floor(n * 0.72)].x,
      baseZ: waypoints[Math.floor(n * 0.72)].z,
      lateralOffset: 0,
    },
    // Oil slick near final chicane entry
    {
      id: 'oil_2',
      type: 'oil_slick',
      x: waypoints[Math.floor(n * 0.88)].x - waypoints[Math.floor(n * 0.88)].normalX * 2.5,
      y: 0,
      z: waypoints[Math.floor(n * 0.88)].z - waypoints[Math.floor(n * 0.88)].normalZ * 2.5,
      radius: 2.8,
      rotation: 0,
      active: true,
    },
    // Barrier cones near final corner
    {
      id: 'cone_2',
      type: 'barrier_cone',
      x: waypoints[Math.floor(n * 0.94)].x + waypoints[Math.floor(n * 0.94)].normalX * 3.5,
      y: 0,
      z: waypoints[Math.floor(n * 0.94)].z + waypoints[Math.floor(n * 0.94)].normalZ * 3.5,
      radius: 1.5,
      rotation: 0,
      active: true,
    },
  ];

  return {
    trackMesh,
    kerbLeftMesh,
    kerbRightMesh,
    finishLineMesh,
    terrainMesh,
    environmentGroup,
    obstacles,
  };
}
