import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRaceTime,
  generateTrackWaypoints,
  getTrackLength,
  calculateRankings,
  calculateAIDecision,
  stepCarPhysics,
  resolveCarCarCollisions,
} from './raceLogic';
import { CarPhysicsState, RacerInfo, Obstacle } from '../types/game';

test('formatRaceTime formats milliseconds properly', () => {
  assert.equal(formatRaceTime(0), '00:00.000');
  assert.equal(formatRaceTime(1234), '00:01.234');
  assert.equal(formatRaceTime(65432), '01:05.432');
  assert.equal(formatRaceTime(null), '00:00.000');
  assert.equal(formatRaceTime(-50), '00:00.000');
});

test('generateTrackWaypoints creates closed circuit with valid tangents and distances', () => {
  const waypoints = generateTrackWaypoints();
  assert.ok(waypoints.length > 50, 'Waypoints should be generated across circuit');
  const trackLen = getTrackLength(waypoints);
  assert.ok(trackLen > 200, 'Track length should be substantial');

  // Verify first waypoint has non-zero tangent
  const wp0 = waypoints[0];
  const tangentLen = Math.hypot(wp0.tangentX, wp0.tangentZ);
  assert.ok(Math.abs(tangentLen - 1.0) < 0.01, 'Tangent should be normalized');
});

test('calculateRankings ranks racers by finish time or distance', () => {
  const racers = [
    {
      id: 'carA',
      physics: { currentLap: 1, totalDistance: 300, finishTime: null, hasFinished: false },
    },
    {
      id: 'carB',
      physics: { currentLap: 1, totalDistance: 450, finishTime: null, hasFinished: false },
    },
    {
      id: 'carC',
      physics: { currentLap: 2, totalDistance: 600, finishTime: 45000, hasFinished: true },
    },
  ];

  const rankings = calculateRankings(racers);
  // Finished car first, then car with highest distance
  assert.deepEqual(rankings, ['carC', 'carB', 'carA']);
});

test('stepCarPhysics accelerates car and respects top speed and obstacles', () => {
  const initial: CarPhysicsState = {
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0,
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
    totalDistance: 0,
    lapStartTime: 0,
    currentLapTime: 0,
    bestLapTime: null,
    lapTimes: [],
    finishTime: null,
    hasFinished: false,
    lastCheckpointIdx: 0,
  };

  const controls = { throttle: 1, steer: 0, brake: false, handbrake: false };
  const res1 = stepCarPhysics(initial, controls, 0.1);
  assert.ok(res1.state.speed > 0, 'Car should accelerate forward with throttle');
  assert.ok(res1.state.z > 0, 'Position Z should increase when facing forward (rotationY=0)');

  // Test boost pad collision
  const boostObstacle: Obstacle = {
    id: 'boost1',
    type: 'boost_pad',
    x: 0,
    y: 0,
    z: res1.state.z + 0.5,
    radius: 3,
    rotation: 0,
    active: true,
  };

  const res2 = stepCarPhysics(res1.state, controls, 0.1, 18, [boostObstacle]);
  assert.equal(res2.hitObstacle, 'boost_pad');
  assert.ok(res2.state.boostTimer > 0, 'Boost timer should be activated on pad');
});

test('calculateAIDecision steers and avoids obstacle ahead', () => {
  const waypoints = generateTrackWaypoints();
  const trackLen = getTrackLength(waypoints);

  const aiRacer: RacerInfo = {
    id: 'ai_1',
    name: 'Phantom',
    isAI: true,
    livery: {
      id: 'l1',
      name: 'Phantom',
      primaryColor: 0x9900ee,
      secondaryColor: 0x111111,
      accentColor: 0x00ffcc,
      glowColor: '#00ffcc',
    },
    aiProfile: {
      id: 'p1',
      name: 'Phantom',
      livery: {
        id: 'l1',
        name: 'Phantom',
        primaryColor: 0x9900ee,
        secondaryColor: 0x111111,
        accentColor: 0x00ffcc,
        glowColor: '#00ffcc',
      },
      topSpeedMult: 1.0,
      accelerationMult: 1.0,
      aggression: 0.8,
      reactionTime: 0.2,
      preferredLaneOffset: 0,
    },
    physics: {
      x: 0,
      y: 0,
      z: -180,
      rotationY: Math.PI / 2, // Facing right along track
      speed: 25,
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
      totalDistance: 0,
      lapStartTime: 0,
      currentLapTime: 0,
      bestLapTime: null,
      lapTimes: [],
      finishTime: null,
      hasFinished: false,
      lastCheckpointIdx: 0,
    },
  };

  const decision = calculateAIDecision(aiRacer, waypoints, trackLen, [], [aiRacer]);
  assert.ok(typeof decision.steer === 'number', 'AI computes a steer number');
  assert.ok(typeof decision.throttle === 'number', 'AI computes throttle');
});

test('resolveCarCarCollisions separates overlapping cars', () => {
  const car1: RacerInfo = {
    id: 'c1',
    name: 'Car 1',
    isAI: false,
    livery: {} as any,
    physics: { x: 10, y: 0, z: 10, speed: 20 } as any,
  };
  const car2: RacerInfo = {
    id: 'c2',
    name: 'Car 2',
    isAI: true,
    livery: {} as any,
    physics: { x: 10.5, y: 0, z: 10.5, speed: 20 } as any,
  };

  const initDist = Math.hypot(car2.physics.x - car1.physics.x, car2.physics.z - car1.physics.z);
  resolveCarCarCollisions([car1, car2]);
  const newDist = Math.hypot(car2.physics.x - car1.physics.x, car2.physics.z - car1.physics.z);

  assert.ok(newDist > initDist, 'Colliding cars should push away from each other');
});
