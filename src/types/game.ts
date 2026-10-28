export type RaceStatus = 'title' | 'countdown' | 'playing' | 'paused' | 'finished';

export interface Vector2D {
  x: number;
  z: number;
}

export interface TrackWaypoint {
  x: number;
  y: number;
  z: number;
  tangentX: number;
  tangentZ: number;
  normalX: number;
  normalZ: number;
  width: number;
  distance: number; // Cumulative distance along center line
  curvature: number; // Curvature factor (high = sharp turn)
}

export type ObstacleType = 'oil_slick' | 'boost_pad' | 'barrier_cone' | 'hazard_blocker';

export interface Obstacle {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  z: number;
  radius: number;
  rotation: number;
  active: boolean;
  respawnTime?: number;
  // For moving hazard blocker:
  isMoving?: boolean;
  moveRange?: number;
  moveSpeed?: number;
  baseX?: number;
  baseZ?: number;
  lateralOffset?: number;
}

export interface CarLivery {
  id: string;
  name: string;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  glowColor: string;
}

export interface AIProfile {
  id: string;
  name: string;
  livery: CarLivery;
  topSpeedMult: number; // 0.95 - 1.05
  accelerationMult: number;
  aggression: number; // 0 - 1 (willingness to overtake, take tight apexes)
  reactionTime: number; // Seconds to detect obstacles
  preferredLaneOffset: number; // -1 to +1 (left to right)
}

export interface CarPhysicsState {
  x: number;
  y: number;
  z: number;
  rotationY: number; // Facing yaw
  speed: number; // Forward velocity in m/s
  steerAngle: number; // Current wheel steer angle
  lateralVelocity: number; // Drift velocity
  angularVelocity: number;
  isDrifting: boolean;
  isSpinningOut: boolean;
  spinTimer: number;
  boostTimer: number;
  offTrackTimer: number;
  // Lap & race tracking
  currentLap: number;
  lapProgress: number; // 0.0 - 1.0 around the track
  totalDistance: number; // Cumulative race distance
  lapStartTime: number;
  currentLapTime: number;
  bestLapTime: number | null;
  lapTimes: number[];
  finishTime: number | null;
  hasFinished: boolean;
  lastCheckpointIdx: number;
}

export interface RacerInfo {
  id: string;
  name: string;
  isAI: boolean;
  livery: CarLivery;
  physics: CarPhysicsState;
  aiProfile?: AIProfile;
}

export interface RaceResult {
  rank: number;
  id: string;
  name: string;
  isPlayer: boolean;
  livery: CarLivery;
  totalTime: number;
  bestLapTime: number;
  gapToLeader: number;
}

export interface LeaderboardRecord {
  id: string;
  playerName: string;
  carName: string;
  totalTime: number;
  bestLapTime: number;
  laps: number;
  difficulty: string;
  date: string;
}

export interface RaceConfig {
  laps: number;
  difficulty: 'rookie' | 'pro' | 'master';
  aiCount: number;
  playerLivery: CarLivery;
}
