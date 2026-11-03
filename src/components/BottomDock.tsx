import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Layers,
  RotateCcw,
  Sparkles,
  Rocket,
  Clock,
  Calendar,
  Radio,
  Globe,
} from 'lucide-react';
import { CelestialBody } from '../data/celestialData';
import { EphemerisTimeData } from '../three/CosmicScene';

interface BottomDockProps {
  availableBodies: CelestialBody[];
  selectedBody: CelestialBody | null;
  onSelectBody: (bodyId: string) => void;
  onResetView: () => void;
  timeMultiplier: number;
  onSetTimeMultiplier: (val: number) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  isOrreryScale: boolean;
  onToggleOrreryScale: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  currentAudioHz: number;
  onOpenSpeculativeModal: () => void;
  isCockpitMode: boolean;
  onToggleCockpitMode: () => void;
  ephemerisData?: EphemerisTimeData;
  onToggleLiveEphemeris?: (isLive: boolean) => void;
  onJumpToPreset?: (preset: string) => void;
  onStepDays?: (days: number) => void;
  nasaExoplanetsCount?: number;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  availableBodies,
  selectedBody,
  onSelectBody,
  onResetView,
  timeMultiplier,
  onSetTimeMultiplier,
  isPaused,
  onTogglePause,
  isOrreryScale,
  onToggleOrreryScale,
  isAudioMuted,
  onToggleAudio,
  currentAudioHz,
  onOpenSpeculativeModal,
  isCockpitMode,
  onToggleCockpitMode,
  ephemerisData,
  onToggleLiveEphemeris,
  onJumpToPreset,
  onStepDays,
  nasaExoplanetsCount = 7,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'bodies' | 'time' | 'view' | 'audio'>('bodies');

