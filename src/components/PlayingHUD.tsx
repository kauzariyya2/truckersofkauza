import { useRef, useState } from 'react';
import type {
  CameraMode,
  CustomCameraSettings,
  GearValue,
  HudSnapshot,
  TrailerLivery,
  TrailerVariant,
  VehicleId,
} from '../sim/types';
import { VEHICLE_ORDER } from '../sim/vehicles';
import { PARKING_BAYS } from '../sim/worldData';

interface PlayingHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  customCamera: CustomCameraSettings;
  onCustomCameraChange: (next: CustomCameraSettings) => void;
  onSetCameraMode: (mode: CameraMode) => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
  onSetGear: (gear: GearValue) => void;
  onToggleHandbrake: () => void;
  onToggleAutoClutch: () => void;
  onToggleLights: () => void;
  onToggleTrailer: () => void;
  onCustomizeTrailer: (variant: TrailerVariant, livery: TrailerLivery) => void;
  onCycleCamera: () => void;
  onSwitchVehicle: (id: VehicleId) => void;
  onTeleportBay: (bayId: string) => void;
  onResetVehicle: () => void;
  onHonk: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}

const GEARS: GearValue[] = ['R', 'N', 1, 2, 3, 4, 5, 6];

const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'CHASE',
  cab: 'CAB VIEW',
  top: 'OVERHEAD',
  orbit: 'ORBIT',
  custom: 'CUSTOM',
};

const CUSTOM_CAM_PRESETS: Array<{ label: string; settings: CustomCameraSettings }> = [
  { label: '3/4 Hero', settings: { distance: 15.5, height: 5.2, yawDeg: 34, lookHeight: 1.8 } },
  { label: 'Dock Mirror', settings: { distance: 11.5, height: 4.2, yawDeg: 148, lookHeight: 1.6 } },
  { label: 'Highway', settings: { distance: 22.0, height: 8.0, yawDeg: 10, lookHeight: 1.8 } },
  { label: 'Wheel Cam', settings: { distance: 6.5, height: 1.4, yawDeg: 128, lookHeight: 1.0 } },
];

const TRAILER_VARIANTS: Array<{ id: TrailerVariant; label: string }> = [
  { id: 'container', label: 'Container' },
  { id: 'tanker', label: 'Tanker' },
  { id: 'flatbed', label: 'Flatbed' },
];

const TRAILER_LIVERIES: Array<{ id: TrailerLivery; label: string; swatch: string }> = [
  { id: 'auman_silver', label: 'Silver', swatch: '#94a3b8' },
  { id: 'ocean_blue', label: 'Blue', swatch: '#2563eb' },
  { id: 'crimson_haul', label: 'Crimson', swatch: '#dc2626' },
  { id: 'amber_chrome', label: 'Amber', swatch: '#d97706' },
];

