import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, DEFAULT_LIVERIES } from './game/GameEngine';
import { HUD } from './components/HUD';
import { TitleScreen } from './components/TitleScreen';
import { LeaderboardModal } from './components/LeaderboardModal';
import {
  LeaderboardRecord,
  Obstacle,
  RaceConfig,
  RaceResult,
  RaceStatus,
  RacerInfo,
  TrackWaypoint,
} from './types/game';
import { raceAudio } from './game/audio';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // High-level React State
  const [status, setStatus] = useState<RaceStatus>('title');
  const [config, setConfig] = useState<RaceConfig>({
    laps: 3,
    difficulty: 'pro',
    aiCount: 4,
    playerLivery: DEFAULT_LIVERIES[0],
  });

  // Live HUD States
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentLap, setCurrentLap] = useState(1);
  const [lapTime, setLapTime] = useState(0);
  const [bestLap, setBestLap] = useState<number | null>(null);
  const [rank, setRank] = useState(3);
  const [totalRacers, setTotalRacers] = useState(5);
  const [speedKmH, setSpeedKmH] = useState(0);
  const [boostRemaining, setBoostRemaining] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isWrongWay, setIsWrongWay] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Track data for minimap
  const [waypoints, setWaypoints] = useState<TrackWaypoint[]>([]);
  const [racers, setRacers] = useState<RacerInfo[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  // Race Results for Leaderboard Modal
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);

  // Handle Race Finish: Save to LocalStorage Leaderboard
  const handleRaceFinish = useCallback((results: RaceResult[]) => {
    setRaceResults(results);
    setStatus('finished');

    const playerRes = results.find((r) => r.isPlayer);
    if (playerRes) {
      try {
        const existing: LeaderboardRecord[] = JSON.parse(
          localStorage.getItem('apex_velocity_records') || '[]'
        );
        const newRecord: LeaderboardRecord = {
          id: 'rec_' + Date.now(),
          playerName: 'Player',
          carName: config.playerLivery.name,
          totalTime: playerRes.totalTime,
          bestLapTime: playerRes.bestLapTime,
          laps: config.laps,
          difficulty: config.difficulty,
          date: new Date().toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        const updated = [newRecord, ...existing].slice(0, 15);
        localStorage.setItem('apex_velocity_records', JSON.stringify(updated));
      } catch {
        // Storage fallback
      }
    }
  }, [config]);

  // Sync document.body.dataset.state with status
  useEffect(() => {
    document.body.dataset.state = status === 'finished' ? 'gameover' : status;
  }, [status]);

  // Expose test hook
  useEffect(() => {
    (window as unknown as { __TRIGGER_TEST_FINISH?: () => void }).__TRIGGER_TEST_FINISH = () => {
      handleRaceFinish([
        {
          rank: 1,
          id: 'player',
          name: 'Player',
          isPlayer: true,
          livery: config.playerLivery,
          totalTime: 78452,
          bestLapTime: 24310,
          gapToLeader: 0,
        },
        {
          rank: 2,
          id: 'ai_1',
          name: 'Apex Blaze',
          isPlayer: false,
          livery: DEFAULT_LIVERIES[2],
          totalTime: 79210,
          bestLapTime: 24900,
          gapToLeader: 0.76,
        },
        {
          rank: 3,
          id: 'ai_3',
          name: 'Phantom GT',
          isPlayer: false,
          livery: DEFAULT_LIVERIES[4],
          totalTime: 80150,
          bestLapTime: 25120,
          gapToLeader: 1.7,
        },
        {
          rank: 4,
          id: 'ai_2',
          name: 'Viper Velocity',
          isPlayer: false,
          livery: DEFAULT_LIVERIES[3],
          totalTime: 81400,
          bestLapTime: 25480,
          gapToLeader: 2.95,
        },
        {
          rank: 5,
          id: 'ai_4',
          name: 'Thunder Drift',
          isPlayer: false,
          livery: DEFAULT_LIVERIES[1],
          totalTime: 82950,
          bestLapTime: 26010,
          gapToLeader: 4.5,
        },
      ]);
    };
  }, [handleRaceFinish, config]);

  // Initialize GameEngine once
  useEffect(() => {
    if (!mountRef.current) return;

    const engine = new GameEngine(mountRef.current, config, {
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        if (newStatus === 'playing') {
          setCountdown(null);
        }
      },
      onCountdownTick: (count) => {
        setCountdown(count);
      },
      onLapUpdate: (cLap, _tLaps, lTime, bLap) => {
        setCurrentLap(cLap);
        setLapTime(lTime);
        setBestLap(bLap);
      },
      onRankUpdate: (r, total) => {
        setRank(r);
        setTotalRacers(total);
      },
      onSpeedUpdate: (spd, boost) => {
        setSpeedKmH(spd);
        setBoostRemaining(boost);
      },
      onStopwatchUpdate: (ms) => {
        setElapsedMs(ms);
      },
      onRaceFinish: handleRaceFinish,
      onWrongWay: (wrong) => {
        setIsWrongWay(wrong);
      },
    });

    engineRef.current = engine;
    setWaypoints(engine.getTrackWaypoints());
    setRacers(engine.getRacers());
    setObstacles(engine.getObstacles());

    // Check ?autostart=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setTimeout(() => {
        engine.startRace();
      }, 100);
    }

    // Polling minimap racers state at 10Hz
    const interval = setInterval(() => {
      if (engineRef.current) {
        setRacers([...engineRef.current.getRacers()]);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      engine.dispose();
      engineRef.current = null;
    };
  }, []); // Run once on mount

  // Title screen keyboard start shortcut: Space / Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        startRace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  const startRace = () => {
    if (engineRef.current) {
      engineRef.current.startRace();
    }
  };

  const pauseRace = () => {
    if (engineRef.current) {
      engineRef.current.pause();
    }
  };

  const resumeRace = () => {
    if (engineRef.current) {
      engineRef.current.resume();
    }
  };

  const restartRace = () => {
    if (engineRef.current) {
      setCurrentLap(1);
      setLapTime(0);
      setBestLap(null);
      setElapsedMs(0);
      engineRef.current.restart();
    }
  };

  const toggleMute = () => {
    const muted = raceAudio.toggleMute();
    setIsMuted(muted);
  };

  const updateConfig = (newCfg: Partial<RaceConfig>) => {
    setConfig((prev) => ({ ...prev, ...newCfg }));
    if (newCfg.playerLivery && engineRef.current) {
      engineRef.current.updatePlayerLivery(newCfg.playerLivery);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Isolated Three.js WebGL Mount Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full"
        data-testid="webgl-canvas-container"
      />

      {/* Screen 1: Title Screen */}
      {status === 'title' && (
        <TitleScreen
          config={config}
          onUpdateConfig={updateConfig}
          onStartRace={startRace}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />
      )}

      {/* Screen 2: Active Gameplay HUD (Visible during countdown, playing, and paused) */}
      {(status === 'countdown' || status === 'playing' || status === 'paused') && (
        <HUD
          elapsedMs={elapsedMs}
          currentLap={currentLap}
          totalLaps={config.laps}
          lapTime={lapTime}
          bestLap={bestLap}
          rank={rank}
          totalRacers={totalRacers}
          speedKmH={speedKmH}
          boostRemaining={boostRemaining}
          countdown={countdown}
          isWrongWay={isWrongWay}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onPause={pauseRace}
          isPaused={status === 'paused'}
          onResume={resumeRace}
          onRestart={restartRace}
          waypoints={waypoints}
          racers={racers}
          obstacles={obstacles}
          onTriggerBoost={() => {
            if (engineRef.current) {
              engineRef.current.triggerPlayerBoost();
            }
          }}
          onTouchControlChange={(ctrls) => {
            if (engineRef.current) {
              engineRef.current.setTouchControls(ctrls);
            }
          }}
        />
      )}

      {/* Screen 3: Post-Match Leaderboard Modal */}
      {status === 'finished' && (
        <LeaderboardModal
          results={raceResults}
          onPlayAgain={restartRace}
          onChangeSetup={() => setStatus('title')}
          laps={config.laps}
          difficulty={config.difficulty}
        />
      )}
    </div>
  );
}
