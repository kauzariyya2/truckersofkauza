import type { GamePhase, HudSnapshot } from '../sim/types';
import { PARKING_BAYS } from '../sim/worldData';

interface PauseModalProps {
  phase: GamePhase;
  hud: HudSnapshot;
  completedBayName: string | null;
  onResume: () => void;
  onReset: () => void;
  onNextBay: () => void;
  onTitle: () => void;
}

export function PauseModal({
  phase,
  hud,
  completedBayName,
  onResume,
  onReset,
  onNextBay,
  onTitle,
}: PauseModalProps) {
  if (phase !== 'paused' && phase !== 'gameover') return null;

  const isBayVictory = phase === 'gameover';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060a12]/72 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isBayVictory ? 'Parking Bay Cleared' : 'Simulation Paused'}
        className="w-full max-w-md rounded-lg bg-[#0d1524] border border-slate-700 shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-6 flex flex-col gap-5 text-slate-100"
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] font-bold text-[#38bdf8]">
            {isBayVictory ? 'Precision Parking Locked' : 'Simulation Paused'}
          </div>
          <h2 className="text-2xl font-black tracking-wide uppercase mt-1">
            {isBayVictory ? completedBayName ?? 'Bay Complete' : hud.vehicleName}
          </h2>
        </div>

        {/* 3 Tabular Stat Tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-slate-900/90 border border-slate-800 rounded p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Distance</div>
            <div className="text-lg font-extrabold tabular-nums text-white mt-0.5">
              {hud.distanceKm.toFixed(2)} <span className="text-xs text-slate-400">km</span>
            </div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Bays</div>
            <div className="text-lg font-extrabold tabular-nums text-emerald-400 mt-0.5">
              {hud.baysCompleted.length}/{PARKING_BAYS.length}
            </div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Impacts</div>
            <div className="text-lg font-extrabold tabular-nums text-amber-300 mt-0.5">
              {hud.collisions}
            </div>
          </div>
        </div>

        {!isBayVictory && (
          <div className="bg-slate-900/60 border border-slate-800 rounded p-3 text-xs text-slate-300 space-y-1">
            <div className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">
              Manual Driving Controls
            </div>
            <div>W/S: Throttle &amp; Brake · A/D: Steer · Space: Park Brake · T: Hook/Drop Trailer</div>
            <div>Q/E or 1-6/R/N: Shift Gear · C/Shift: Clutch · K: Auto-Clutch</div>
            <div>Tab: Switch Car/Truck/Bus · V: Camera / Custom View · L: Lights · H: Horn</div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-start={isBayVictory ? 'true' : undefined}
            onClick={(e) => {
              e.currentTarget.blur();
              onResume();
            }}
            className="w-full py-3 rounded bg-[#0284c7] hover:bg-[#0ea5e9] text-white font-extrabold uppercase tracking-[0.16em] text-xs cursor-pointer"
          >
            {isBayVictory ? 'Continue Free Roam' : 'Resume Driving'}
          </button>

          {isBayVictory ? (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onNextBay();
              }}
              className="w-full py-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold uppercase tracking-[0.14em] text-xs cursor-pointer"
            >
              Jump to Next Parking Bay
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onReset();
              }}
              className="w-full py-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold uppercase tracking-[0.14em] text-xs cursor-pointer"
            >
              Reset Vehicle to Depot
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTitle();
            }}
            className="w-full py-2.5 rounded bg-transparent hover:bg-slate-800/70 border border-slate-800 text-slate-400 hover:text-slate-200 font-bold uppercase tracking-[0.14em] text-xs cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}
