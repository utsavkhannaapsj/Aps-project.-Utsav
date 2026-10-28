import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CarLivery,
  CarPhysicsState,
  Obstacle,
  RaceConfig,
  RaceResult,
  RaceStatus,
  RacerInfo,
  TrackWaypoint,
} from '../types/game';
import { raceAudio } from './audio';
import {
  buildObstacleMesh,
  buildProceduralCar,
  CarMeshContainer,
} from './proceduralGraphics';
import {
  calculateAIDecision,
  calculateRankings,
  calculateTrackProgress,
  generateTrackWaypoints,
  getTrackLength,
  resolveCarCarCollisions,
  stepCarPhysics,
} from './raceLogic';
import { buildTrackScene } from './trackBuilder';

export const DEFAULT_LIVERIES: CarLivery[] = [
  {
    id: 'crimson',
    name: 'Crimson Fury',
    primaryColor: 0xdc2626,
    secondaryColor: 0x18181b,
    accentColor: 0xfacc15,
    glowColor: '#ef4444',
  },
  {
    id: 'cyan',
    name: 'Neon Velocity',
    primaryColor: 0x0284c7,
    secondaryColor: 0x090d16,
    accentColor: 0x38bdf8,
    glowColor: '#38bdf8',
  },
  {
    id: 'gold',
    name: 'Apex Sunburst',
    primaryColor: 0xeab308,
    secondaryColor: 0x27272a,
    accentColor: 0xf97316,
    glowColor: '#eab308',
  },
  {
    id: 'emerald',
    name: 'Viper Acid',
    primaryColor: 0x16a34a,
    secondaryColor: 0x052e16,
    accentColor: 0x4ade80,
    glowColor: '#4ade80',
  },
  {
    id: 'phantom',
    name: 'Phantom GT',
    primaryColor: 0x7c3aed,
    secondaryColor: 0x1e1b4b,
    accentColor: 0xc084fc,
    glowColor: '#a855f7',
  },
];

export interface GameEngineCallbacks {
  onStatusChange: (status: RaceStatus) => void;
  onCountdownTick: (count: number) => void;
  onLapUpdate: (currentLap: number, totalLaps: number, lapTime: number, bestLap: number | null) => void;
  onRankUpdate: (rank: number, totalRacers: number) => void;
  onSpeedUpdate: (speedKmH: number, boostRemaining: number) => void;
  onStopwatchUpdate: (elapsedMs: number) => void;
  onRaceFinish: (results: RaceResult[]) => void;
  onWrongWay: (isWrongWay: boolean) => void;
}

export class GameEngine {
  private mountEl: HTMLElement;
  private callbacks: GameEngineCallbacks;
  private config: RaceConfig;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean = false;
  private frameId: number = 0;

  // Track & Waypoints
  private waypoints: TrackWaypoint[] = [];
  private trackLength: number = 0;
  private obstacles: Obstacle[] = [];
  private obstacleMeshes: Map<string, THREE.Object3D> = new Map();

  // Racers
  private racers: RacerInfo[] = [];
  private carMeshes: Map<string, CarMeshContainer> = new Map();

  // Input states
  private keysHeld: Set<string> = new Set();
  private touchThrottle: number = 0;
  private touchSteer: number = 0;
  private touchBrake: boolean = false;
  private touchHandbrake: boolean = false;

  // Race Loop State
  private status: RaceStatus = 'title';
  private countdownTimer: number = 3.5;
  private raceStartTime: number = 0;
  private raceElapsedMs: number = 0;
  private isWrongWay: boolean = false;
  private wrongWayCheckTimer: number = 0;

  // Camera Shake & Particles
  private cameraTrauma: number = 0;
  private particles: Array<{
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
  }> = [];
  private particleGroup: THREE.Group = new THREE.Group();

  constructor(mountEl: HTMLElement, config: RaceConfig, callbacks: GameEngineCallbacks) {
    this.mountEl = mountEl;
    this.config = config;
    this.callbacks = callbacks;

    this.initRenderer();
    this.initScene();
    this.initTrackAndObstacles();
    this.initRacers();
    this.initControls();
    this.startLoop();
  }

