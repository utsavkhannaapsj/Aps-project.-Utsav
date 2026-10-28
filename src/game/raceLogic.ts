import {
  CarPhysicsState,
  Obstacle,
  ObstacleType,
  RacerInfo,
  TrackWaypoint,
} from '../types/game';

// Standard track control points for a thrilling Grand Prix circuit
export const TRACK_CONTROL_POINTS: [number, number][] = [
  [0, -180],      // Start/Finish straight
  [60, -180],     // Turn 1 entry
  [120, -140],    // Turn 1 sweeping right
  [150, -80],     // Chicane entry
  [120, -30],     // Chicane flick left
  [160, 30],      // S-curve right
  [180, 100],     // High speed curve
  [150, 170],     // Hairpin entry
  [80, 200],      // Hairpin apex
  [20, 170],      // Hairpin exit
  [-30, 140],     // Back straight kink
  [-90, 120],     // Technical section entry
  [-150, 90],     // Off-camber turn left
  [-180, 20],     // Mid loop
  [-170, -50],    // Downhill sweeper
  [-130, -110],   // S-bend
  [-70, -150],    // Final chicane
];

export const TRACK_WIDTH = 18; // 18 units wide (generous for multi-car overtaking)

/**
 * Format milliseconds into MM:SS.mmm format
 */
export function formatRaceTime(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms) || ms < 0) return '00:00.000';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);

  const minStr = minutes.toString().padStart(2, '0');
  const secStr = seconds.toString().padStart(2, '0');
  const milStr = millis.toString().padStart(3, '0');

  return `${minStr}:${secStr}.${milStr}`;
}

/**
 * Catmull-Rom spline interpolation between 4 points
 */
export function catmullRom(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;

  const f0 = -0.5 * t3 + t2 - 0.5 * t;
  const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const f3 = 0.5 * t3 - 0.5 * t2;

  const x = p0[0] * f0 + p1[0] * f1 + p2[0] * f2 + p3[0] * f3;
  const z = p0[1] * f0 + p1[1] * f1 + p2[1] * f2 + p3[1] * f3;

  return [x, z];
}

/**
 * Generate densely sampled track waypoints from control points
 */
export function generateTrackWaypoints(
  controlPoints: [number, number][] = TRACK_CONTROL_POINTS,
  samplesPerSegment: number = 24
): TrackWaypoint[] {
  const waypoints: TrackWaypoint[] = [];
  const n = controlPoints.length;
  let cumulativeDist = 0;

  const rawPoints: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[(i - 1 + n) % n];
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % n];
    const p3 = controlPoints[(i + 2) % n];

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      rawPoints.push(catmullRom(p0, p1, p2, p3, t));
    }
  }

  const totalPoints = rawPoints.length;

  for (let i = 0; i < totalPoints; i++) {
    const curr = rawPoints[i];
    const next = rawPoints[(i + 1) % totalPoints];
    const prev = rawPoints[(i - 1 + totalPoints) % totalPoints];

    const dx = next[0] - curr[0];
    const dz = next[1] - curr[1];
    const segDist = Math.hypot(dx, dz);

    // Tangent vector (forward along track)
    const tx = segDist > 0.0001 ? dx / segDist : 1;
    const tz = segDist > 0.0001 ? dz / segDist : 0;

    // Normal vector pointing to the right side of the track
    const nx = -tz;
    const nz = tx;

    // Estimate curvature using angle between (curr - prev) and (next - curr)
    const prevDx = curr[0] - prev[0];
    const prevDz = curr[1] - prev[1];
    const cross = prevDx * dz - prevDz * dx;
    const curvature = Math.abs(cross) / Math.max(segDist * segDist, 0.001);

    waypoints.push({
      x: curr[0],
      y: 0,
      z: curr[1],
      tangentX: tx,
      tangentZ: tz,
      normalX: nx,
      normalZ: nz,
      width: TRACK_WIDTH,
      distance: cumulativeDist,
      curvature,
    });

    cumulativeDist += segDist;
  }

  return waypoints;
}

/**
 * Get total track length
 */
export function getTrackLength(waypoints: TrackWaypoint[]): number {
  if (waypoints.length === 0) return 1;
  const last = waypoints[waypoints.length - 1];
  const first = waypoints[0];
  const closingDist = Math.hypot(first.x - last.x, first.z - last.z);
  return last.distance + closingDist;
}

/**
 * Find the closest waypoint to given world coords
 */
