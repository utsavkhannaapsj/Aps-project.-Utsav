import * as THREE from 'three';
import { CarLivery, ObstacleType } from '../types/game';

/**
 * Generate procedural asphalt road canvas texture
 */
export function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base dark asphalt
  ctx.fillStyle = '#22252a';
  ctx.fillRect(0, 0, 512, 512);

  // Grain / noise
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 24;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Outer white edge lines
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(16, 0, 14, 512);
  ctx.fillRect(512 - 30, 0, 14, 512);

  // Center dashed racing yellow line
  ctx.fillStyle = '#facc15';
  for (let y = 0; y < 512; y += 80) {
    ctx.fillRect(250, y, 12, 45);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generate red/white curb kerbing texture
 */
export function createKerbTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const stripeW = 32;
  for (let x = 0; x < 256; x += stripeW) {
    ctx.fillStyle = (x / stripeW) % 2 === 0 ? '#ef4444' : '#f8fafc';
    ctx.fillRect(x, 0, stripeW, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generate checkered start/finish line texture
 */
export function createCheckeredTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const tileSize = 32;
  for (let x = 0; x < 256; x += tileSize) {
    for (let y = 0; y < 128; y += tileSize) {
      const isWhite = ((x / tileSize) + (y / tileSize)) % 2 === 0;
      ctx.fillStyle = isWhite ? '#ffffff' : '#111827';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generate procedural terrain grass/soil texture
 */
export function createTerrainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e3a1e';
  ctx.fillRect(0, 0, 512, 512);

  // Mottled organic grass patches
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 8 + Math.random() * 32;
    ctx.fillStyle = Math.random() > 0.5 ? '#15803d' : '#166534';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generate boost pad texture with glowing electric cyan chevrons
 */
export function createBoostPadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Dark metallic tech plate background
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Three glowing forward chevrons
  const chevronsY = [60, 128, 196];
  for (const y of chevronsY) {
    ctx.beginPath();
    ctx.moveTo(50, y + 25);
    ctx.lineTo(128, y - 25);
    ctx.lineTo(206, y + 25);
    ctx.stroke();
  }

  // Border glow
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 244, 244);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generate oil slick texture with chromatic rainbow swirls
 */
export function createOilSlickTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);

  // Gradient radial puddle
  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
  grad.addColorStop(0, 'rgba(10, 10, 15, 0.95)');
  grad.addColorStop(0.4, 'rgba(56, 189, 248, 0.85)');
  grad.addColorStop(0.7, 'rgba(236, 72, 153, 0.85)');
  grad.addColorStop(0.9, 'rgba(234, 179, 8, 0.7)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(128, 128, 115, 100, Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generate hazard cone/barrier texture
 */
export function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f97316'; // Fluorescent orange
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#f8fafc'; // Reflective white stripe
  ctx.fillRect(0, 35, 128, 30);
  ctx.fillRect(0, 85, 128, 20);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface CarMeshContainer {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  frontLeftWheel: THREE.Mesh;
  frontRightWheel: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  exhaustLeft: THREE.Vector3;
  exhaustRight: THREE.Vector3;
  glowLights: THREE.Mesh[];
}

/**
 * Build a high-detail composite 3-12 part procedural race car
 */
export function buildProceduralCar(livery: CarLivery): CarMeshContainer {
  const group = new THREE.Group();

  // 1. Primary Chassis / Body
  // Aerodynamic main hull
  const bodyGeo = new THREE.BoxGeometry(1.9, 0.55, 4.0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: livery.primaryColor,
    metalness: 0.82,
    roughness: 0.22,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.48;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 2. Cockpit / Canopy
  const canopyGeo = new THREE.BoxGeometry(1.3, 0.46, 1.8);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.1,
    metalness: 0.95,
  });
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  canopyMesh.position.set(0, 0.88, -0.2);
  canopyMesh.castShadow = true;
  group.add(canopyMesh);

  // 3. Front Nosecone / Splitter
  const noseGeo = new THREE.BoxGeometry(2.1, 0.12, 0.8);
  const noseMat = new THREE.MeshStandardMaterial({
    color: livery.secondaryColor,
    roughness: 0.4,
    metalness: 0.5,
  });
  const noseMesh = new THREE.Mesh(noseGeo, noseMat);
  noseMesh.position.set(0, 0.26, 2.05);
  noseMesh.castShadow = true;
  group.add(noseMesh);

  // 4. Rear Racing Wing / Spoiler
  const wingGeo = new THREE.BoxGeometry(2.1, 0.08, 0.5);
  const wingMat = new THREE.MeshStandardMaterial({
    color: livery.accentColor,
    metalness: 0.6,
    roughness: 0.3,
  });
  const wingMesh = new THREE.Mesh(wingGeo, wingMat);
  wingMesh.position.set(0, 1.15, -1.85);
  wingMesh.castShadow = true;
  group.add(wingMesh);

  // Wing Struts
  const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
  const strutL = new THREE.Mesh(strutGeo, strutMat);
  strutL.position.set(-0.65, 0.88, -1.85);
  const strutR = new THREE.Mesh(strutGeo, strutMat);
  strutR.position.set(0.65, 0.88, -1.85);
  group.add(strutL);
  group.add(strutR);

  // 5. Wheels (4 distinct rotating assemblies)
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.7,
    metalness: 0.2,
  });
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.33, 8);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: livery.accentColor,
    metalness: 0.95,
    roughness: 0.15,
  });

  const wheels: THREE.Mesh[] = [];

  const wheelPositions = [
    { x: -1.02, y: 0.4, z: 1.25, isFront: true, isLeft: true },
    { x: 1.02, y: 0.4, z: 1.25, isFront: true, isLeft: false },
    { x: -1.02, y: 0.4, z: -1.25, isFront: false, isLeft: true },
    { x: 1.02, y: 0.4, z: -1.25, isFront: false, isLeft: false },
  ];

  let frontLeftWheel!: THREE.Mesh;
  let frontRightWheel!: THREE.Mesh;

  wheelPositions.forEach((pos) => {
    const wheelAssembly = new THREE.Mesh(wheelGeo, wheelMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheelAssembly.add(rim);
    wheelAssembly.position.set(pos.x, pos.y, pos.z);
    wheelAssembly.castShadow = true;
    group.add(wheelAssembly);
    wheels.push(wheelAssembly);

    if (pos.isFront && pos.isLeft) frontLeftWheel = wheelAssembly;
    if (pos.isFront && !pos.isLeft) frontRightWheel = wheelAssembly;
  });

  // 6. Headlights (Glowing Emissive)
  const glowLights: THREE.Mesh[] = [];
  const headlightGeo = new THREE.BoxGeometry(0.35, 0.15, 0.1);
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x67e8f9,
    emissiveIntensity: 2.5,
    roughness: 0.1,
  });
  const headL = new THREE.Mesh(headlightGeo, headlightMat);
  headL.position.set(-0.65, 0.52, 2.0);
  const headR = new THREE.Mesh(headlightGeo, headlightMat);
  headR.position.set(0.65, 0.52, 2.0);
  group.add(headL);
  group.add(headR);
  glowLights.push(headL, headR);

  // 7. Taillights (Glowing Red)
  const tailGeo = new THREE.BoxGeometry(0.4, 0.12, 0.08);
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xff0033,
    emissiveIntensity: 2.8,
    roughness: 0.1,
  });
  const tailL = new THREE.Mesh(tailGeo, tailMat);
  tailL.position.set(-0.68, 0.55, -2.01);
  const tailR = new THREE.Mesh(tailGeo, tailMat);
  tailR.position.set(0.68, 0.55, -2.01);
  group.add(tailL);
  group.add(tailR);
  glowLights.push(tailL, tailR);

  // 8. Dual Exhausts
  const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8);
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaustMat = new THREE.MeshStandardMaterial({
    color: 0x71717a,
    metalness: 0.95,
    roughness: 0.1,
  });
  const exhL = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhL.position.set(-0.35, 0.28, -2.02);
  const exhR = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhR.position.set(0.35, 0.28, -2.02);
  group.add(exhL);
  group.add(exhR);

  // 9. Contact Shadow Disc beneath vehicle
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const sGrad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
  sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  sGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
  sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = sGrad;
  sCtx.beginPath();
  sCtx.ellipse(64, 64, 58, 48, 0, 0, Math.PI * 2);
  sCtx.fill();

  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(2.8, 5.0);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.02;
  group.add(shadowMesh);

  return {
    group,
    wheels,
    frontLeftWheel,
    frontRightWheel,
    bodyMesh,
    exhaustLeft: new THREE.Vector3(-0.35, 0.28, -2.1),
    exhaustRight: new THREE.Vector3(0.35, 0.28, -2.1),
    glowLights,
  };
}

