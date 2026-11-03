import React from 'react';
import { Globe, Sparkles, Orbit, Compass, RefreshCw } from 'lucide-react';

interface TopBarProps {
  activeCategory: 'solar' | 'exoplanet' | 'custom';
  onSelectCategory: (category: 'solar' | 'exoplanet' | 'custom') => void;
  selectedBodyName: string | null;
  onResetView: () => void;
  onOpenSpeculativeModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeCategory,
  onSelectCategory,
  selectedBodyName,
  onResetView,
  onOpenSpeculativeModal,
}) => {
  return (
    <header className="fixed top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
      {/* Brand & Mode Switcher */}
      <div className="flex items-center gap-3 bg-slate-900/90 text-slate-100 border border-slate-700/80 rounded-xl px-4 py-2.5 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-2.5 pr-3 border-r border-slate-700/80">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
            <Orbit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white leading-tight">CosmoScope 3D</h1>
            <p className="text-[11px] text-slate-400 font-mono">AI Solar System & Exoplanet Explorer</p>
          </div>
        </div>

        {/* Category Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => onSelectCategory('solar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'solar'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Solar System
          </button>
          <button
            onClick={() => onSelectCategory('exoplanet')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'exoplanet'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Exoplanets
          </button>
          <button
            onClick={() => onSelectCategory('custom')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'custom'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Speculative Lab
          </button>
        </div>

        {/* Target Body Status Badge */}
        {selectedBodyName ? (
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-700/80">
            <span className="text-[11px] text-slate-400 font-mono">TARGET:</span>
            <span className="text-xs font-semibold text-emerald-400 font-mono">{selectedBodyName}</span>
            <button
              onClick={onResetView}
              title="Return to System Overview"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-700/80">
            <span className="text-[11px] text-slate-400 font-mono">VIEW:</span>
            <span className="text-xs text-slate-300 font-mono">Orbital Overview</span>
          </div>
        )}
      </div>

      {/* Top-Right: Synthesize Speculative World CTA */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onOpenSpeculativeModal}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-indigo-400/40 shadow-xl transition-all hover:shadow-indigo-500/25 active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Synthesize World with Gemini</span>
        </button>
      </div>
    </header>
  );
};