  // Keyboard shortcut 'H' to toggle dock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className={`fixed z-30 transition-transform duration-300 ease-out left-1/2 -translate-x-1/2 flex flex-col items-center ${
        isCollapsed ? 'bottom-2 translate-y-[calc(100%-36px)]' : 'bottom-5 translate-y-0'
      }`}
      style={{ maxWidth: 'min(940px, 94vw)', width: '100%' }}
    >
      {/* Collapse/Expand Handle Pill */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-t-lg text-xs font-mono tracking-wider cursor-pointer shadow-md mb-[-1px] transition-colors"
        title="Toggle Cinema Mode (Press 'H')"
      >
        {isCollapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Show Dock [H]</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hide Dock [H]</span>
          </>
        )}
      </button>

      {/* Main Solid Dock Surface */}
      <div className="w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5">
        {/* Dock Header Tabs & Controls */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          {/* Tab Selector Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('bodies')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'bodies'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Celestial Catalog ({availableBodies.length})
            </button>
            <button
              onClick={() => setActiveTab('time')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'time'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>NASA Ephemeris ({ephemerisData?.isLive ? 'Live' : `${timeMultiplier}x`})</span>
            </button>
            <button
              onClick={() => setActiveTab('view')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'view'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Display Scale
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'audio'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {!isAudioMuted ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              Cosmic Audio
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleCockpitMode}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-md ${
                isCockpitMode
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 ring-2 ring-cyan-400/50'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-cyan-300 hover:text-white border-cyan-500/40'
              }`}
              title="Toggle Starship Cockpit Pilot View (1st-person perspective navigation)"
            >
              <Rocket className="w-3.5 h-3.5 text-cyan-300" />
              <span>{isCockpitMode ? 'Cockpit Active' : 'Pilot View'}</span>
            </button>
            <button
              onClick={onResetView}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
              title="Overview of all celestial orbits"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              Reset View
            </button>
            <button
              onClick={onOpenSpeculativeModal}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/60 rounded-lg border border-amber-600/50 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              New World
            </button>
          </div>
        </div>

        {/* Tab Content 1: Celestial Bodies Quick Jump Carousel */}
        {activeTab === 'bodies' && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-slate-700">
            {availableBodies.map((body) => {
              const isSelected = selectedBody?.id === body.id;
              return (
                <button
                  key={body.id}
                  onClick={() => onSelectBody(body.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer font-medium border ${
                    isSelected
                      ? 'bg-indigo-600/90 text-white border-indigo-400 shadow-md ring-1 ring-indigo-400/50'
                      : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30"
                    style={{ backgroundColor: body.surfaceColorHex }}
                  />
                  <span>{body.name}</span>
                  {body.type === 'Star' && (
                    <span className="text-[10px] text-amber-400 font-mono">STAR</span>
                  )}
                  {body.hasRings && (
                    <span className="text-[10px] text-indigo-300 font-mono">RINGS</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab Content 2: NASA Ephemeris & Keplerian Time Controller */}
        {activeTab === 'time' && (
          <div className="flex flex-col gap-2.5 py-1">
            {/* Row 1: Ephemeris Clock Readout & Playback */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              {/* Date & Julian Date Readout */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggleLiveEphemeris?.(!ephemerisData?.isLive)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer border ${
                    ephemerisData?.isLive
                      ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-400/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
                  }`}
                  title="Toggle real-world live NASA clock synchronization"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      ephemerisData?.isLive ? 'bg-emerald-300' : 'bg-amber-400'
                    }`}
                  />
                  <span>{ephemerisData?.isLive ? 'LIVE NASA SYNC' : 'SCRUBBING'}</span>
                </button>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white tracking-wider">
                      {ephemerisData?.calendarDate
                        ? ephemerisData.calendarDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Current Epoch'}
                    </span>
                    <span className="text-xs font-mono text-cyan-300">
                      {ephemerisData?.calendarDate
                        ? ephemerisData.calendarDate.toLocaleTimeString('en-US', {
                            timeZone: 'UTC',
                            hour12: false,
                          }) + ' UTC'
                        : ''}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    JD {ephemerisData?.julianDate ? ephemerisData.julianDate.toFixed(4) : '2451545.0000'}
                  </span>
                </div>
              </div>

              {/* Simulation Stepper & Multipliers */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onTogglePause}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isPaused
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700/80">
                  {[0.1, 1, 5, 25, 100].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => onSetTimeMultiplier(rate)}
                      className={`px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                        timeMultiplier === rate
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Historical / Future Presets & Quick Day Steppers */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Presets */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <span className="text-[11px] font-mono text-slate-400 mr-1 shrink-0">EPOCH:</span>
                {[
                  { label: 'Now', id: 'now' },
                  { label: 'Apollo 11 (1969)', id: 'apollo11' },
                  { label: 'Voyager 1 (1977)', id: 'voyager1' },
                  { label: 'New Horizons (2015)', id: 'new_horizons' },
                  { label: 'Conjunction (2020)', id: 'great_conjunction_2020' },
                  { label: 'Alignment (2030)', id: 'alignment_2030' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onJumpToPreset?.(preset.id)}
                    className="px-2 py-1 rounded-md text-[11px] bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Time Step Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onStepDays?.(-365.25)}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title="Rewind 1 Earth Year"
                >
                  -1y
                </button>
                <button
                  onClick={() => onStepDays?.(-30)}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title="Rewind 30 Days"
                >
                  -30d
                </button>
                <button
                  onClick={() => onStepDays?.(-1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title="Rewind 1 Day"
                >
                  -1d
                </button>
                <button
                  onClick={() => onStepDays?.(1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title="Advance 1 Day"
                >
                  +1d
                </button>
                <button
                  onClick={() => onStepDays?.(30)}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title="Advance 30 Days"
                >
                  +30d
                </button>
                <button
                  onClick={() => onStepDays?.(365.25)}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title="Advance 1 Earth Year"
                >
                  +1y
                </button>

                {/* NASA TAP indicator badge */}
                <div className="ml-2 hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-800/60 text-[10px] text-cyan-300 font-mono">
                  <Radio className="w-2.5 h-2.5 text-cyan-400" />
                  <span>NASA TAP Archive: {nasaExoplanetsCount} Live</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 3: Display Scale */}
        {activeTab === 'view' && (
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-slate-300">
                {isOrreryScale
                  ? 'Orrery View (Exaggerated planet scales for easy selection and inspection)'
                  : 'Proportional Scale (Realistic relative astronomical sizes)'}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => !isOrreryScale && onToggleOrreryScale()}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  isOrreryScale ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Orrery Scale (Interactive)
              </button>
              <button
                onClick={() => isOrreryScale && onToggleOrreryScale()}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  !isOrreryScale ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Proportional Scale
              </button>
            </div>
          </div>
        )}

        {/* Tab Content 4: Cosmic Audio Synthesizer */}
        {activeTab === 'audio' && (
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleAudio}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  !isAudioMuted
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {!isAudioMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                {!isAudioMuted ? 'Mute Cosmic Audio' : 'Enable Cosmic Audio'}
              </button>
              <div className="flex flex-col">
                <span className="text-xs text-slate-300 font-mono">
                  Planetary Harmonic: {currentAudioHz.toFixed(1)} Hz
                </span>
                <span className="text-[11px] text-slate-500">
                  Synthesized live via Web Audio API oscillators (Zero external audio files)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                {!isAudioMuted ? 'BROADCASTING RESONANCE' : 'AUDIO MUTED'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
