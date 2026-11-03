import React, { useEffect, useState } from 'react';
import {
  Rocket,
  Shield,
  Gauge,
  Compass,
  Crosshair,
  Zap,
  Volume2,
  X,
  Radio,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { FlightTelemetry } from '../three/CosmicScene';
import { CelestialBody } from '../data/celestialData';

interface StarshipCockpitOverlayProps {
  telemetry: FlightTelemetry | null;
  availableBodies: CelestialBody[];
  selectedBody: CelestialBody | null;
  onSelectTarget: (bodyId: string) => void;
  onSetThrottle: (val: number) => void;
  onEngageHyperdrive: (bodyId?: string) => void;
  onExitCockpit: () => void;
  onSteer: (pitchDelta: number, yawDelta: number) => void;
}

export const StarshipCockpitOverlay: React.FC<StarshipCockpitOverlayProps> = ({
  telemetry,
  availableBodies,
  selectedBody,
  onSelectTarget,
  onSetThrottle,
  onEngageHyperdrive,
  onExitCockpit,
  onSteer,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Handle steering with mouse drag on the windshield
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on canvas background, not on buttons
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - lastMousePos.x) * 0.003;
    const dy = (e.clientY - lastMousePos.y) * 0.003;
    onSteer(dy, dx);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Keyboard flight hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        onExitCockpit();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onEngageHyperdrive();
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        onSetThrottle(Math.min(1.0, (telemetry?.throttle ?? 0) + 0.15));
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        onSetThrottle(Math.max(0.0, (telemetry?.throttle ?? 0) - 0.15));
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        onSteer(0, -0.08);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        onSteer(0, 0.08);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [telemetry?.throttle, onExitCockpit, onEngageHyperdrive, onSetThrottle, onSteer]);

  if (!telemetry || !telemetry.inCockpit) return null;

  const targetScreen = telemetry.targetScreenPos;
  const currentSpeed = telemetry.speedKmS;
  const isWarping = telemetry.isWarping;
  const throttlePercent = Math.round(telemetry.throttle * 100);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="fixed inset-0 z-40 pointer-events-auto select-none overflow-hidden cursor-crosshair"
    >
      {/* 1. Cockpit Canopy Glass Tint & Hexagonal Energy Grid */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-cyan-950/20 via-transparent to-slate-950/40" />

      {/* 2. Aerospace Cockpit Canopy Frame Structure (SVG Ribs & Windshield Struts) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 1000 700"
      >
        <defs>
          <linearGradient id="canopyMetal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="glowBorder" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Top Canopy Arch */}
        <polygon
          points="0,0 1000,0 920,55 500,75 80,55"
          fill="url(#canopyMetal)"
          stroke="url(#glowBorder)"
          strokeWidth="1.5"
        />

        {/* Left Canopy Mullion Pillar */}
        <polygon
          points="0,0 90,60 170,280 210,540 140,700 0,700"
          fill="url(#canopyMetal)"
          stroke="url(#glowBorder)"
          strokeWidth="1.5"
        />

        {/* Right Canopy Mullion Pillar */}
        <polygon
          points="1000,0 910,60 830,280 790,540 860,700 1000,700"
          fill="url(#canopyMetal)"
          stroke="url(#glowBorder)"
          strokeWidth="1.5"
        />

        {/* Center Diagonal Support Struts */}
        <line x1="500" y1="75" x2="210" y2="540" stroke="#1e293b" strokeWidth="4" />
        <line x1="500" y1="75" x2="210" y2="540" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />

        <line x1="500" y1="75" x2="790" y2="540" stroke="#1e293b" strokeWidth="4" />
        <line x1="500" y1="75" x2="790" y2="540" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />

        {/* Bottom Instrument Dashboard Sill */}
        <polygon
          points="140,680 250,580 750,580 860,680 1000,700 0,700"
          fill="url(#canopyMetal)"
          stroke="url(#glowBorder)"
          strokeWidth="2"
        />
      </svg>

      {/* 3. Top Flight Status Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/95 border border-cyan-500/40 px-5 py-2 rounded-xl shadow-2xl text-xs font-mono text-cyan-300">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white tracking-wider">SSV COSMOSCOPE</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">CLASS-IV SCIENCE CRUISER</span>
        </div>
        <div className="h-3 w-px bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">STATUS:</span>
          <span
            className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
              isWarping
                ? 'bg-purple-950 text-purple-300 border border-purple-500 font-bold'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
            }`}
          >
            {isWarping ? 'WARP TRANSIT (F.T.L.)' : 'SUB-LIGHT CRUISE'}
          </span>
        </div>
        <div className="h-3 w-px bg-slate-700" />
        <button
          onClick={onExitCockpit}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer border border-slate-700"
          title="Exit to Orbital Observer View (ESC)"
        >
          <X className="w-3.5 h-3.5 text-slate-400" />
          <span>Exit Cockpit [ESC]</span>
        </button>
      </div>

      {/* 4. Target Lock Bracket (Pinned directly over the 3D Planet in viewport) */}
      {targetScreen.visible && (
        <div
          className="absolute pointer-events-none transition-all duration-75 ease-out"
          style={{
            left: `${targetScreen.x}%`,
            top: `${targetScreen.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Target Reticle Bracket */}
          <div className="relative w-28 h-28 border border-cyan-400/40 rounded-full flex items-center justify-center">
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

            <Crosshair className="w-6 h-6 text-cyan-400/80 animate-spin" style={{ animationDuration: '18s' }} />

            {/* Target Data Tag */}
            <div className="absolute left-32 top-1 bg-slate-950/90 border border-cyan-500/50 rounded-lg p-2 font-mono text-[11px] whitespace-nowrap shadow-xl">
              <div className="flex items-center gap-1 text-cyan-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>LOCKED: {telemetry.targetBodyName.toUpperCase()}</span>
              </div>
              <div className="text-slate-300 mt-1">
                DIST: <span className="text-white font-semibold">{telemetry.distanceToTargetAU} AU</span>
              </div>
              <div className="text-slate-400 text-[10px]">
                {telemetry.distanceKm.toLocaleString()} KM
              </div>
              <div className="text-emerald-400 font-semibold mt-0.5">
                SPEED: {currentSpeed.toLocaleString()} KM/S
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Center Pitch & Roll Ladder (Pilot Crosshair) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center opacity-75">
        <div className="w-16 h-px bg-cyan-400/60 mb-2" />
        <div className="flex items-center gap-4">
          <div className="w-8 h-px bg-cyan-400" />
          <div className="w-4 h-4 border border-cyan-400/80 rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-cyan-300 rounded-full" />
          </div>
          <div className="w-8 h-px bg-cyan-400" />
        </div>
        <div className="w-16 h-px bg-cyan-400/60 mt-2" />
        <span className="text-[10px] font-mono text-cyan-300/80 mt-1">
          HDG: {telemetry.headingDeg}° | FOV: {telemetry.cockpitFov}°
        </span>
      </div>

      {/* 6. Left Instrument Console: Thruster & Flight Dynamics */}
      <div className="absolute left-6 bottom-16 z-10 w-64 bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl p-4 font-mono text-xs flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-cyan-400 font-bold flex items-center gap-1.5">
            <Gauge className="w-4 h-4" />
            PROPULSION CORE
          </span>
          <span className="text-slate-400 text-[11px]">THROTTLE: {throttlePercent}%</span>
        </div>

        {/* Throttle Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>OFF</span>
            <span>CRUISE</span>
            <span>BOOST</span>
            <span>MAX</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={telemetry.throttle}
            onChange={(e) => onSetThrottle(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex gap-1 pt-1">
            <button
              onClick={() => onSetThrottle(0)}
              className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors cursor-pointer"
            >
              STOP [0%]
            </button>
            <button
              onClick={() => onSetThrottle(0.35)}
              className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors cursor-pointer"
            >
              CRUISE [35%]
            </button>
            <button
              onClick={() => onSetThrottle(1.0)}
              className="flex-1 py-1 bg-cyan-900/60 hover:bg-cyan-800/80 text-cyan-200 rounded text-[10px] transition-colors cursor-pointer"
            >
              MAX [100%]
            </button>
          </div>
        </div>

        {/* Velocity Telemetry */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>VELOCITY:</span>
            <span className="text-white font-bold">{currentSpeed.toLocaleString()} km/s</span>
          </div>
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>IMPULSE VECTOR:</span>
            <span className="text-emerald-400 font-semibold">SUB-LIGHT RELATIVISTIC</span>
          </div>
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>DEFLECTOR SHIELDS:</span>
            <span className="text-cyan-400 font-semibold flex items-center gap-1">
              <Shield className="w-3 h-3 text-cyan-400" /> 100% NOMINAL
            </span>
          </div>
        </div>

        {/* Flight controls hint */}
        <div className="text-[10px] text-slate-400 leading-tight">
          DRAG MOUSE: Pitch/Yaw Steer
          <br />
          KEYS: [W/S] Throttle | [SPACE] Warp
        </div>
      </div>

      {/* 7. Right Instrument Console: Navigation & Tactical Flight Computer */}
      <div className="absolute right-6 bottom-16 z-10 w-72 bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl p-4 font-mono text-xs flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-amber-400 font-bold flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            FLIGHT COMPUTER
          </span>
          <span className="text-slate-400 text-[11px]">AUTONAV</span>
        </div>

        {/* Target Body Selector */}
        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">NAVIGATION TARGET:</label>
          <select
            value={selectedBody?.id || ''}
            onChange={(e) => onSelectTarget(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {availableBodies.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.type})
              </option>
            ))}
          </select>
        </div>

        {/* Hyperdrive Action Button */}
        <button
          onClick={() => onEngageHyperdrive()}
          disabled={isWarping}
          className={`w-full py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-all shadow-lg cursor-pointer ${
            isWarping
              ? 'bg-purple-600 text-white animate-pulse'
              : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-cyan-500/20 active:scale-95'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>{isWarping ? 'WARP DRIVE ENGAGED...' : 'ENGAGE HYPERDRIVE WARP'}</span>
        </button>

        {/* Tactical Advisory from Gemini Flight Core */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px]">
          <div className="flex items-center gap-1.5 text-indigo-400 font-bold mb-1">
            <Radio className="w-3.5 h-3.5" />
            <span>COSMOS FLIGHT ADVISORY</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {selectedBody
              ? `${selectedBody.name}: ${selectedBody.tagline}`
              : 'Select a celestial destination to plot orbital flight trajectory.'}
          </p>
        </div>
      </div>

      {/* 8. Bottom Dashboard Center Pedestal Pill */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/95 border border-slate-700/80 px-6 py-2 rounded-2xl shadow-2xl font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold">RADAR LOCK:</span>
          <span className="text-white font-semibold">{telemetry.targetBodyName}</span>
        </div>
        <div className="h-3 w-px bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-slate-400">RANGE:</span>
          <span className="text-emerald-400 font-bold">{telemetry.distanceToTargetAU} AU</span>
        </div>
        <div className="h-3 w-px bg-slate-700" />
        <button
          onClick={onExitCockpit}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
        >
          Return to Orbit View
        </button>
      </div>
    </div>
  );
};
