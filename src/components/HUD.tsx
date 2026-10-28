import React, { useEffect, useRef, useState, useCallback } from 'react';
import { formatRaceTime } from '../game/raceLogic';
import { Obstacle, RacerInfo, TrackWaypoint } from '../types/game';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Zap,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Flame,
} from 'lucide-react';

interface HUDProps {
  elapsedMs: number;
  currentLap: number;
  totalLaps: number;
  lapTime: number;
  bestLap: number | null;
  rank: number;
  totalRacers: number;
  speedKmH: number;
  boostRemaining: number;
  countdown: number | null;
  isWrongWay: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  isPaused: boolean;
  onResume: () => void;
  onRestart: () => void;
  waypoints: TrackWaypoint[];
  racers: RacerInfo[];
  obstacles: Obstacle[];
  onTriggerBoost: () => void;
  onTouchControlChange?: (controls: {
    throttle: number;
    steer: number;
    brake: boolean;
    handbrake: boolean;
  }) => void;
}

export const HUD: React.FC<HUDProps> = ({
  elapsedMs,
  currentLap,
  totalLaps,
  lapTime,
  bestLap,
  rank,
  totalRacers,
  speedKmH,
  boostRemaining,
  countdown,
  isWrongWay,
  isMuted,
  onToggleMute,
  onPause,
  isPaused,
  onResume,
  onRestart,
  waypoints,
  racers,
  obstacles,
  onTriggerBoost,
  onTouchControlChange,
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  // Active navigation button states
  const [controls, setControls] = useState({
    throttle: 0,
    steer: 0,
    brake: false,
    handbrake: false,
  });

  const updateControls = useCallback(
    (updater: (prev: typeof controls) => typeof controls) => {
      setControls((prev) => {
        const next = updater(prev);
        if (onTouchControlChange) {
          onTouchControlChange(next);
        }
        return next;
      });
    },
    [onTouchControlChange]
  );

  // Render Minimap
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas || waypoints.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Compute bounding box of track
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    waypoints.forEach((wp) => {
      if (wp.x < minX) minX = wp.x;
      if (wp.x > maxX) maxX = wp.x;
      if (wp.z < minZ) minZ = wp.z;
      if (wp.z > maxZ) maxZ = wp.z;
    });

    const padding = 16;
    const trackW = maxX - minX;
    const trackH = maxZ - minZ;
    const scale = Math.min((w - padding * 2) / trackW, (h - padding * 2) / trackH);

    const toMapX = (worldX: number) => padding + (worldX - minX) * scale;
    const toMapY = (worldZ: number) => padding + (worldZ - minZ) * scale;

    // 1. Draw track line
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    waypoints.forEach((wp, i) => {
      const mx = toMapX(wp.x);
      const my = toMapY(wp.z);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.closePath();
    ctx.stroke();

    // Inner bright track core
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Start/Finish line marker on map
    const wp0 = waypoints[0];
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(toMapX(wp0.x), toMapY(wp0.z), 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Obstacles on map
    obstacles.forEach((obs) => {
      const ox = toMapX(obs.x);
      const oy = toMapY(obs.z);
      if (obs.type === 'boost_pad') {
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(ox - 2, oy - 2, 4, 4);
      } else if (obs.type === 'oil_slick') {
        ctx.fillStyle = '#e879f9';
        ctx.beginPath();
        ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(ox, oy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 3. Draw Racers on map
    racers.forEach((racer) => {
      const rx = toMapX(racer.physics.x);
      const ry = toMapY(racer.physics.z);

      if (racer.isAI) {
        ctx.fillStyle = racer.livery.glowColor || '#94a3b8';
        ctx.beginPath();
        ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Player: bright cyan with outer ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [waypoints, racers, obstacles]);

  // Rank badge suffix
  const getRankSuffix = (r: number) => {
    if (r === 1) return 'ST';
    if (r === 2) return 'ND';
    if (r === 3) return 'RD';
    return 'TH';
  };

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none z-10 font-sans"
      data-testid="race-hud"
    >
      {/* TOP-LEFT: STOPWATCH CORNER CLUSTER */}
      <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-auto">
        <div className="bg-slate-950/85 border border-slate-700/60 rounded-xl px-4 py-2.5 shadow-xl">
          <div className="text-[10px] tracking-wider uppercase font-bold text-slate-400 flex items-center justify-between">
            <span className="text-cyan-400 font-extrabold">Utsav Khanna · Stopwatch</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="text-3xl font-black tracking-tight text-white font-mono">
            {formatRaceTime(elapsedMs)}
          </div>
          <div className="flex items-center gap-3 mt-1 pt-1 border-t border-slate-800 text-[11px] font-mono text-slate-300">
            <div>
              <span className="text-slate-500 uppercase mr-1">Best:</span>
              <span className="text-amber-400 font-semibold">
                {bestLap ? formatRaceTime(bestLap) : '--:--.---'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 uppercase mr-1">Lap:</span>
              <span>{formatRaceTime(lapTime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TOP-CENTER: COUNTDOWN & RACE NOTIFICATIONS */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
        {countdown !== null && countdown > 0 && (
          <div className="text-7xl font-black text-amber-400 tracking-wider font-mono drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] animate-pulse">
            {countdown}
          </div>
        )}
        {countdown === 0 && (
          <div className="text-7xl font-black text-emerald-400 tracking-wider font-mono drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
            GO!
          </div>
        )}
        {isWrongWay && (
          <div className="bg-rose-600/90 text-white font-black text-sm px-4 py-1.5 rounded-full border border-rose-400 tracking-widest uppercase animate-bounce shadow-lg mt-2">
            ⚠️ WRONG WAY! TURN AROUND!
          </div>
        )}
        {currentLap === totalLaps && countdown === null && (
          <div className="bg-amber-500/90 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
            🏁 FINAL LAP!
          </div>
        )}
      </div>

      {/* TOP-RIGHT: MINIMAP & UTILITY BUTTONS */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="w-9 h-9 rounded-lg bg-slate-900/80 border border-slate-700/60 hover:bg-slate-800 flex items-center justify-center text-slate-200 transition-colors shadow-lg cursor-pointer"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause Game"
            className="w-9 h-9 rounded-lg bg-slate-900/80 border border-slate-700/60 hover:bg-slate-800 flex items-center justify-center text-slate-200 transition-colors shadow-lg cursor-pointer"
          >
            <Pause size={16} />
          </button>
        </div>

        {/* Minimap card */}
        <div className="bg-slate-950/85 border border-slate-700/60 rounded-xl p-2 shadow-xl flex flex-col items-center">
          <canvas
            ref={minimapCanvasRef}
            width={140}
            height={140}
            className="w-[140px] h-[140px]"
          />
          <div className="flex items-center justify-between w-full px-1 pt-1 text-[9px] text-slate-400 font-semibold uppercase">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> You
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> AI
            </span>
          </div>
        </div>
      </div>

      {/* NAVIGATION CONTROLS DOCK (On-screen Buttons for Steering, Drive, Reverse, Drift, and Nitro Boost) */}
      <div className="absolute bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 sm:gap-6 pointer-events-auto z-20">
        {/* Steering Cluster */}
        <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-700/70 p-2 rounded-2xl shadow-2xl backdrop-none">
          <button
            type="button"
            aria-label="Steer Left"
            onPointerDown={() => updateControls((c) => ({ ...c, steer: -1 }))}
            onPointerUp={() => updateControls((c) => ({ ...c, steer: 0 }))}
            onPointerLeave={() => updateControls((c) => ({ ...c, steer: 0 }))}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex flex-col items-center justify-center font-black transition-all cursor-pointer border ${
              controls.steer === -1
                ? 'bg-cyan-500 text-slate-950 border-cyan-300 scale-95 shadow-cyan-500/50 shadow-lg'
                : 'bg-slate-900/90 text-white border-slate-700 hover:bg-slate-800 active:scale-95'
            }`}
          >
            <ChevronLeft size={28} />
            <span className="text-[9px] font-bold tracking-wider uppercase mt-[-4px]">Left</span>
          </button>

          <button
            type="button"
            aria-label="Steer Right"
            onPointerDown={() => updateControls((c) => ({ ...c, steer: 1 }))}
            onPointerUp={() => updateControls((c) => ({ ...c, steer: 0 }))}
            onPointerLeave={() => updateControls((c) => ({ ...c, steer: 0 }))}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex flex-col items-center justify-center font-black transition-all cursor-pointer border ${
              controls.steer === 1
                ? 'bg-cyan-500 text-slate-950 border-cyan-300 scale-95 shadow-cyan-500/50 shadow-lg'
                : 'bg-slate-900/90 text-white border-slate-700 hover:bg-slate-800 active:scale-95'
            }`}
          >
            <ChevronRight size={28} />
            <span className="text-[9px] font-bold tracking-wider uppercase mt-[-4px]">Right</span>
          </button>
        </div>

        {/* DEDICATED NITRO BOOST BUTTON */}
        <button
          type="button"
          aria-label="Nitro Boost"
          onClick={onTriggerBoost}
          className={`px-4 sm:px-6 h-14 sm:h-16 rounded-2xl flex items-center justify-center gap-2 sm:gap-2.5 font-black uppercase tracking-wider text-xs sm:text-sm transition-all cursor-pointer border shadow-2xl ${
            boostRemaining > 0
              ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-400 text-slate-950 border-white scale-105 shadow-cyan-400/80 animate-pulse'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 border-cyan-300 active:scale-95 shadow-cyan-500/40'
          }`}
        >
          <Zap size={22} className={boostRemaining > 0 ? 'animate-bounce text-slate-950' : 'text-slate-950'} />
          <div className="flex flex-col items-start leading-tight">
            <span>{boostRemaining > 0 ? 'BOOSTING!' : 'NITRO BOOST'}</span>
            <span className="text-[9px] font-mono opacity-80">[Shift / B]</span>
          </div>
        </button>

        {/* Drive, Brake & Drift Cluster */}
        <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-700/70 p-2 rounded-2xl shadow-2xl backdrop-none">
          <button
            type="button"
            aria-label="Drift"
            onPointerDown={() => updateControls((c) => ({ ...c, handbrake: true }))}
            onPointerUp={() => updateControls((c) => ({ ...c, handbrake: false }))}
            onPointerLeave={() => updateControls((c) => ({ ...c, handbrake: false }))}
            className={`w-12 h-14 sm:w-14 sm:h-16 rounded-xl flex flex-col items-center justify-center font-black transition-all cursor-pointer border ${
              controls.handbrake
                ? 'bg-amber-400 text-slate-950 border-amber-300 scale-95 shadow-amber-400/50 shadow-lg'
                : 'bg-slate-900/90 text-amber-400 border-slate-700 hover:bg-slate-800 active:scale-95'
            }`}
          >
            <Flame size={20} />
            <span className="text-[9px] font-bold tracking-wider uppercase mt-[-2px]">Drift</span>
          </button>

          <button
            type="button"
            aria-label="Brake or Reverse"
            onPointerDown={() => updateControls((c) => ({ ...c, brake: true, throttle: -0.7 }))}
            onPointerUp={() => updateControls((c) => ({ ...c, brake: false, throttle: 0 }))}
            onPointerLeave={() => updateControls((c) => ({ ...c, brake: false, throttle: 0 }))}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex flex-col items-center justify-center font-black transition-all cursor-pointer border ${
              controls.brake || controls.throttle < 0
                ? 'bg-rose-500 text-white border-rose-300 scale-95 shadow-rose-500/50 shadow-lg'
                : 'bg-slate-900/90 text-rose-400 border-slate-700 hover:bg-slate-800 active:scale-95'
            }`}
          >
            <ArrowDown size={24} />
            <span className="text-[9px] font-bold tracking-wider uppercase mt-[-3px]">Brake</span>
          </button>

          <button
            type="button"
            aria-label="Drive or Accelerate"
            onPointerDown={() => updateControls((c) => ({ ...c, throttle: 1, brake: false }))}
            onPointerUp={() => updateControls((c) => ({ ...c, throttle: 0 }))}
            onPointerLeave={() => updateControls((c) => ({ ...c, throttle: 0 }))}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex flex-col items-center justify-center font-black transition-all cursor-pointer border ${
              controls.throttle > 0
                ? 'bg-emerald-400 text-slate-950 border-emerald-200 scale-95 shadow-emerald-400/50 shadow-lg'
                : 'bg-slate-900/90 text-emerald-400 border-slate-700 hover:bg-slate-800 active:scale-95'
            }`}
          >
            <ArrowUp size={24} />
            <span className="text-[9px] font-bold tracking-wider uppercase mt-[-3px]">Drive</span>
          </button>
        </div>
      </div>

      {/* BOTTOM-LEFT: POSITION & LAP COUNTER */}
      <div className="absolute bottom-5 left-5 pointer-events-auto">
        <div className="bg-slate-950/85 border border-slate-700/60 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-5">
          {/* Position */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Position
            </span>
            <div className="flex items-baseline">
              <span className="text-4xl font-black text-amber-400 font-mono">
                {rank}
              </span>
              <span className="text-lg font-bold text-amber-400/80 mr-1.5">
                {getRankSuffix(rank)}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                / {totalRacers}
              </span>
            </div>
          </div>

          <div className="w-[1px] h-10 bg-slate-800"></div>

          {/* Lap Counter */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Lap
            </span>
            <div className="flex items-baseline">
              <span className="text-3xl font-black text-white font-mono">
                {Math.min(currentLap, totalLaps)}
              </span>
              <span className="text-sm font-semibold text-slate-500 ml-1">
                / {totalLaps}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM-RIGHT: SPEEDOMETER & NITRO GAUGE */}
      <div className="absolute bottom-5 right-5 pointer-events-auto">
        <div className="bg-slate-950/85 border border-slate-700/60 rounded-xl px-5 py-3 shadow-2xl flex flex-col items-end min-w-[170px]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black text-white font-mono tracking-tight">
              {speedKmH}
            </span>
            <span className="text-xs font-bold text-slate-400 tracking-wider">
              KM/H
            </span>
          </div>

          {/* Speed Bar Gauge */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5 border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-rose-500 transition-all duration-75"
              style={{ width: `${Math.min(100, (speedKmH / 180) * 100)}%` }}
            ></div>
          </div>

          {/* Nitro Boost Status */}
          <div className="flex items-center gap-1.5 mt-2 text-[11px] font-mono font-semibold">
            <Zap
              size={12}
              className={boostRemaining > 0 ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}
            />
            <span className={boostRemaining > 0 ? 'text-cyan-400' : 'text-slate-400'}>
              {boostRemaining > 0 ? 'BOOST ACTIVE!' : 'NITRO READY'}
            </span>
          </div>
        </div>
      </div>

      {/* PAUSE MODAL OVERLAY */}
      {isPaused && (
        <div className="fixed inset-0 bg-slate-950/70 pointer-events-auto flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center">
            <h2 className="text-2xl font-black text-white tracking-wide uppercase mb-1">
              Race Paused
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Take a breath and hit resume when ready to race.
            </p>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={onResume}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-sm transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play size={16} /> Resume Race [P]
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw size={14} /> Restart Race
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

