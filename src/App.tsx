import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, type GameController } from './components/GameCanvas';
import { PauseModal } from './components/PauseModal';
import { PlayingHUD } from './components/PlayingHUD';
import { TitleScreen } from './components/TitleScreen';
import type {
  AutomaticGearSelector,
  CustomCameraSettings,
  DriveControlKey,
  GamePhase,
  HudSnapshot,
  MobileSteeringMode,
  VehicleId,
} from './sim/types';
import { VEHICLE_SPECS } from './sim/vehicles';
import { PARKING_BAYS } from './sim/worldData';

const INITIAL_HUD: HudSnapshot = {
  speedKmh: 0,
  rpm: 650,
  redlineRpm: VEHICLE_SPECS.auman_8x4.redlineRpm,
  maxRpm: VEHICLE_SPECS.auman_8x4.maxRpm,
  gear: 'N',
  clutch: 0,
  stalled: false,
  autoClutch: true,
  automaticTransmission: false,
  handbrake: false,
  braking: false,
  headlightsOn: true,
  roofLightsOn: true,
  trailerAttached: true,
  trailerSupported: true,
  activeTrailerName: 'Auman Galaxy 40ft Container',
  activeTrailerVariant: 'container',
  activeTrailerLivery: 'auman_silver',
  nearbyHookableTrailer: null,
  trailerActionNotice: null,
  shiftNotice: null,
  trailersDeliveredCount: 0,
  vehicleId: 'auman_8x4',
  vehicleName: VEHICLE_SPECS.auman_8x4.name,
  zoneName: 'GALAXY FREIGHT DEPOT',
  distanceKm: 0,
  collisions: 0,
  baysCompleted: [],
  parking: {
    nearestBay: PARKING_BAYS[0],
    distanceM: 16,
    alignmentPct: 0,
    isInside: false,
    isParkedCleanly: false,
    frontClearanceM: 2,
    rearClearanceM: 2,
    leftClearanceM: 1,
    rightClearanceM: 1,
  },
  cameraMode: 'chase',
  playerX: -24,
  playerZ: -8,
  playerHeading: 0,
  trafficDots: [],
  trailerDots: [],
};

