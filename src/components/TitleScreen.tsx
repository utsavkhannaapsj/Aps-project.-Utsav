import React from 'react';
import { CarLivery, RaceConfig } from '../types/game';
import { DEFAULT_LIVERIES } from '../game/GameEngine';
import { Flag, Play, Sparkles, Volume2, VolumeX, Shield, Zap, Award } from 'lucide-react';

interface TitleScreenProps {
  config: RaceConfig;
  onUpdateConfig: (newConfig: Partial<RaceConfig>) => void;
  onStartRace: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  config,
  onUpdateConfig,
  onStartRace,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div
      className="fixed inset-0 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none font-sans z-20 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/80"
      data-testid="title-screen"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
            <Zap size={18} />
          </div>
          <span className="text-xs font-black tracking-widest uppercase text-slate-300">
            Project by Utsav Khanna · 3D Racing
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          className="w-10 h-10 rounded-xl bg-slate-900/80 border border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Main Title Center Lockup */}
      <div className="flex flex-col items-center text-center max-w-xl mx-auto my-auto pointer-events-auto">
        {/* Bespoke Racing SVG Emblem */}
        <div className="mb-3">
          <svg width="120" height="48" viewBox="0 0 120 48" fill="none" className="drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <polygon points="10,40 30,8 110,8 90,40" fill="#0284c7" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="2" />
            <polygon points="25,34 40,14 100,14 85,34" fill="#00f0ff" />
            <line x1="45" y1="24" x2="80" y2="24" stroke="#090d16" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        <span className="text-xs sm:text-sm font-black tracking-widest text-cyan-400 uppercase mb-1">
          Made by Utsav Khanna
        </span>
        <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 tracking-tight uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] leading-tight">
          RACING GAME
        </h1>
        <p className="text-xs sm:text-sm font-bold tracking-wider text-slate-300 uppercase mt-1">
          College / Showcase Project · 3D Track · AI & Obstacles
        </p>

        {/* Configuration Box */}
        <div className="bg-slate-950/85 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full mt-6 shadow-2xl flex flex-col gap-4 text-left">
          {/* 1. Vehicle Selection */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Select Your Racing Machine:
            </label>
            <div className="grid grid-cols-5 gap-2">
              {DEFAULT_LIVERIES.map((livery) => {
                const isSelected = config.playerLivery.id === livery.id;
                return (
                  <button
                    key={livery.id}
                    type="button"
                    onClick={() => onUpdateConfig({ playerLivery: livery })}
                    className={`p-2 rounded-xl flex flex-col items-center gap-1.5 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-800 border-cyan-400 shadow-md ring-2 ring-cyan-500/30'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-white/40 shadow-inner"
                      style={{ backgroundColor: livery.glowColor }}
                    ></div>
                    <span className="text-[9px] font-bold text-slate-300 text-center truncate w-full">
                      {livery.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Laps Selector */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Race Distance:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {[2, 3, 5].map((laps) => (
                <button
                  key={laps}
                  type="button"
                  onClick={() => onUpdateConfig({ laps })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    config.laps === laps
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {laps} Laps
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Start CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStartRace}
          className="mt-6 w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-lg tracking-wider rounded-2xl shadow-xl shadow-cyan-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer uppercase"
        >
          <Play size={20} fill="currentColor" /> Start Race [Space / Enter]
        </button>
      </div>

      {/* Bottom Controls Legend */}
      <div className="text-center text-[11px] text-slate-400 font-mono tracking-wide">
        <span>WASD / Arrow Keys: Drive · Space: Drift · Shift / B: Nitro Boost · P / Esc: Pause</span>
      </div>
    </div>
  );
};