  private initRenderer() {
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = this.mountEl.clientWidth || window.innerWidth;
    const height = this.mountEl.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);

    this.mountEl.appendChild(this.renderer.domElement);
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.0035);

    const aspect = (this.mountEl.clientWidth || window.innerWidth) / (this.mountEl.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1200);

    // Warm key directional light with shadows
    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    keyLight.position.set(80, 140, 100);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 400;
    const d = 160;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Cool ambient hemisphere light
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.1);
    this.scene.add(hemiLight);

    // Studio Room Environment reflection map
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {
      // Safe fallback
    }

    // Particle Group
    this.scene.add(this.particleGroup);
  }

  private initTrackAndObstacles() {
    this.waypoints = generateTrackWaypoints();
    this.trackLength = getTrackLength(this.waypoints);

    const built = buildTrackScene(this.waypoints);
    this.scene.add(built.trackMesh);
    this.scene.add(built.kerbLeftMesh);
    this.scene.add(built.kerbRightMesh);
    this.scene.add(built.finishLineMesh);
    this.scene.add(built.terrainMesh);
    this.scene.add(built.environmentGroup);

    this.obstacles = built.obstacles;

    // Create 3D meshes for obstacles
    this.obstacles.forEach((obs) => {
      const mesh = buildObstacleMesh(obs.type, obs.radius);
      mesh.position.set(obs.x, obs.y, obs.z);
      mesh.rotation.y = obs.rotation;
      this.scene.add(mesh);
      this.obstacleMeshes.set(obs.id, mesh);
    });
  }

  private initRacers() {
    const wp0 = this.waypoints[0];
    const trackHeading = Math.atan2(wp0.tangentX, wp0.tangentZ);

    // Staggered grid starting positions behind start line
    const gridOffsets = [
      { lateral: -3.5, longitudinal: -6 }, // P1 (AI 1)
      { lateral: 3.5, longitudinal: -12 },  // P2 (AI 2)
      { lateral: -3.5, longitudinal: -18 }, // P3 (Player)
      { lateral: 3.5, longitudinal: -24 },  // P4 (AI 3)
      { lateral: -3.5, longitudinal: -30 }, // P5 (AI 4)
    ];

    // 1. Player Racer
    const playerLivery = this.config.playerLivery || DEFAULT_LIVERIES[0];
    const playerGrid = gridOffsets[2];
    const playerStartX = wp0.x + wp0.normalX * playerGrid.lateral + wp0.tangentX * playerGrid.longitudinal;
    const playerStartZ = wp0.z + wp0.normalZ * playerGrid.lateral + wp0.tangentZ * playerGrid.longitudinal;

    const playerPhysics: CarPhysicsState = {
      x: playerStartX,
      y: 0,
      z: playerStartZ,
      rotationY: trackHeading,
      speed: 0,
      steerAngle: 0,
      lateralVelocity: 0,
      angularVelocity: 0,
      isDrifting: false,
      isSpinningOut: false,
      spinTimer: 0,
      boostTimer: 0,
      offTrackTimer: 0,
      currentLap: 1,
      lapProgress: 0,
      totalDistance: playerGrid.longitudinal,
      lapStartTime: 0,
      currentLapTime: 0,
      bestLapTime: null,
      lapTimes: [],
      finishTime: null,
      hasFinished: false,
      lastCheckpointIdx: 0,
    };

    const playerRacer: RacerInfo = {
      id: 'player',
      name: 'Player',
      isAI: false,
      livery: playerLivery,
      physics: playerPhysics,
    };
    this.racers.push(playerRacer);

    // 2. AI Racers (4 distinct profiles)
    const aiConfigs = [
      {
        id: 'ai_1',
        name: 'Apex Blaze',
        livery: DEFAULT_LIVERIES[2],
        gridIdx: 0,
        topSpeedMult: 1.02,
        aggression: 0.85,
        lane: -0.3,
      },
      {
        id: 'ai_2',
        name: 'Viper Velocity',
        livery: DEFAULT_LIVERIES[3],
        gridIdx: 1,
        topSpeedMult: 0.99,
        aggression: 0.75,
        lane: 0.35,
      },
      {
        id: 'ai_3',
        name: 'Phantom GT',
        livery: DEFAULT_LIVERIES[4],
        gridIdx: 3,
        topSpeedMult: 1.04,
        aggression: 0.9,
        lane: -0.1,
      },
      {
        id: 'ai_4',
        name: 'Thunder Drift',
        livery: DEFAULT_LIVERIES[1],
        gridIdx: 4,
        topSpeedMult: 0.97,
        aggression: 0.7,
        lane: 0.2,
      },
    ];

    aiConfigs.forEach((cfg) => {
      const grid = gridOffsets[cfg.gridIdx];
      const startX = wp0.x + wp0.normalX * grid.lateral + wp0.tangentX * grid.longitudinal;
      const startZ = wp0.z + wp0.normalZ * grid.lateral + wp0.tangentZ * grid.longitudinal;

      const aiPhysics: CarPhysicsState = {
        x: startX,
        y: 0,
        z: startZ,
        rotationY: trackHeading,
        speed: 0,
        steerAngle: 0,
        lateralVelocity: 0,
        angularVelocity: 0,
        isDrifting: false,
        isSpinningOut: false,
        spinTimer: 0,
        boostTimer: 0,
        offTrackTimer: 0,
        currentLap: 1,
        lapProgress: 0,
        totalDistance: grid.longitudinal,
        lapStartTime: 0,
        currentLapTime: 0,
        bestLapTime: null,
        lapTimes: [],
        finishTime: null,
        hasFinished: false,
        lastCheckpointIdx: 0,
      };

      const aiRacer: RacerInfo = {
        id: cfg.id,
        name: cfg.name,
        isAI: true,
        livery: cfg.livery,
        physics: aiPhysics,
        aiProfile: {
          id: cfg.id,
          name: cfg.name,
          livery: cfg.livery,
          topSpeedMult: cfg.topSpeedMult,
          accelerationMult: 1.0,
          aggression: cfg.aggression,
          reactionTime: 0.15,
          preferredLaneOffset: cfg.lane,
        },
      };

      this.racers.push(aiRacer);
    });

    // Build procedural 3D meshes for all racers
    this.racers.forEach((racer) => {
      const carMesh = buildProceduralCar(racer.livery);
      carMesh.group.position.set(racer.physics.x, racer.physics.y, racer.physics.z);
      carMesh.group.rotation.y = racer.physics.rotationY;
      this.scene.add(carMesh.group);
      this.carMeshes.set(racer.id, carMesh);
    });

    // Initial camera position overlooking the starting grid
    this.camera.position.set(playerStartX - 10, 8, playerStartZ - 18);
    this.camera.lookAt(playerStartX, 1.5, playerStartZ);
  }

  private initControls() {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keysHeld.add(e.code);

      // Handle pause on Escape / KeyP
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.status === 'playing') {
          this.pause();
        } else if (this.status === 'paused') {
          this.resume();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
    };

    const onBlur = () => {
      this.keysHeld.clear();
      this.touchThrottle = 0;
      this.touchSteer = 0;
      this.touchBrake = false;
      this.touchHandbrake = false;
    };

    const onResize = () => {
      if (!this.mountEl) return;
      const width = this.mountEl.clientWidth || window.innerWidth;
      const height = this.mountEl.clientHeight || window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);

    // Initial warm compile
    if (!this.isSoftwareGl) {
      try {
        this.renderer.compile(this.scene, this.camera);
      } catch {
        // Safe fallback
      }
    }
  }

  public setTouchControls(controls: {
    throttle: number;
    steer: number;
    brake: boolean;
    handbrake: boolean;
  }) {
    this.touchThrottle = controls.throttle;
    this.touchSteer = controls.steer;
    this.touchBrake = controls.brake;
    this.touchHandbrake = controls.handbrake;
  }

  public triggerPlayerBoost() {
    const player = this.racers.find((r) => !r.isAI);
    if (!player || player.physics.hasFinished) return;
    if (player.physics.boostTimer <= 0) {
      player.physics.boostTimer = 2.2;
      player.physics.speed = Math.max(player.physics.speed, 35.0);
      raceAudio.playBoostSound();
      this.spawnBoostParticles(player.physics.x, player.physics.z, player.physics.rotationY);
    }
  }

  public updatePlayerLivery(livery: CarLivery) {
    this.config.playerLivery = livery;
    const player = this.racers.find((r) => !r.isAI);
    if (!player) return;
    player.livery = livery;
    const oldMesh = this.carMeshes.get('player');
    if (oldMesh) {
      this.scene.remove(oldMesh.group);
    }
    const newMesh = buildProceduralCar(livery);
    newMesh.group.position.set(player.physics.x, player.physics.y, player.physics.z);
    newMesh.group.rotation.y = player.physics.rotationY;
    this.scene.add(newMesh.group);
    this.carMeshes.set('player', newMesh);
  }

  public startRace() {
    this.status = 'countdown';
    this.countdownTimer = 3.5;
    this.raceStartTime = 0;
    this.raceElapsedMs = 0;
    this.callbacks.onStatusChange('countdown');
    raceAudio.startEngine();
  }

  public pause() {
    if (this.status === 'playing') {
      this.status = 'paused';
      this.callbacks.onStatusChange('paused');
    }
  }

  public resume() {
    if (this.status === 'paused') {
      this.status = 'playing';
      this.callbacks.onStatusChange('playing');
    }
  }

  public restart() {
    // Reset all racers to start grid
    const wp0 = this.waypoints[0];
    const trackHeading = Math.atan2(wp0.tangentX, wp0.tangentZ);
    const gridOffsets = [
      { lateral: -3.5, longitudinal: -6 },
      { lateral: 3.5, longitudinal: -12 },
      { lateral: -3.5, longitudinal: -18 },
      { lateral: 3.5, longitudinal: -24 },
      { lateral: -3.5, longitudinal: -30 },
    ];

    this.racers.forEach((racer, i) => {
      const grid = gridOffsets[i];
      const startX = wp0.x + wp0.normalX * grid.lateral + wp0.tangentX * grid.longitudinal;
      const startZ = wp0.z + wp0.normalZ * grid.lateral + wp0.tangentZ * grid.longitudinal;

      racer.physics = {
        x: startX,
        y: 0,
        z: startZ,
        rotationY: trackHeading,
        speed: 0,
        steerAngle: 0,
        lateralVelocity: 0,
        angularVelocity: 0,
        isDrifting: false,
        isSpinningOut: false,
        spinTimer: 0,
        boostTimer: 0,
        offTrackTimer: 0,
        currentLap: 1,
        lapProgress: 0,
        totalDistance: grid.longitudinal,
        lapStartTime: 0,
        currentLapTime: 0,
        bestLapTime: null,
        lapTimes: [],
        finishTime: null,
        hasFinished: false,
        lastCheckpointIdx: 0,
      };

      const mesh = this.carMeshes.get(racer.id);
      if (mesh) {
        mesh.group.position.set(startX, 0, startZ);
        mesh.group.rotation.y = trackHeading;
      }
    });

    this.startRace();
  }

  private startLoop() {
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05); // Clamp dt per ultra-mode requirements

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
    }

    if (this.isSoftwareGl) {
      afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private update(dt: number) {
    if (this.status === 'paused') return;

    // 0. Title Screen Camera Orbit Preview
    if (this.status === 'title') {
      const player = this.racers.find((r) => !r.isAI);
      if (player) {
        const camAngle = performance.now() * 0.00035;
        const camDist = 13.5;
        this.camera.position.set(
          player.physics.x + Math.sin(camAngle) * camDist,
          4.8,
          player.physics.z + Math.cos(camAngle) * camDist
        );
        this.camera.lookAt(player.physics.x, 1.2, player.physics.z);
      }
      return;
    }

    // 1. Countdown Phase
    if (this.status === 'countdown') {
      const prevTimer = this.countdownTimer;
      this.countdownTimer -= dt;

      const prevInt = Math.ceil(prevTimer);
      const currInt = Math.ceil(this.countdownTimer);

      if (currInt !== prevInt && currInt >= 1) {
        this.callbacks.onCountdownTick(currInt);
        raceAudio.playCountdownBeep(false);
      }

      if (this.countdownTimer <= 0) {
        this.status = 'playing';
        this.raceStartTime = performance.now();
        this.callbacks.onCountdownTick(0); // 0 signifies "GO!"
        this.callbacks.onStatusChange('playing');
        raceAudio.playCountdownBeep(true);
      }

      // Idle camera pan around player car during countdown
      const player = this.racers.find((r) => !r.isAI)!;
      const camAngle = performance.now() * 0.001;
      const camDist = 12;
      this.camera.position.set(
        player.physics.x + Math.sin(camAngle) * camDist,
        5,
        player.physics.z + Math.cos(camAngle) * camDist
      );
      this.camera.lookAt(player.physics.x, 1.2, player.physics.z);
      return;
    }

    // 2. Active Race Phase
    const now = performance.now();
    this.raceElapsedMs = now - this.raceStartTime;
    this.callbacks.onStopwatchUpdate(this.raceElapsedMs);

    // Update moving obstacles
    this.obstacles.forEach((obs) => {
      if (obs.isMoving && obs.baseX !== undefined && obs.baseZ !== undefined) {
        const offset = Math.sin(now * 0.002 * (obs.moveSpeed || 1)) * (obs.moveRange || 4);
        obs.lateralOffset = offset;
        const mesh = this.obstacleMeshes.get(obs.id);
        if (mesh) {
          // Move perpendicularly to track
          mesh.position.x = obs.baseX + offset;
          obs.x = obs.baseX + offset;
        }
      }
    });

    // 3. Step Player Controls & Physics
    const player = this.racers.find((r) => !r.isAI)!;

    let throttle = this.touchThrottle;
    let steer = this.touchSteer;
    let brake = this.touchBrake;
    let handbrake = this.touchHandbrake;

    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) throttle = 1.0;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) {
      if (player.physics.speed > 2) brake = true;
      else throttle = -0.7; // Reverse
    }
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) steer += -1.0;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) steer += 1.0;
    if (this.keysHeld.has('Space')) handbrake = true;
    if (this.keysHeld.has('ShiftLeft') || this.keysHeld.has('KeyB')) {
      if (player.physics.boostTimer <= 0) {
        player.physics.boostTimer = 1.8;
        raceAudio.playBoostSound();
      }
    }

    steer = Math.max(-1, Math.min(1, steer));

    if (!player.physics.hasFinished) {
      const playerResult = stepCarPhysics(
        player.physics,
        { throttle, steer, brake, handbrake },
        dt,
        18,
        this.obstacles
      );
      player.physics = playerResult.state;

      if (playerResult.hitObstacle === 'boost_pad') {
        raceAudio.playBoostSound();
        this.spawnBoostParticles(player.physics.x, player.physics.z, player.physics.rotationY);
      } else if (playerResult.hitObstacle === 'oil_slick') {
        raceAudio.playOilSlickSound();
        this.cameraTrauma = 0.5;
      } else if (playerResult.hitObstacle === 'barrier_cone' || playerResult.hitObstacle === 'hazard_blocker') {
        raceAudio.playCrashSound();
        this.cameraTrauma = 0.8;
        this.spawnCollisionSparks(player.physics.x, player.physics.z);
      }
    }

    // 4. Step AI Racers
    this.racers.forEach((racer) => {
      if (racer.isAI && !racer.physics.hasFinished) {
        const aiDecision = calculateAIDecision(
          racer,
          this.waypoints,
          this.trackLength,
          this.obstacles,
          this.racers
        );

        if (aiDecision.boost) {
          racer.physics.boostTimer = 1.8;
          this.spawnBoostParticles(racer.physics.x, racer.physics.z, racer.physics.rotationY);
        }

        const aiResult = stepCarPhysics(
          racer.physics,
          {
            throttle: aiDecision.throttle,
            steer: aiDecision.steer,
            brake: aiDecision.brake,
            handbrake: false,
          },
          dt,
          18,
          this.obstacles
        );
        racer.physics = aiResult.state;
      }
    });

    // 5. Car-to-Car Collision Resolution
    resolveCarCarCollisions(this.racers);

    // 6. Track Progress & Lap Checkpoint Detection
    this.racers.forEach((racer) => {
      const progress = calculateTrackProgress(
        racer.physics.x,
        racer.physics.z,
        this.waypoints,
        racer.physics.lastCheckpointIdx,
        this.trackLength
      );

      const prevIdx = racer.physics.lastCheckpointIdx;
      const currIdx = progress.currentIndex;
      const totalWp = this.waypoints.length;

      // Detect finish line crossing (from high index > 80% to low index < 20%)
      if (prevIdx > totalWp * 0.8 && currIdx < totalWp * 0.2) {
        const lapElapsed = this.raceElapsedMs - racer.physics.lapStartTime;
        racer.physics.lapTimes.push(lapElapsed);

        if (racer.physics.bestLapTime === null || lapElapsed < racer.physics.bestLapTime) {
          racer.physics.bestLapTime = lapElapsed;
        }

        racer.physics.lapStartTime = this.raceElapsedMs;

        if (racer.physics.currentLap >= this.config.laps) {
          // Finished the race!
          racer.physics.hasFinished = true;
          racer.physics.finishTime = this.raceElapsedMs;
        } else {
          racer.physics.currentLap += 1;
        }

        if (!racer.isAI) {
          this.callbacks.onLapUpdate(
            racer.physics.currentLap,
            this.config.laps,
            lapElapsed,
            racer.physics.bestLapTime
          );
        }
      }

      racer.physics.lastCheckpointIdx = currIdx;
      racer.physics.lapProgress = progress.progress01;
      racer.physics.totalDistance = (racer.physics.currentLap - 1) * this.trackLength + progress.distanceAlongTrack;
    });

    // 7. Update Race Standings
    const rankings = calculateRankings(this.racers);
    const playerRank = rankings.indexOf('player') + 1;
    this.callbacks.onRankUpdate(playerRank, this.racers.length);

    // Check wrong way driving
    this.wrongWayCheckTimer += dt;
    if (this.wrongWayCheckTimer > 0.4) {
      this.wrongWayCheckTimer = 0;
      const wp = this.waypoints[player.physics.lastCheckpointIdx];
      const forwardX = Math.sin(player.physics.rotationY);
      const forwardZ = Math.cos(player.physics.rotationY);
      const dot = forwardX * wp.tangentX + forwardZ * wp.tangentZ;
      this.isWrongWay = dot < -0.3 && Math.abs(player.physics.speed) > 5;
      this.callbacks.onWrongWay(this.isWrongWay);
    }

    // 8. Update HUD Speedometer & Audio
    const speedKmH = Math.round(Math.abs(player.physics.speed) * 3.6);
    this.callbacks.onSpeedUpdate(speedKmH, player.physics.boostTimer);
    raceAudio.updateEngine(
      Math.abs(player.physics.speed) / 50.0,
      throttle,
      player.physics.isDrifting
    );

    // 9. Update 3D Visual Meshes for All Racers
    this.racers.forEach((racer) => {
      const carMesh = this.carMeshes.get(racer.id);
      if (!carMesh) return;

      carMesh.group.position.set(racer.physics.x, racer.physics.y, racer.physics.z);
      carMesh.group.rotation.y = racer.physics.rotationY;

      // Body roll on turns
      carMesh.bodyMesh.rotation.z = -racer.physics.steerAngle * 0.08;

      // Wheel rotations
      const wheelSpin = (racer.physics.speed / 0.4) * dt;
      carMesh.wheels.forEach((w) => {
        w.rotation.x += wheelSpin;
      });

      // Front wheel steering
      carMesh.frontLeftWheel.rotation.y = racer.physics.steerAngle * 0.45;
      carMesh.frontRightWheel.rotation.y = racer.physics.steerAngle * 0.45;

      // Tire smoke on drift
      if (racer.physics.isDrifting) {
        this.spawnTireSmoke(racer.physics.x, racer.physics.z);
      }
    });

    // 10. Update Dynamic Chase Camera
    this.updateCamera(player.physics, dt);

    // 11. Update Particles
    this.updateParticles(dt);

    // 12. Check Victory / Finish Condition
    if (player.physics.hasFinished && this.status !== 'finished') {
      this.status = 'finished';
      this.callbacks.onStatusChange('finished');
      raceAudio.playVictoryFanfare();

      // Build leaderboard results
      const results: RaceResult[] = rankings.map((id, index) => {
        const racer = this.racers.find((r) => r.id === id)!;
        const leaderTime = this.racers.find((r) => r.id === rankings[0])!.physics.finishTime || this.raceElapsedMs;
        const racerTime = racer.physics.finishTime || this.raceElapsedMs;
        const gap = index === 0 ? 0 : (racerTime - leaderTime) / 1000;

        return {
          rank: index + 1,
          id: racer.id,
          name: racer.name,
          isPlayer: !racer.isAI,
          livery: racer.livery,
          totalTime: racerTime,
          bestLapTime: racer.physics.bestLapTime || racerTime,
          gapToLeader: Math.max(0, gap),
        };
      });

      this.callbacks.onRaceFinish(results);
    }
  }

  private updateCamera(player: CarPhysicsState, dt: number) {
    // Chase camera parameters
    const chaseDistance = 11.5;
    const chaseHeight = 4.2;
    const targetLookHeight = 1.4;

    // Follow offset behind car based on car's rotation
    const behindX = player.x - Math.sin(player.rotationY) * chaseDistance;
    const behindZ = player.z - Math.cos(player.rotationY) * chaseDistance;

    // Smooth exponential damping
    const smoothFactor = 1 - Math.exp(-8.0 * dt);
    this.camera.position.x += (behindX - this.camera.position.x) * smoothFactor;
    this.camera.position.z += (behindZ - this.camera.position.z) * smoothFactor;
    this.camera.position.y += (chaseHeight - this.camera.position.y) * smoothFactor;

    // Camera trauma / screen shake on collisions
    if (this.cameraTrauma > 0) {
      const shake = this.cameraTrauma * this.cameraTrauma * 1.5;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.0);
    }

    // Dynamic FOV kick on boost / top speed
    const baseFOV = 65;
    const boostFOV = player.boostTimer > 0 ? 76 : baseFOV + (player.speed / 50) * 8;
    this.camera.fov += (boostFOV - this.camera.fov) * smoothFactor;
    this.camera.updateProjectionMatrix();

    // Look at point ahead of car
    const lookX = player.x + Math.sin(player.rotationY) * 6;
    const lookZ = player.z + Math.cos(player.rotationY) * 6;
    this.camera.lookAt(lookX, targetLookHeight, lookZ);
  }

  private spawnTireSmoke(x: number, z: number) {
    if (this.particles.length > 60) return;
    const geo = new THREE.SphereGeometry(0.3, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + (Math.random() - 0.5) * 1.5, 0.2, z + (Math.random() - 0.5) * 1.5);
    this.particleGroup.add(mesh);

    this.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0.8 + Math.random() * 1.2,
      vz: (Math.random() - 0.5) * 1.2,
      life: 0.6,
      maxLife: 0.6,
    });
  }

  private spawnBoostParticles(x: number, z: number, rotationY: number) {
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.SphereGeometry(0.2, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.4, z);
      this.particleGroup.add(mesh);

      const backwardX = -Math.sin(rotationY);
      const backwardZ = -Math.cos(rotationY);

      this.particles.push({
        mesh,
        vx: backwardX * 12 + (Math.random() - 0.5) * 4,
        vy: 0.5 + Math.random() * 1.5,
        vz: backwardZ * 12 + (Math.random() - 0.5) * 4,
        life: 0.4,
        maxLife: 0.4,
      });
    }
  }

  private spawnCollisionSparks(x: number, z: number) {
    for (let i = 0; i < 14; i++) {
      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.5, z);
      this.particleGroup.add(mesh);

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 10,
        vy: 2 + Math.random() * 6,
        vz: (Math.random() - 0.5) * 10,
        life: 0.5,
        maxLife: 0.5,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particleGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      const scale = p.life / p.maxLife;
      p.mesh.scale.set(scale, scale, scale);
    }
  }

  public getTrackWaypoints(): TrackWaypoint[] {
    return this.waypoints;
  }

  public getRacers(): RacerInfo[] {
    return this.racers;
  }

  public getObstacles(): Obstacle[] {
    return this.obstacles;
  }

  public dispose() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
    }
    raceAudio.stopEngine();
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