export function PlayingHUD({
  hud,
  muted,
  customCamera,
  onCustomCameraChange,
  onSetCameraMode,
  onShiftUp,
  onShiftDown,
  onSetGear,
  onToggleHandbrake,
  onToggleAutoClutch,
  onToggleLights,
  onToggleTrailer,
  onCustomizeTrailer,
  onCycleCamera,
  onSwitchVehicle,
  onTeleportBay,
  onResetVehicle,
  onHonk,
  onToggleMute,
  onPause,
}: PlayingHUDProps) {
  const [openMenu, setOpenMenu] = useState<'bays' | 'trailer' | null>(null);
  const [pickedVariant, setPickedVariant] = useState<TrailerVariant>(hud.activeTrailerVariant);
  const [pickedLivery, setPickedLivery] = useState<TrailerLivery>(hud.activeTrailerLivery);
  const pickedVariantRef = useRef<TrailerVariant>(hud.activeTrailerVariant);
  const pickedLiveryRef = useRef<TrailerLivery>(hud.activeTrailerLivery);

  const rpmRatio = Math.max(0, Math.min(1, hud.rpm / Math.max(1, hud.maxRpm)));
  const isRedline = hud.rpm >= hud.redlineRpm;
  const arcLen = 176;
  const rpmStrokeOffset = arcLen * (1 - rpmRatio);

  const { parking } = hud;
  const showParkingPanel = parking.distanceM < 30 && parking.nearestBay !== null;

  // Map [-215, 215] world coordinates to [6, 114] minimap SVG space
  const toMini = (val: number) => 60 + (val / 215) * 54;
  const playerDeg = (hud.playerHeading * 180) / Math.PI;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 select-none">
      {/* TOP-CENTER HOOK / DELIVERY NOTIFICATION */}
      {(hud.nearbyHookableTrailer || hud.trailerActionNotice) && (
        <div className="fixed top-[108px] left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <div
            data-testid="hud-trailer-notice"
            className={`px-4 py-1.5 rounded border text-xs font-extrabold uppercase tracking-[0.14em] shadow-lg ${
              hud.nearbyHookableTrailer
                ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                : 'bg-[#0c1320]/95 border-sky-400 text-sky-200'
            }`}
          >
            {hud.nearbyHookableTrailer
              ? `Kingpin Aligned — Press [T] to Hook ${hud.nearbyHookableTrailer}`
              : hud.trailerActionNotice}
          </div>
        </div>
      )}

      {/* TOP PERIMETER ROW */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Live 480m 3-Lane Minimap + Zone + Fleet + Custom Trailer Switcher */}
        <div className="pointer-events-auto flex items-start gap-3">
          <div className="w-[126px] h-[126px] rounded bg-[#0c1320]/90 border border-slate-700/90 shadow-[0_6px_20px_rgba(0,0,0,0.65)] p-1 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full" aria-label="District Minimap">
              <rect x="0" y="0" width="120" height="120" rx="4" fill="#0f172a" />
              {/* Outer 480m Express Ring (±184) */}
              <rect
                x={toMini(-184)}
                y={toMini(-184)}
                width={toMini(184) - toMini(-184)}
                height={toMini(184) - toMini(-184)}
                fill="none"
                stroke="#334155"
                strokeWidth="3.2"
              />
              {/* Secondary Arterials */}
              <line x1={toMini(-184)} y1={toMini(-84)} x2={toMini(184)} y2={toMini(-84)} stroke="#334155" strokeWidth="2.4" />
              <line x1={toMini(-184)} y1={toMini(118)} x2={toMini(184)} y2={toMini(118)} stroke="#334155" strokeWidth="2.4" />
              <line x1={toMini(-104)} y1={toMini(-184)} x2={toMini(-104)} y2={toMini(184)} stroke="#334155" strokeWidth="2.4" />
              {/* Narrow Old-Quarter Alleys */}
              <line x1={toMini(96)} y1={toMini(-184)} x2={toMini(96)} y2={toMini(50)} stroke="#334155" strokeWidth="1.6" />
              <line x1={toMini(134)} y1={toMini(-184)} x2={toMini(134)} y2={toMini(50)} stroke="#334155" strokeWidth="1.6" />
              <line x1={toMini(32)} y1={toMini(-34)} x2={toMini(184)} y2={toMini(-34)} stroke="#334155" strokeWidth="1.6" />

              {/* Grand N-S 3-Lane Dual Highway (X = +32) */}
              <line x1={toMini(32)} y1={toMini(-188)} x2={toMini(32)} y2={toMini(188)} stroke="#64748b" strokeWidth="6.2" />
              <line x1={toMini(32)} y1={toMini(-188)} x2={toMini(32)} y2={toMini(188)} stroke="#f59e0b" strokeWidth="0.7" />
              {/* Grand E-W 3-Lane Expressway (Z = +50) */}
              <line x1={toMini(-188)} y1={toMini(50)} x2={toMini(188)} y2={toMini(50)} stroke="#64748b" strokeWidth="6.2" />
              <line x1={toMini(-188)} y1={toMini(50)} x2={toMini(188)} y2={toMini(50)} stroke="#f59e0b" strokeWidth="0.7" />

              {/* Parking & Freight Bays */}
              {PARKING_BAYS.map((b) => {
                const done = hud.baysCompleted.includes(b.id);
                return (
                  <circle
                    key={b.id}
                    cx={toMini(b.x)}
                    cy={toMini(b.z)}
                    r="2.4"
                    fill={done ? '#22c55e' : '#38bdf8'}
                  />
                );
              })}

              {/* Parked Trailer Markers (Amber Squares) */}
              {hud.trailerDots.map((tr, i) =>
                tr.attached ? null : (
                  <rect
                    key={`tr_${i}`}
                    x={toMini(tr.x) - 1.8}
                    y={toMini(tr.z) - 1.8}
                    width="3.6"
                    height="3.6"
                    fill="#f59e0b"
                    stroke="#0f172a"
                    strokeWidth="0.5"
                  />
                ),
              )}

              {/* Traffic Vehicle Dots */}
              {hud.trafficDots.map((t, i) => (
                <circle
                  key={i}
                  cx={toMini(t.x)}
                  cy={toMini(t.z)}
                  r={t.kind === 'city_bus' || t.kind === 'semi_tractor' ? 1.9 : 1.3}
                  fill={
                    t.kind === 'city_bus'
                      ? '#60a5fa'
                      : t.kind === 'semi_tractor' || t.kind === 'box_truck'
                        ? '#f59e0b'
                        : '#cbd5e1'
                  }
                />
              ))}

              {/* Player Arrow */}
              <g transform={`translate(${toMini(hud.playerX)}, ${toMini(hud.playerZ)}) rotate(${-playerDeg + 180})`}>
                <polygon points="0,-4.5 3.4,3.8 0,2 -3.4,3.8" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.8" />
              </g>
            </svg>
          </div>

          {/* Zone, Fleet & Trailer Controls */}
          <div className="flex flex-col gap-1.5">
            <div className="bg-[#0c1320]/90 border border-slate-700/90 rounded px-3 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
              <div className="text-[10px] tracking-[0.2em] uppercase text-[#7dd3fc] font-bold">
                {hud.zoneName}
              </div>
              <div className="text-xs font-extrabold tracking-wider text-slate-100 mt-0.5 flex items-center gap-2">
                <span>{hud.vehicleName}</span>
                <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                  {hud.distanceKm.toFixed(2)} KM
                </span>
                {hud.activeTrailerName && (
                  <span className="text-[10px] font-bold text-sky-300 truncate max-w-[160px]">
                    · {hud.activeTrailerName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {VEHICLE_ORDER.map((id) => {
                const active = id === hud.vehicleId;
                const label =
                  id === 'auman_8x4'
                    ? '8x4 Tractor'
                    : id === 'sport_coupe'
                      ? 'Coupe'
                      : id === 'city_bus'
                        ? 'Bus'
                        : 'Box Truck';
                return (
                  <button
                    key={id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSwitchVehicle(id);
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#0284c7] border-[#7dd3fc] text-white'
                        : 'bg-[#0c1320]/85 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setOpenMenu((v) => (v === 'bays' ? null : 'bays'));
                }}
                className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border bg-[#0c1320]/85 border-amber-500/60 text-amber-300 hover:border-amber-400 cursor-pointer"
              >
                Bays {hud.baysCompleted.length}/{PARKING_BAYS.length}
              </button>

              {hud.trailerSupported && (
                <>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="hud-trailer-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onToggleTrailer();
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                      hud.nearbyHookableTrailer
                        ? 'bg-emerald-900/90 border-emerald-400 text-emerald-100'
                        : hud.trailerAttached
                          ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                          : 'bg-[#0c1320]/85 border-amber-500/70 text-amber-300 hover:border-amber-400'
                    }`}
                  >
                    {hud.nearbyHookableTrailer
                      ? 'Hook Trailer [T]'
                      : hud.trailerAttached
                        ? 'Drop Trailer [T]'
                        : 'Hook Trailer [T]'}
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="hud-custom-trailer-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setOpenMenu((v) => (v === 'trailer' ? null : 'trailer'));
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${
                      openMenu === 'trailer'
                        ? 'bg-sky-700 border-sky-300 text-white'
                        : 'bg-[#0c1320]/85 border-slate-600 text-slate-200 hover:border-sky-400'
                    }`}
                  >
                    Custom Trailer
                  </button>
                </>
              )}
            </div>

            {openMenu === 'bays' && (
              <div className="bg-[#0c1320]/95 border border-slate-700 rounded p-2 flex flex-col gap-1 w-72 shadow-xl">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-1 flex justify-between">
                  <span>Freight Bays &amp; Docks</span>
                  <span className="text-emerald-400">{hud.trailersDeliveredCount} Delivered</span>
                </div>
                {PARKING_BAYS.map((bay) => {
                  const done = hud.baysCompleted.includes(bay.id);
                  return (
                    <button
                      key={bay.id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setOpenMenu(null);
                        onTeleportBay(bay.id);
                      }}
                      className="text-left px-2 py-1.5 rounded text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-100 flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{bay.name}</span>
                      <span className={`text-[10px] font-bold ${done ? 'text-emerald-400' : 'text-sky-400'}`}>
                        {done ? 'DONE' : bay.difficulty}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {openMenu === 'trailer' && (
              <div
                data-testid="custom-trailer-panel"
                className="bg-[#0c1320]/95 border border-sky-500/60 rounded p-2.5 flex flex-col gap-2 w-72 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-sky-300 font-bold">
                    Custom Trailer Builder
                  </span>
                  <span className="text-[9px] text-slate-400 uppercase">
                    {hud.trailerAttached ? 'Live Coupled' : 'Stages in Bay #1'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {TRAILER_VARIANTS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        pickedVariantRef.current = v.id;
                        setPickedVariant(v.id);
                        onCustomizeTrailer(v.id, pickedLiveryRef.current);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${
                        pickedVariant === v.id
                          ? 'bg-[#0284c7] border-sky-300 text-white'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {TRAILER_LIVERIES.map((liv) => (
                    <button
                      key={liv.id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        pickedLiveryRef.current = liv.id;
                        setPickedLivery(liv.id);
                        onCustomizeTrailer(pickedVariantRef.current, liv.id);
                      }}
                      className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold uppercase border flex items-center justify-center gap-1 cursor-pointer ${
                        pickedLivery === liv.id
                          ? 'bg-slate-700 border-sky-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: liv.swatch }} />
                      {liv.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top-Right: Compact Utility Icon Cluster + Custom View Tuner */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-camera-btn"
              aria-label={`Camera: ${CAMERA_LABELS[hud.cameraMode]}`}
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCamera();
              }}
              className="h-9 px-2.5 rounded bg-[#0c1320]/90 border border-slate-700/90 text-slate-200 hover:border-sky-400 flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
              <span>{CAMERA_LABELS[hud.cameraMode]} [V]</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-custom-view-btn"
              aria-label="Custom View Camera"
              onClick={(e) => {
                e.currentTarget.blur();
                onSetCameraMode(hud.cameraMode === 'custom' ? 'chase' : 'custom');
              }}
              className={`h-9 px-2.5 rounded border text-[11px] font-bold tracking-wider uppercase cursor-pointer ${
                hud.cameraMode === 'custom'
                  ? 'bg-[#0284c7] border-sky-300 text-white'
                  : 'bg-[#0c1320]/90 border-slate-700/90 text-slate-300 hover:border-sky-400'
              }`}
            >
              Custom View
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Toggle Headlights [L]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleLights();
              }}
              className={`w-9 h-9 rounded border flex items-center justify-center cursor-pointer ${
                hud.headlightsOn
                  ? 'bg-sky-950/90 border-sky-400 text-sky-300'
                  : 'bg-[#0c1320]/90 border-slate-700 text-slate-400'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Air Horn [H]"
              onClick={(e) => {
                e.currentTarget.blur();
                onHonk();
              }}
              className="w-9 h-9 rounded bg-[#0c1320]/90 border border-slate-700/90 text-slate-200 hover:border-amber-400 flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className={`w-9 h-9 rounded border flex items-center justify-center cursor-pointer ${
                muted
                  ? 'bg-[#0c1320]/90 border-rose-500/70 text-rose-400'
                  : 'bg-[#0c1320]/90 border-slate-700/90 text-slate-200 hover:border-sky-400'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {muted ? (
                  <path d="M23 9l-6 6M17 9l6 6" />
                ) : (
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Reset Vehicle to Depot"
              onClick={(e) => {
                e.currentTarget.blur();
                onResetVehicle();
              }}
              className="w-9 h-9 rounded bg-[#0c1320]/90 border border-slate-700/90 text-slate-200 hover:border-amber-400 flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Simulation [Esc]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-9 h-9 rounded bg-[#0c1320]/90 border border-slate-700/90 text-slate-200 hover:border-sky-400 flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>
          </div>

          {/* Custom View Camera Controls (appears only when Custom View is active!) */}
          {hud.cameraMode === 'custom' && (
            <div
              data-testid="custom-view-panel"
              className="w-64 bg-[#0c1320]/92 border border-sky-500/60 rounded p-2.5 shadow-xl flex flex-col gap-2 text-xs text-slate-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300">
                  Custom View Tuner
                </span>
                <span className="text-[9px] text-slate-400">Drag / Wheel</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {CUSTOM_CAM_PRESETS.map((pr) => (
                  <button
                    key={pr.label}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onCustomCameraChange(pr.settings);
                    }}
                    className="px-2 py-1 rounded bg-slate-800/85 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-200 cursor-pointer"
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-0.5 text-[10px] text-slate-300 font-semibold">
                <div className="flex justify-between">
                  <span>Distance</span>
                  <span className="tabular-nums text-sky-300">{customCamera.distance.toFixed(1)}m</span>
                </div>
                <input
                  type="range"
                  min={5.5}
                  max={34}
                  step={0.5}
                  value={customCamera.distance}
                  onChange={(e) =>
                    onCustomCameraChange({ ...customCamera, distance: Number(e.target.value) })
                  }
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-slate-300 font-semibold">
                <div className="flex justify-between">
                  <span>Height</span>
                  <span className="tabular-nums text-sky-300">{customCamera.height.toFixed(1)}m</span>
                </div>
                <input
                  type="range"
                  min={1.2}
                  max={16}
                  step={0.2}
                  value={customCamera.height}
                  onChange={(e) =>
                    onCustomCameraChange({ ...customCamera, height: Number(e.target.value) })
                  }
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-slate-300 font-semibold">
                <div className="flex justify-between">
                  <span>Angle</span>
                  <span className="tabular-nums text-sky-300">{customCamera.yawDeg}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={2}
                  value={customCamera.yawDeg}
                  onChange={(e) =>
                    onCustomCameraChange({ ...customCamera, yawDeg: Number(e.target.value) })
                  }
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* HIGH-VISIBILITY CONTROL LEGEND */}
      <div className="pointer-events-none fixed bottom-28 left-1/2 -translate-x-1/2 z-20">
        <div className="rounded-full border border-sky-400/40 bg-slate-950/75 px-4 py-2 text-center text-[10px] md:text-xs font-extrabold tracking-[0.16em] text-white uppercase shadow-[0_12px_28px_rgba(2,6,23,0.7)] backdrop-blur-sm">
          W/S Throttle · A/D Steer · Q/E Shift · C Clutch · Space Handbrake · T Trailer · V Camera · Tab Vehicle · Esc Pause
        </div>
      </div>

      {/* BOTTOM PERIMETER ROW */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Speedometer, RPM & Clutch */}
        <div className="pointer-events-auto bg-[#0c1320]/90 border border-slate-700/90 rounded-lg px-4 py-3 shadow-[0_8px_26px_rgba(0,0,0,0.7)] flex items-center gap-4">
          <div className="relative w-[112px] h-[86px] flex items-center justify-center">
            <svg viewBox="0 0 120 92" className="w-full h-full">
              <path
                d="M 16 78 A 48 48 0 1 1 104 78"
                fill="none"
                stroke="#1e293b"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <path
                d="M 96 34 A 48 48 0 0 1 104 78"
                fill="none"
                stroke="#7f1d1d"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <path
                d="M 16 78 A 48 48 0 1 1 104 78"
                fill="none"
                stroke={isRedline ? '#ef4444' : '#38bdf8'}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={arcLen}
                strokeDashoffset={rpmStrokeOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-3">
              <span
                data-testid="hud-speed"
                className="text-3xl font-black text-white tabular-nums leading-none tracking-tight"
              >
                {hud.speedKmh}
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-bold mt-0.5">
                KM/H
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 min-w-[118px]">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-bold">RPM</span>
              <span
                data-testid="hud-rpm"
                className={`text-sm font-extrabold tabular-nums ${isRedline ? 'text-rose-400' : 'text-sky-300'}`}
              >
                {hud.rpm}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                <span>CLUTCH [C]</span>
                <span>{Math.round(hud.clutch * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-75"
                  style={{ width: `${Math.round(hud.clutch * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleHandbrake();
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border cursor-pointer ${
                  hud.handbrake
                    ? 'bg-rose-950/90 border-rose-500 text-rose-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400'
                }`}
              >
                PARK [SPACE]
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleAutoClutch();
                }}
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-slate-800/80 border-slate-700 text-slate-300 hover:border-sky-400 cursor-pointer"
              >
                {hud.autoClutch ? 'AUTO-CLUTCH' : 'FULL CLUTCH'}
              </button>
            </div>

            {hud.stalled && (
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                STALLED · PRESS [I] OR [C]
              </div>
            )}
          </div>
        </div>

        {/* Bottom-Center: Parking & Freight Bay Proximity */}
        {showParkingPanel && parking.nearestBay && (
          <div className="pointer-events-none bg-[#0c1320]/92 border border-sky-500/60 rounded-lg px-4 py-2.5 shadow-xl flex flex-col items-center gap-1 min-w-[260px]">
            <div className="flex items-center justify-between w-full gap-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">
                {parking.nearestBay.name}
              </span>
              <span
                className={`text-xs font-extrabold tabular-nums ${
                  parking.isParkedCleanly
                    ? 'text-emerald-400'
                    : parking.isInside
                      ? 'text-amber-300'
                      : 'text-slate-200'
                }`}
              >
                {parking.alignmentPct}% ALIGN
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  parking.isParkedCleanly ? 'bg-emerald-400' : parking.isInside ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ width: `${parking.alignmentPct}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-300 tracking-wide">
              {parking.isParkedCleanly
                ? hud.trailerAttached
                  ? 'LOCKED CLEANLY — PRESS [T] TO DROP TRAILER OR HOLD'
                  : 'LOCKED CLEANLY — HOLD POSITION'
                : parking.isInside
                  ? hud.trailerAttached
                    ? 'INSIDE BAY — PRESS [T] TO DROP TRAILER OR BRAKE'
                    : 'INSIDE BAY — ENGAGE PARK [SPACE] OR BRAKE'
                  : parking.nearestBay.hint}
            </div>
          </div>
        )}

        {/* Bottom-Right: Manual Gearbox */}
        <div className="pointer-events-auto bg-[#0c1320]/90 border border-slate-700/90 rounded-lg px-3.5 py-2.5 shadow-[0_8px_26px_rgba(0,0,0,0.7)] flex items-center gap-3">
          <div className="flex flex-col items-center justify-center min-w-[46px]">
            <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-bold">GEAR</span>
            <span
              data-testid="hud-gear"
              className={`text-4xl font-black tabular-nums leading-none mt-0.5 ${
                hud.gear === 'R'
                  ? 'text-amber-400'
                  : hud.gear === 'N'
                    ? 'text-slate-300'
                    : 'text-[#38bdf8]'
              }`}
            >
              {hud.gear}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-4 gap-1">
              {GEARS.map((g) => {
                const active = hud.gear === g;
                return (
                  <button
                    key={String(g)}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSetGear(g);
                    }}
                    className={`w-7 h-7 rounded text-xs font-extrabold border cursor-pointer transition-colors ${
                      active
                        ? g === 'R'
                          ? 'bg-amber-500 border-amber-300 text-slate-950'
                          : 'bg-[#0284c7] border-[#7dd3fc] text-white'
                        : 'bg-slate-800/85 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onShiftDown();
                }}
                className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-bold uppercase tracking-wider text-slate-200 cursor-pointer"
              >
                [Q] Down
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onShiftUp();
                }}
                className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-bold uppercase tracking-wider text-slate-200 cursor-pointer"
              >
                [E] Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
