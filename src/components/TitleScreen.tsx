import type { VehicleId } from '../sim/types';
import { VEHICLE_ORDER, VEHICLE_SPECS } from '../sim/vehicles';

interface TitleScreenProps {
  selectedVehicle: VehicleId;
  onSelectVehicle: (id: VehicleId) => void;
  onStart: () => void;
}

export function TitleScreen({ selectedVehicle, onSelectVehicle, onStart }: TitleScreenProps) {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-12 select-none">
      {/* Left 38% Negative-Space Title Lockup & Controls */}
      <div className="max-w-md pointer-events-auto flex flex-col gap-6 mt-4 md:mt-10 p-4 md:p-5 rounded-2xl border border-sky-400/20 bg-slate-950/25 backdrop-blur-md shadow-[0_25px_80px_rgba(2,6,23,0.72)]">
        {/* Bespoke Inline SVG Emblem & Title Lockup */}
        <div className="flex flex-col gap-2">
          <svg
            viewBox="0 0 470 128"
            className="w-full max-w-[430px] h-auto drop-shadow-[0_6px_24px_rgba(0,0,0,0.75)]"
            aria-label="Auman Free Roam"
          >
            {/* Diamond Foton-inspired Grille Crest */}
            <polygon
              points="36,14 62,38 36,62 10,38"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            <polygon points="36,23 50,38 36,53 22,38" fill="#38bdf8" fillOpacity="0.22" stroke="#bae6fd" strokeWidth="1.5" />
            <path d="M28 38 L36 28 L44 38 L36 48 Z" fill="#e0f2fe" />

            {/* Crowned Lion / Heavy Transport Wing Bars */}
            <line x1="74" y1="24" x2="210" y2="24" stroke="#38bdf8" strokeWidth="2" />
            <line x1="74" y1="29" x2="156" y2="29" stroke="#f59e0b" strokeWidth="1.5" />

            <text
              x="74"
              y="55"
              fill="#f1f5f9"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              fontSize="30"
              letterSpacing="3.5"
            >
              AUMAN GALAXY
            </text>
            <text
              x="12"
              y="95"
              fill="#7dd3fc"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="800"
              fontSize="24"
              letterSpacing="4.5"
            >
              FREE ROAM SIM
            </text>
            <text
              x="14"
              y="118"
              fill="#cbd5e1"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
              fontSize="11"
              letterSpacing="1.8"
            >
              8x4 TRACTOR · MANUAL GEARBOX · MIXED TRAFFIC
            </text>
          </svg>
        </div>

        {/* Vehicle Selection Row */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-300/90">
            Select Starting Vehicle
          </span>
          <div className="grid grid-cols-2 gap-2">
            {VEHICLE_ORDER.map((id) => {
              const spec = VEHICLE_SPECS[id];
              const active = id === selectedVehicle;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectVehicle(id);
                  }}
                  className={`text-left px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(15,23,42,0.9))] border-[#67e8f9] text-slate-100 shadow-[0_0_0_1px_rgba(103,232,249,0.35),0_12px_26px_rgba(14,165,233,0.18)]'
                      : 'bg-[#0f172a]/65 border-slate-700/80 text-slate-300 hover:border-sky-400/60 hover:text-white hover:shadow-[0_8px_20px_rgba(15,23,42,0.45)]'
                  }`}
                >
                  <div className="text-xs font-bold tracking-wider uppercase">{spec.name}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{spec.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Start CTA */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="px-7 py-3.5 rounded-xl bg-[linear-gradient(135deg,#0284c7,#0ea5e9,#38bdf8)] hover:brightness-110 active:translate-y-[1px] text-white font-extrabold tracking-[0.18em] text-sm uppercase shadow-[0_14px_34px_rgba(14,165,233,0.42)] border border-[#7dd3fc]/60 transition-all duration-200 cursor-pointer"
          >
            Ignite Engine
          </button>
          <span className="text-xs text-slate-300/80 tracking-wider uppercase font-medium">
            Press Enter or Space
          </span>
        </div>
      </div>

      {/* High-contrast control legend */}
      <div className="pointer-events-none w-full flex justify-center">
        <div className="mx-auto rounded-full border border-sky-400/40 bg-slate-950/60 px-4 py-2 text-center text-[10px] md:text-xs font-bold tracking-[0.14em] text-slate-100 uppercase shadow-[0_10px_24px_rgba(2,6,23,0.7)] backdrop-blur-sm">
          W/S Throttle &amp; Brake · A/D Steer · Q/E Shift Gear · C Clutch · Space Handbrake · T Trailer · V Camera · Tab Vehicle · Esc Pause
        </div>
      </div>
    </div>
  );
}