/**
 * Build 3D obstacle meshes based on obstacle type
 */
export function buildObstacleMesh(type: ObstacleType, radius: number): THREE.Object3D {
  const group = new THREE.Group();

  if (type === 'boost_pad') {
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: createBoostPadTexture(),
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.03;
    group.add(mesh);
  } else if (type === 'oil_slick') {
    const geo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: createOilSlickTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.035;
    group.add(mesh);
  } else if (type === 'barrier_cone') {
    // Traffic cone with striped texture
    const coneGeo = new THREE.ConeGeometry(0.45, 1.2, 12);
    const coneMat = new THREE.MeshStandardMaterial({
      map: createHazardStripeTexture(),
      roughness: 0.4,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 0.6;
    cone.castShadow = true;

    // Base plate
    const baseGeo = new THREE.BoxGeometry(0.9, 0.08, 0.9);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.04;
    base.castShadow = true;

    group.add(cone);
    group.add(base);
  } else if (type === 'hazard_blocker') {
    // Heavy industrial hazard barrier
    const barGeo = new THREE.BoxGeometry(radius * 1.8, 1.2, 0.8);
    const barMat = new THREE.MeshStandardMaterial({
      map: createHazardStripeTexture(),
      roughness: 0.3,
      metalness: 0.4,
    });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.y = 0.6;
    bar.castShadow = true;

    // Flashing warning beacon on top
    const beaconGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.25, 8);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.0,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 1.35;
    group.add(bar);
    group.add(beacon);
  }

  return group;
}
