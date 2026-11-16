import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, type GameController } from './components/GameCanvas';
import { PauseModal } from './components/PauseModal';
import { PlayingHUD } from './components/PlayingHUD';
import { TitleScreen } from './components/TitleScreen';
import type { CustomCameraSettings, GamePhase, HudSnapshot, VehicleId } from './sim/types';
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

  const handleBayCompleted = useCallback((_bayId: string, bayName: string) => {
    setCompletedBayName(bayName);
    setPhase('gameover');
  }, []);

  const handleNextBay = useCallback(() => {
    const remaining = PARKING_BAYS.find((b) => !hud.baysCompleted.includes(b.id)) ?? PARKING_BAYS[0];
    gameRef.current?.teleportToBay(remaining.id);
    setPhase('playing');
  }, [hud.baysCompleted]);

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
          onShiftUp={() => gameRef.current?.shiftUp()}
          onShiftDown={() => gameRef.current?.shiftDown()}
          onSetGear={(g) => gameRef.current?.setGear(g)}
          onToggleHandbrake={() => gameRef.current?.toggleHandbrake()}
          onToggleAutoClutch={() => gameRef.current?.toggleAutoClutch()}
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
    </main>
  );
}