export function findClosestWaypointIndex(
  x: number,
  z: number,
  waypoints: TrackWaypoint[],
  hintIndex?: number
): number {
  const n = waypoints.length;
  if (n === 0) return 0;

  // Search local window if hint provided, else full search
  let bestIdx = 0;
  let bestDistSq = Infinity;

  const searchStart = hintIndex !== undefined ? Math.max(0, hintIndex - 30) : 0;
  const searchEnd = hintIndex !== undefined ? Math.min(n, hintIndex + 30) : n;

  for (let i = searchStart; i < searchEnd; i++) {
    const wp = waypoints[i];
    const dx = wp.x - x;
    const dz = wp.z - z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }

  // If hint search didn't yield close match, do full sweep
  if (hintIndex !== undefined && bestDistSq > 2500) {
    for (let i = 0; i < n; i++) {
      const wp = waypoints[i];
      const dx = wp.x - x;
      const dz = wp.z - z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
  }

  return bestIdx;
}

/**
 * Calculate track progress, lap completion, and lateral offset (distance from center line)
 */
export function calculateTrackProgress(
  x: number,
  z: number,
  waypoints: TrackWaypoint[],
  lastIdx: number,
  trackLength: number
): {
  currentIndex: number;
  progress01: number;
  lateralOffset: number;
  distanceAlongTrack: number;
} {
  const n = waypoints.length;
  if (n === 0) return { currentIndex: 0, progress01: 0, lateralOffset: 0, distanceAlongTrack: 0 };

  const idx = findClosestWaypointIndex(x, z, waypoints, lastIdx);
  const wp = waypoints[idx];

  // Vector from waypoint to position
  const dx = x - wp.x;
  const dz = z - wp.z;

  // Project onto tangent
  const alongTangent = dx * wp.tangentX + dz * wp.tangentZ;
  // Project onto normal (right is positive, left is negative)
  const lateralOffset = dx * wp.normalX + dz * wp.normalZ;

  const distAlongTrack = (wp.distance + alongTangent + trackLength) % trackLength;
  const progress01 = distAlongTrack / trackLength;

  return {
    currentIndex: idx,
    progress01,
    lateralOffset,
    distanceAlongTrack: distAlongTrack,
  };
}

/**
 * Sort racers by current race standing (1st, 2nd, etc.)
 */
export function calculateRankings(
  racers: Array<{
    id: string;
    physics: {
      currentLap: number;
      totalDistance: number;
      finishTime: number | null;
      hasFinished: boolean;
    };
  }>
): string[] {
  const sorted = [...racers].sort((a, b) => {
    // Both finished: compare finish time
    if (a.physics.hasFinished && b.physics.hasFinished) {
      return (a.physics.finishTime || 0) - (b.physics.finishTime || 0);
    }
    // Only one finished: finished racer is ahead
    if (a.physics.hasFinished) return -1;
    if (b.physics.hasFinished) return 1;

    // Neither finished: compare total cumulative distance covered
    return b.physics.totalDistance - a.physics.totalDistance;
  });

  return sorted.map((r) => r.id);
}

/**
 * AI Driver Decision System:
 * - Waypoint following with target lookahead
 * - Cornering speed control (slow down for sharp curves)
 * - Obstacle avoidance (lateral steering dodge)
 * - Overtake behavior (steer into passing lane, draft boost)
 */
export function calculateAIDecision(
  aiRacer: RacerInfo,
  waypoints: TrackWaypoint[],
  trackLength: number,
  obstacles: Obstacle[],
  allRacers: RacerInfo[]
): {
  steer: number;
  throttle: number;
  brake: boolean;
  boost: boolean;
} {
  const { physics, aiProfile } = aiRacer;
  const n = waypoints.length;
  if (n === 0) return { steer: 0, throttle: 1, brake: false, boost: false };

  const currentIdx = physics.lastCheckpointIdx;
  const currentSpeed = physics.speed;

  // 1. Dynamic lookahead based on speed
  const lookaheadDist = Math.max(14, currentSpeed * 0.9);
  const samplesAhead = Math.min(n - 1, Math.max(4, Math.round(lookaheadDist / 3.5)));
  const targetIdx = (currentIdx + samplesAhead) % n;
  const targetWp = waypoints[targetIdx];

  // 2. Base lane positioning + Racing line
  let targetLaneOffset = (aiProfile?.preferredLaneOffset ?? 0) * (TRACK_WIDTH * 0.32);

  // 3. Obstacle avoidance logic
  let obstacleAvoidanceOffset = 0;
  const detectionRadius = Math.max(20, currentSpeed * 0.85);

  for (const obs of obstacles) {
    if (!obs.active) continue;
    const dx = obs.x - physics.x;
    const dz = obs.z - physics.z;
    const dist = Math.hypot(dx, dz);

    if (dist < detectionRadius) {
      // Check if obstacle is ahead of us
      const forwardDot = dx * Math.sin(physics.rotationY) + dz * Math.cos(physics.rotationY);
      if (forwardDot > 2) {
        // Calculate lateral distance relative to our heading
        const rightDot = dx * Math.cos(physics.rotationY) - dz * Math.sin(physics.rotationY);

        if (Math.abs(rightDot) < obs.radius + 3.5) {
          // Obstacle is in our direct line! Dodge away from it
          const dodgeDir = rightDot >= 0 ? -1 : 1;
          const urgency = 1 - dist / detectionRadius;
          obstacleAvoidanceOffset += dodgeDir * (obs.radius + 4) * urgency;
        }
      }
    }
  }

  // 4. Overtake behavior (check for cars ahead in our lane)
  let overtakeOffset = 0;
  let canDraftBoost = false;

  for (const other of allRacers) {
    if (other.id === aiRacer.id) continue;
    const dx = other.physics.x - physics.x;
    const dz = other.physics.z - physics.z;
    const dist = Math.hypot(dx, dz);

    // Car is in front of us within 25m
    if (dist < 26) {
      const forwardDot = dx * Math.sin(physics.rotationY) + dz * Math.cos(physics.rotationY);
      if (forwardDot > 2 && forwardDot < 25) {
        const rightDot = dx * Math.cos(physics.rotationY) - dz * Math.sin(physics.rotationY);

        // If directly ahead (within lateral 3.5m)
        if (Math.abs(rightDot) < 4.0) {
          // Draft behind for speed, but prepare to pull out and pass
          canDraftBoost = true;
          const passLeft = rightDot > 0;
          overtakeOffset = passLeft ? -4.5 : 4.5;
        }
      }
    }
  }

  // Combine lateral offsets with clamping to track boundaries
  const totalOffset = Math.max(
    -TRACK_WIDTH * 0.42,
    Math.min(TRACK_WIDTH * 0.42, targetLaneOffset + obstacleAvoidanceOffset + overtakeOffset)
  );

  // Compute world coordinates of target point with lateral offset
  const targetX = targetWp.x + targetWp.normalX * totalOffset;
  const targetZ = targetWp.z + targetWp.normalZ * totalOffset;

  // 5. Steering angle calculation towards target
  const toTargetX = targetX - physics.x;
  const toTargetZ = targetZ - physics.z;
  const targetAngle = Math.atan2(toTargetX, toTargetZ);

  let angleDiff = targetAngle - physics.rotationY;
  // Normalize angleDiff to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  // Steering normalized between -1.0 and 1.0
  const steer = Math.max(-1, Math.min(1, angleDiff * 2.4));

  // 6. Speed & throttle calculation based on track curvature
  const curvature = targetWp.curvature;
  const maxSafeSpeed = Math.max(16, 42 - curvature * 320);
  const targetSpeed = Math.min(
    (aiProfile?.topSpeedMult ?? 1.0) * 38,
    maxSafeSpeed
  );

  let throttle = 1.0;
  let brake = false;

  if (currentSpeed > targetSpeed + 4) {
    brake = true;
    throttle = 0;
  } else if (currentSpeed > targetSpeed) {
    throttle = 0.3;
  } else {
    throttle = 1.0;
  }

  // AI Boost triggers on straights when far behind or overtaking
  const isStraight = curvature < 0.02;
  const boost = isStraight && (canDraftBoost || Math.abs(steer) < 0.15) && physics.boostTimer <= 0 && Math.random() < 0.05;

  return {
    steer,
    throttle,
    brake,
    boost,
  };
}

/**
 * Step car physics simulation for one frame
 */
export function stepCarPhysics(
  state: CarPhysicsState,
  controls: {
    throttle: number;
    steer: number;
    brake: boolean;
    handbrake: boolean;
  },
  dt: number,
  trackWidth: number = TRACK_WIDTH,
  obstacles: Obstacle[] = []
): {
  state: CarPhysicsState;
  hitObstacle?: ObstacleType;
  drifted?: boolean;
} {
  // Deep clone state to ensure immutability
  const next: CarPhysicsState = { ...state };
  let hitObstacle: ObstacleType | undefined;
  let drifted = false;

  // Spin out state countdown
  if (next.isSpinningOut) {
    next.spinTimer -= dt;
    next.rotationY += dt * 10;
    next.speed *= Math.max(0, 1 - dt * 2.5);
    if (next.spinTimer <= 0) {
      next.isSpinningOut = false;
      next.spinTimer = 0;
    }
  }

  // Boost timer countdown
  if (next.boostTimer > 0) {
    next.boostTimer -= dt;
  }

  // Forward driving physics parameters
  const BASE_ACCEL = 22.0;
  const BASE_BRAKE = 38.0;
  const BASE_TOP_SPEED = 40.0; // ~144 km/h
  const BOOST_TOP_SPEED = 55.0; // ~198 km/h
  const DRAG = 0.985;
  const REVERSE_TOP_SPEED = -12.0;

  const effectiveTopSpeed = next.boostTimer > 0 ? BOOST_TOP_SPEED : BASE_TOP_SPEED;
  const accel = next.boostTimer > 0 ? BASE_ACCEL * 1.6 : BASE_ACCEL;

  if (!next.isSpinningOut) {
    // Throttle & Brake
    if (controls.throttle > 0) {
      if (next.speed < effectiveTopSpeed) {
        next.speed += controls.throttle * accel * dt;
      }
    } else if (controls.throttle < 0) {
      // Reverse
      if (next.speed > REVERSE_TOP_SPEED) {
        next.speed -= Math.abs(controls.throttle) * BASE_BRAKE * 0.5 * dt;
      }
    }

    if (controls.brake) {
      if (next.speed > 0) {
        next.speed = Math.max(0, next.speed - BASE_BRAKE * dt);
      } else if (next.speed < 0) {
        next.speed = Math.min(0, next.speed + BASE_BRAKE * dt);
      }
    }

    // Natural drag
    next.speed *= Math.pow(DRAG, dt * 60);

    // Drifting & Steering
    const speedFactor = Math.min(1.0, Math.abs(next.speed) / 10.0);
    const steerSpeed = 2.4;
    next.steerAngle = controls.steer;

    next.isDrifting = controls.handbrake && Math.abs(next.speed) > 12;
    if (next.isDrifting) {
      drifted = true;
      // Drift allows sharper rotation with lateral slip
      const driftTurnMult = 1.6;
      next.rotationY += controls.steer * steerSpeed * driftTurnMult * speedFactor * dt;
      next.speed *= Math.pow(0.97, dt * 60); // Drift friction
    } else {
      next.rotationY += controls.steer * steerSpeed * speedFactor * dt;
    }
  }

  // Update position
  const forwardX = Math.sin(next.rotationY);
  const forwardZ = Math.cos(next.rotationY);

  next.x += forwardX * next.speed * dt;
  next.z += forwardZ * next.speed * dt;

  // Obstacle Collision Checks
  for (const obs of obstacles) {
    if (!obs.active) continue;
    const dx = obs.x - next.x;
    const dz = obs.z - next.z;
    const dist = Math.hypot(dx, dz);
    const collisionThreshold = obs.radius + 1.6; // Car bounding radius is ~1.6

    if (dist < collisionThreshold) {
      hitObstacle = obs.type;
      if (obs.type === 'oil_slick') {
        next.isSpinningOut = true;
        next.spinTimer = 1.2;
      } else if (obs.type === 'boost_pad') {
        next.boostTimer = 2.5;
        next.speed = Math.max(next.speed, 48.0);
      } else if (obs.type === 'barrier_cone') {
        next.speed = Math.max(0, next.speed * 0.65);
        // Slight recoil
        next.x -= forwardX * 1.5;
        next.z -= forwardZ * 1.5;
      } else if (obs.type === 'hazard_blocker') {
        next.speed = Math.max(0, next.speed * 0.35);
        next.x -= forwardX * 2.5;
        next.z -= forwardZ * 2.5;
      }
      break;
    }
  }

  return { state: next, hitObstacle, drifted };
}

/**
 * Handle collision resolution between multiple cars (player and AI)
 */
export function resolveCarCarCollisions(racers: RacerInfo[]): void {
  const CAR_RADIUS = 1.8;
  const n = racers.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c1 = racers[i].physics;
      const c2 = racers[j].physics;

      const dx = c2.x - c1.x;
      const dz = c2.z - c1.z;
      const dist = Math.hypot(dx, dz);

      if (dist < CAR_RADIUS * 2 && dist > 0.0001) {
        // Overlapping cars! Compute separation and collision impulse
        const overlap = (CAR_RADIUS * 2 - dist) * 0.5;
        const nx = dx / dist;
        const nz = dz / dist;

        // Separate positions
        c1.x -= nx * overlap;
        c1.z -= nz * overlap;
        c2.x += nx * overlap;
        c2.z += nz * overlap;

        // Equalize some momentum
        const avgSpeed = (c1.speed + c2.speed) * 0.5;
        c1.speed = avgSpeed * 0.92;
        c2.speed = avgSpeed * 0.92;
      }
    }
  }
}
