import React, { useState } from 'react';
import { X, Sparkles, Wand2, Loader2, Compass, Layers, Globe } from 'lucide-react';

interface SpeculativeExoplanetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (spec: any) => void;
}

export const SpeculativeExoplanetModal: React.FC<SpeculativeExoplanetModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [concept, setConcept] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const presets = [
    'Hycean ocean world with crystal rings and deep methane steam storms',
    'Bioluminescent fungal super-Earth orbiting a crimson red dwarf',
    'Ultra-hot molten titanium planet with glowing lava fissures',
    'Cryogenic diamond world with supersonic liquid nitrogen geysers',
    'Carbon-rich iron world with pitch black regolith and emerald auroras',
  ];

  const handleSynthesize = async (promptText?: string) => {
    const finalConcept = (promptText || concept).trim();
    setIsSynthesizing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/gemini/create-exoplanet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userConcept: finalConcept }),
      });

      const data = await res.json();
      if (data.success && data.exoplanet) {
        onCreated(data.exoplanet);
        onClose();
      } else {
        setErrorMsg(data.error || 'Failed to synthesize exoplanet with Gemini. Please retry.');
      }
    } catch (err: any) {
      setErrorMsg('Network error while connecting to Gemini astrophysicist engine.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-950/70 border border-purple-600/50 text-purple-300">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Speculative Exoplanet Synthesizer
              </h2>
              <p className="text-[11px] text-slate-400">
                Powered by Gemini AI astrophysical modeling & Three.js procedural rendering
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Describe Your Speculative World
            </label>
            <textarea
              rows={3}
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="e.g. A hyper-dense ocean planet orbiting a binary star system with iridescent rings and lightning storms..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Inspirational Presets */}
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
              Or Select an Astrophysical Archetype:
            </span>
            <div className="space-y-1.5">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setConcept(preset);
                    handleSynthesize(preset);
                  }}
                  disabled={isSynthesizing}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-950/80 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-600/50 text-slate-300 hover:text-white transition-all text-xs flex items-center justify-between group cursor-pointer"
                >
                  <span>{preset}</span>
                  <Wand2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Model: Gemini 3.8 Flash
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSynthesizing}
              className="px-3 py-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSynthesize()}
              disabled={isSynthesizing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-lg transition-all cursor-pointer"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Synthesizing World...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Synthesize 3D World</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
