import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Thermometer,
  Compass,
  Gauge,
  Send,
  Loader2,
  HelpCircle,
  Radio,
  ChevronRight,
  RefreshCw,
  Atom,
  Flame,
  Volume2,
} from 'lucide-react';
import { CelestialBody } from '../data/celestialData';

interface GeminiLoreData {
  overview: string;
  surfaceConditions: string;
  atmosphereAndClimate: string;
  scientificMysteries: string[];
  expeditionLog: string;
  habitabilityVerdict: string;
  funFact: string;
}

// Client-side cache to eliminate redundant API requests
const clientLoreCache = new Map<string, GeminiLoreData>();

interface ChatMessage {
  role: 'user' | 'gemini';
  text: string;
}

interface PlanetaryDossierProps {
  body: CelestialBody | null;
  onClose: () => void;
  onPlayPlanetarySound: (hz: number) => void;
}

export const PlanetaryDossier: React.FC<PlanetaryDossierProps> = ({
  body,
  onClose,
  onPlayPlanetarySound,
}) => {
  const [loreData, setLoreData] = useState<GeminiLoreData | null>(null);
  const [isLoadingLore, setIsLoadingLore] = useState(false);
  const [loreError, setLoreError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Chat with Gemini
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'lore' | 'surface' | 'chat'>('lore');

  // Fetch or retrieve Gemini Lore when body changes
  useEffect(() => {
    if (!body) {
      setLoreData(null);
      setChatMessages([]);
      return;
    }

    // Check client-side memory cache first
    if (clientLoreCache.has(body.id)) {
      setLoreData(clientLoreCache.get(body.id)!);
      setIsLoadingLore(false);
      setLoreError(null);
      setChatMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingLore(true);
    setLoreError(null);
    setChatMessages([]);

    fetch('/api/gemini/lore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: body.id,
        name: body.name,
        type: body.type,
        parentStar: body.parentStar,
        distanceAU: body.distanceAU,
        temperatureK: body.temperatureK,
        atmosphere: body.atmosphere,
        radiusKm: body.radiusKm,
        orbitalPeriodDays: body.orbitalPeriodDays,
        moonsCount: body.moonsCount,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (isMounted && data.success && data.data) {
          clientLoreCache.set(body.id, data.data);
          setLoreData(data.data);
          if (data.isOfflineFallback) {
            setIsOfflineMode(true);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Lore fetch error:', err);
          setIsOfflineMode(true);
          // Fallback to base scientific highlights
          const fallback: GeminiLoreData = {
            overview: body.tagline,
            surfaceConditions: `Observations of ${body.name} show intense environmental dynamics characterized by an atmosphere of ${body.atmosphere}.`,
            atmosphereAndClimate: `Equilibrium temperature hovers around ${body.temperatureK} K (${Math.round(body.temperatureK - 273.15)}°C).`,
            scientificMysteries: body.scientificHighlights,
            expeditionLog: `ODYSSEY-PROBE: Orbital telemetry confirms stable trajectory around ${body.name}. Sensors recording steady radiation signatures.`,
            habitabilityVerdict: body.temperatureK > 180 && body.temperatureK < 320 ? 'Marginally habitable potential for extremophiles in sheltered subsurface reservoirs.' : 'Hostile surface environment exceeding human tolerance thresholds without synthetic biosphere habitats.',
            funFact: body.scientificHighlights[0] || 'A fascinating object in the astronomical database.',
          };
          clientLoreCache.set(body.id, fallback);
          setLoreData(fallback);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingLore(false);
      });

    return () => {
      isMounted = false;
    };
  }, [body?.id]);

  const handleAskQuestion = async (customQ?: string) => {
    const q = (customQ || questionInput).trim();
    if (!q || !body || isAsking) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', text: q }];
    setChatMessages(newMessages);
    setQuestionInput('');
    setIsAsking(true);

    try {
      const res = await fetch('/api/gemini/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyName: body.name,
          question: q,
          bodyContext: {
            type: body.type,
            parentStar: body.parentStar,
            atmosphere: body.atmosphere,
            temperatureK: body.temperatureK,
            gravity: body.surfaceGravityG,
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.answer) {
        setChatMessages([...newMessages, { role: 'gemini', text: data.answer }]);
      } else {
        setChatMessages([
          ...newMessages,
          { role: 'gemini', text: data.error || 'Deep-space communication anomaly. Please try asking again.' },
        ]);
      }
    } catch (err: any) {
      setChatMessages([
        ...newMessages,
        { role: 'gemini', text: 'Telemetry link interrupted. Please retry your inquiry.' },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  if (!body) return null;

  const tempCelsius = Math.round(body.temperatureK - 273.15);

  const quickQuestions = [
    `Could humans survive in floating cloud cities on ${body.name}?`,
    `What would sunset look like through ${body.name}'s atmosphere?`,
    `What would liquid rain or weather feel like here?`,
    `Could extremophile microorganisms exist beneath the surface?`,
  ];

  return (
    <aside className="fixed top-18 left-4 bottom-24 z-20 w-[420px] max-w-[calc(100vw-32px)] bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300">
      {/* Dossier Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl border border-slate-600/50 flex items-center justify-center shrink-0 shadow-inner"
            style={{ backgroundColor: body.surfaceColorHex }}
          >
            <Atom className="w-5 h-5 text-white/90 drop-shadow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">{body.name}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                {body.type}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{body.parentStar}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPlayPlanetarySound(body.audioFrequencyHz)}
            title="Listen to planetary acoustic signature"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Close Dossier"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Astronomical Metrics Badges */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/40 border-b border-slate-800 text-xs">
        <div className="flex flex-col bg-slate-900/80 p-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
            <Thermometer className="w-3 h-3 text-amber-400" />
            <span>TEMP</span>
          </div>
          <span className="font-semibold text-slate-200 mt-0.5">{tempCelsius}°C</span>
          <span className="text-[10px] text-slate-500 font-mono">{body.temperatureK} K</span>
        </div>

        <div className="flex flex-col bg-slate-900/80 p-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
            <Gauge className="w-3 h-3 text-cyan-400" />
            <span>GRAVITY</span>
          </div>
          <span className="font-semibold text-slate-200 mt-0.5">{body.surfaceGravityG.toFixed(2)} g</span>
          <span className="text-[10px] text-slate-500 font-mono">{(body.surfaceGravityG * 9.81).toFixed(1)} m/s²</span>
        </div>

        <div className="flex flex-col bg-slate-900/80 p-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
            <Compass className="w-3 h-3 text-emerald-400" />
            <span>ORBIT</span>
          </div>
          <span className="font-semibold text-slate-200 mt-0.5">
            {body.orbitalPeriodDays > 365
              ? `${(body.orbitalPeriodDays / 365.25).toFixed(1)} yrs`
              : `${body.orbitalPeriodDays.toFixed(1)} d`}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{body.distanceAU} AU</span>
        </div>
      </div>

      {/* Real Keplerian Orbital Mechanics Elements Strip */}
      {(body.eccentricity !== undefined || body.inclinationDeg !== undefined) && (
        <div className="mx-3 mb-1 px-3 py-2 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">ECCENTRICITY (e)</span>
            <span className="text-cyan-300 font-bold">
              {body.eccentricity !== undefined ? body.eccentricity.toFixed(4) : '0.0000'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">INCLINATION (i)</span>
            <span className="text-indigo-300 font-bold">
              {body.inclinationDeg !== undefined ? `${body.inclinationDeg.toFixed(2)}°` : '0.00°'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">SEMI-MAJOR AXIS</span>
            <span className="text-amber-300 font-bold">
              {body.semiMajorAxisAU !== undefined
                ? `${body.semiMajorAxisAU.toFixed(3)} AU`
                : `${body.distanceAU} AU`}
            </span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center border-b border-slate-800 px-3 pt-2 gap-1 bg-slate-900/90">
        <button
          onClick={() => setActiveTab('lore')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'lore'
              ? 'bg-slate-800 text-indigo-300 border-t-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Lore & Intel
        </button>
        <button
          onClick={() => setActiveTab('surface')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'surface'
              ? 'bg-slate-800 text-indigo-300 border-t-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          Surface Expedition
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'chat'
              ? 'bg-slate-800 text-indigo-300 border-t-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-amber-400" />
          Ask Gemini
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
        {/* Loading State */}
        {isLoadingLore && (
          <div className="flex items-center gap-2 p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-indigo-300 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Analyzing planetary spectroscopy & synthesizing scientific lore...</span>
          </div>
        )}

        {/* Offline / Quota Fallback Notice */}
        {isOfflineMode && (
          <div className="p-2.5 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-200/90 flex items-start gap-2">
            <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Onboard Telemetry Archive Active:</span>{' '}
              Gemini free-tier limit reached (20/day). Dossier loaded from verified astrophysical archive.
            </div>
          </div>
        )}

        {/* Tab 1: AI Lore & Scientific Dossier */}
        {activeTab === 'lore' && loreData && (
          <div className="space-y-3.5 text-xs">
            {/* Overview */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <h3 className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5 text-indigo-300">
                <Sparkles className="w-3.5 h-3.5" />
                Planetary Summary
              </h3>
              <p className="text-slate-300 leading-relaxed">{loreData.overview}</p>
            </div>

            {/* Atmosphere & Climate */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <h3 className="font-semibold text-slate-200 mb-1.5 text-cyan-300">
                Atmosphere & Climate Dynamics
              </h3>
              <p className="text-slate-300 leading-relaxed">{loreData.atmosphereAndClimate}</p>
              <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                COMPOSITION: {body.atmosphere}
              </div>
            </div>

            {/* Habitability Verdict */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <h3 className="font-semibold text-slate-200 mb-1.5 text-emerald-300">
                Astrobiology & Habitability Verdict
              </h3>
              <p className="text-slate-300 leading-relaxed">{loreData.habitabilityVerdict}</p>
            </div>

            {/* Scientific Mysteries */}
            {loreData.scientificMysteries && loreData.scientificMysteries.length > 0 && (
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <h3 className="font-semibold text-slate-200 mb-2 text-amber-300">
                  Unresolved Scientific Mysteries
                </h3>
                <ul className="space-y-1.5">
                  {loreData.scientificMysteries.map((m, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-300">
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fun Fact */}
            <div className="bg-indigo-950/30 p-3 rounded-xl border border-indigo-900/50">
              <h4 className="text-[11px] font-mono font-semibold text-indigo-400 uppercase tracking-wider mb-1">
                Astronomical Highlight
              </h4>
              <p className="text-slate-300 leading-relaxed italic">"{loreData.funFact}"</p>
            </div>
          </div>
        )}

        {/* Tab 2: Surface & Expedition Log */}
        {activeTab === 'surface' && loreData && (
          <div className="space-y-3.5 text-xs">
            {/* Surface Conditions */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <h3 className="font-semibold text-slate-200 mb-1.5 text-amber-300">
                Surface Environment
              </h3>
              <p className="text-slate-300 leading-relaxed">{loreData.surfaceConditions}</p>
            </div>

            {/* Synthetic Probe Transmission Log */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-900/40 font-mono">
              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold mb-2">
                <Radio className="w-3.5 h-3.5" />
                <span>AUTONOMOUS PROBE TELEMETRY LOG</span>
              </div>
              <p className="text-emerald-200/90 text-[11px] leading-relaxed bg-black/40 p-2.5 rounded-lg border border-emerald-950">
                {loreData.expeditionLog}
              </p>
            </div>

            {/* Moons Breakdown if any */}
            {body.moons && body.moons.length > 0 && (
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <h3 className="font-semibold text-slate-200 mb-2">
                  Known Natural Satellites ({body.moons.length})
                </h3>
                <div className="space-y-2">
                  {body.moons.map((m) => (
                    <div key={m.id} className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{m.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{m.radiusKm} km radius</span>
                      </div>
                      <p className="text-[11px] text-slate-300">{m.overview}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Interactive Conversational Q&A with Gemini */}
        {activeTab === 'chat' && (
          <div className="space-y-3 text-xs flex flex-col h-full">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <p className="text-slate-300 leading-relaxed">
                Ask Gemini any question about <strong className="text-white">{body.name}</strong>'s physics, climate, atmosphere, or speculative human exploration.
              </p>
            </div>

            {/* Quick Prompt Suggestions */}
            {chatMessages.length === 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-mono">SUGGESTED INQUIRIES:</span>
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAskQuestion(q)}
                    className="w-full text-left p-2 rounded-lg bg-slate-950/80 hover:bg-indigo-950/50 border border-slate-800 hover:border-indigo-600/50 text-slate-300 hover:text-white transition-all text-[11px] flex items-center justify-between group cursor-pointer"
                  >
                    <span>{q}</span>
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Conversation Messages */}
            <div className="space-y-2.5">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600/30 border border-indigo-500/40 text-indigo-100 ml-4'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 mr-4'
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">
                    {msg.role === 'user' ? 'Astronomer' : 'Gemini AI'}
                  </div>
                  <div className="whitespace-pre-line">{msg.text}</div>
                </div>
              ))}

              {isAsking && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span className="text-[11px]">Gemini is computing planetary response...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat Input Bar (visible when Chat tab is active) */}
      {activeTab === 'chat' && (
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
            placeholder={`Ask Gemini about ${body.name}...`}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => handleAskQuestion()}
            disabled={isAsking || !questionInput.trim()}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-600 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
};