export default function App() {
  const autostart =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1';

  const [phase, setPhase] = useState<GamePhase>(autostart ? 'playing' : 'title');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleId>('auman_8x4');
  const [customCamera, setCustomCamera] = useState<CustomCameraSettings>({
    distance: 15.5,
    height: 5.2,
    yawDeg: 34,
    lookHeight: 1.8,
  });
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [completedBayName, setCompletedBayName] = useState<string | null>(null);
  const [orientationError, setOrientationError] = useState('');
  const [mobileSteeringMode, setMobileSteeringMode] = useState<MobileSteeringMode>('wheel');

  const gameRef = useRef<GameController | null>(null);

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const handleStart = useCallback(() => {
    gameRef.current?.initAudio();
    if (hud.handbrake) {
      gameRef.current?.toggleHandbrake();
    }
    setPhase('playing');
  }, [hud.handbrake]);

  const handleSelectVehicle = useCallback((id: VehicleId) => {
    setSelectedVehicle(id);
    gameRef.current?.switchVehicle(id);
  }, []);

  const handleDriveControl = useCallback((key: DriveControlKey, amount: number) => {
    gameRef.current?.setDriveControl(key, amount);
  }, []);

  const handleBayCompleted = useCallback((_bayId: string, bayName: string) => {
    setCompletedBayName(bayName);
    setPhase('gameover');
  }, []);

  const handleNextBay = useCallback(() => {
    const remaining = PARKING_BAYS.find((b) => !hud.baysCompleted.includes(b.id)) ?? PARKING_BAYS[0];
    gameRef.current?.teleportToBay(remaining.id);
    setPhase('playing');
  }, [hud.baysCompleted]);

  const handleLandscapeRequest = async () => {
    setOrientationError('');
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }

      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: 'landscape') => Promise<void>;
      };
      if (orientation.lock) {
        await orientation.lock('landscape');
      } else {
        setOrientationError('Rotate your phone to landscape to continue.');
      }
    } catch (error) {
      const details = error instanceof Error ? ` ${error.message}` : '';
      setOrientationError(`Automatic rotation is unavailable.${details} Rotate your phone manually.`);
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#090f1a] game-shell">
      <GameCanvas
        ref={gameRef}
        phase={phase}
        selectedVehicle={selectedVehicle}
        customCamera={customCamera}
        onCustomCameraChange={setCustomCamera}
        onHudUpdate={setHud}
        onPhaseChange={setPhase}
        onBayCompleted={handleBayCompleted}
        onMuteChange={setMuted}
      />

      {phase === 'title' && (
        <TitleScreen
          selectedVehicle={selectedVehicle}
          onSelectVehicle={handleSelectVehicle}
          onStart={handleStart}
        />
      )}

      {phase === 'playing' && (
        <PlayingHUD
          hud={hud}
          muted={muted}
          customCamera={customCamera}
          onCustomCameraChange={(cfg) => gameRef.current?.setCustomCamera(cfg)}
          onSetCameraMode={(m) => gameRef.current?.setCameraMode(m)}
          onSetGear={(g) => gameRef.current?.setGear(g) ?? false}
          onSetAutomaticSelector={(selector) =>
            gameRef.current?.setAutomaticSelector(selector)
          }
          onDriveControl={handleDriveControl}
          mobileSteeringMode={mobileSteeringMode}
          onMobileSteeringModeChange={setMobileSteeringMode}
          onToggleHandbrake={() => gameRef.current?.toggleHandbrake()}
          onToggleAutoClutch={() => gameRef.current?.toggleAutoClutch()}
          onToggleAutomaticTransmission={() =>
            gameRef.current?.toggleAutomaticTransmission()
          }
          onToggleLights={() => gameRef.current?.toggleLights()}
          onToggleTrailer={() => gameRef.current?.toggleTrailer()}
          onCustomizeTrailer={(variant, livery) => gameRef.current?.customizeTrailer(variant, livery)}
          onCycleCamera={() => gameRef.current?.cycleCamera()}
          onSwitchVehicle={handleSelectVehicle}
          onTeleportBay={(bayId) => gameRef.current?.teleportToBay(bayId)}
          onResetVehicle={() => gameRef.current?.resetVehicle()}
          onHonk={() => gameRef.current?.honk()}
          onToggleMute={() => gameRef.current?.toggleMute()}
          onPause={() => setPhase('paused')}
        />
      )}

      <PauseModal
        phase={phase}
        hud={hud}
        completedBayName={completedBayName}
        onResume={() => setPhase('playing')}
        onReset={() => {
          gameRef.current?.resetVehicle();
          setPhase('playing');
        }}
        onNextBay={handleNextBay}
        onTitle={() => {
          gameRef.current?.resetVehicle();
          setPhase('title');
        }}
      />

      <div className="developer-credit pointer-events-none absolute bottom-4 right-5 select-none text-xs font-semibold tracking-widest text-white/80 drop-shadow-md">
        Developed by Mohammed yahya
      </div>

      <div className="mobile-portrait-overlay">
        <div className="mobile-portrait-card">
          <div className="text-4xl" aria-hidden="true">↻</div>
          <h1 className="text-xl font-extrabold tracking-wide text-white">Rotate your phone</h1>
          <p className="max-w-xs text-sm leading-relaxed text-slate-300">
            This driving game is designed to be played in landscape mode.
          </p>
          <button
            type="button"
            className="rounded-lg border border-sky-300 bg-sky-600 px-5 py-3 text-sm font-bold text-white"
            onClick={handleLandscapeRequest}
          >
            Try landscape mode
          </button>
          {orientationError && (
            <p role="status" className="max-w-xs text-xs leading-relaxed text-amber-200">
              {orientationError}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
