import React, { useState } from 'react';
import { formatRaceTime } from '../game/raceLogic';
import { LeaderboardRecord, RaceResult } from '../types/game';
import { Trophy, Medal, RotateCcw, ArrowRight, Award, Zap, Flag } from 'lucide-react';

interface LeaderboardModalProps {
  results: RaceResult[];
  onPlayAgain: () => void;
  onChangeSetup: () => void;
  laps: number;
  difficulty: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  results,
  onPlayAgain,
  onChangeSetup,
  laps,
  difficulty,
}) => {
  const [activeTab, setActiveTab] = useState<'match' | 'records'>('match');

  // Load persistent records from localStorage
  const getStoredRecords = (): LeaderboardRecord[] => {
    try {
      const data = localStorage.getItem('apex_velocity_records');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const records = getStoredRecords();

  const playerResult = results.find((r) => r.isPlayer);
  const playerRank = playerResult?.rank ?? 5;
  const isPodium = playerRank <= 3;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-none flex items-center justify-center p-4 z-50 pointer-events-auto"
      data-testid="end-match-modal"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl flex flex-col relative overflow-hidden">
        {/* Top Header Banner */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2 mb-1">
            {isPodium ? (
              <Trophy className="text-amber-400 animate-bounce" size={32} />
            ) : (
              <Flag className="text-slate-400" size={32} />
            )}
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-wider uppercase">
              {playerRank === 1
                ? 'VICTORY! RACE WINNER'
                : isPodium
                ? 'PODIUM FINISH!'
                : 'RACE COMPLETE'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Made by Utsav Khanna Racing Game for Project · {laps} Laps ({difficulty.toUpperCase()})
          </p>

          {/* Quick Mastery Stat Cards */}
          {playerResult && (
            <div className="grid grid-cols-3 gap-3 w-full mt-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Finish Position
                </span>
                <span
                  className={`text-2xl font-black font-mono ${
                    playerRank === 1
                      ? 'text-amber-400'
                      : playerRank === 2
                      ? 'text-slate-200'
                      : playerRank === 3
                      ? 'text-amber-600'
                      : 'text-slate-400'
                  }`}
                >
                  #{playerRank}
                </span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Total Time
                </span>
                <span className="text-lg sm:text-xl font-black text-white font-mono">
                  {formatRaceTime(playerResult.totalTime)}
                </span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Fastest Lap
                </span>
                <span className="text-lg sm:text-xl font-black text-cyan-400 font-mono">
                  {formatRaceTime(playerResult.bestLapTime)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('match')}
            className={`flex-1 pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
              activeTab === 'match'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Match Grid Results
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`flex-1 pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
              activeTab === 'records'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Personal Best Records
          </button>
        </div>

        {/* Tab 1: Current Match Results */}
        {activeTab === 'match' && (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {results.map((r) => {
              const isP = r.isPlayer;
              return (
                <div
                  key={r.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isP
                      ? 'bg-cyan-950/40 border-cyan-500/70 shadow-lg'
                      : 'bg-slate-950/50 border-slate-800'
                  }`}
                >
                  {/* Left: Rank & Name */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg font-black text-sm font-mono">
                      {r.rank === 1 ? (
                        <Medal className="text-amber-400" size={20} />
                      ) : r.rank === 2 ? (
                        <Medal className="text-slate-300" size={20} />
                      ) : r.rank === 3 ? (
                        <Medal className="text-amber-600" size={20} />
                      ) : (
                        <span className="text-slate-500 font-bold">{r.rank}</span>
                      )}
                    </div>

                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: r.livery.glowColor || '#64748b' }}
                    ></div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-sm ${
                            isP ? 'text-cyan-300 font-black' : 'text-slate-200'
                          }`}
                        >
                          {r.name}
                        </span>
                        {isP && (
                          <span className="text-[9px] bg-cyan-500 text-slate-950 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Best Lap: {formatRaceTime(r.bestLapTime)}
                      </span>
                    </div>
                  </div>

                  {/* Right: Total Time & Gap */}
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-sm font-bold text-white">
                      {formatRaceTime(r.totalTime)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {r.gapToLeader === 0 ? 'Leader' : `+${r.gapToLeader.toFixed(2)}s`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Best Records */}
        {activeTab === 'records' && (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {records.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No past records saved yet. Finish more races to populate your Hall of Fame!
              </div>
            ) : (
              records.map((rec, i) => (
                <div
                  key={rec.id || i}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <Award className="text-amber-400" size={18} />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-slate-200">
                        {rec.carName} · {rec.laps} Laps ({rec.difficulty})
                      </span>
                      <span className="text-[10px] text-slate-500">{rec.date}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="font-mono text-xs font-bold text-white">
                      {formatRaceTime(rec.totalTime)}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">
                      Best: {formatRaceTime(rec.bestLapTime)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onChangeSetup}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw size={16} /> Change Vehicle / Laps
          </button>
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition-colors shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            Race Again <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
