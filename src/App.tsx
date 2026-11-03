/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CosmicSceneManager, FlightTelemetry, EphemerisTimeData } from './three/CosmicScene';
import {
  CelestialBody,
  SOLAR_SYSTEM_BODIES,
  EXOPLANETS_CATALOG,
} from './data/celestialData';
import { TopBar } from './components/TopBar';
import { BottomDock } from './components/BottomDock';
import { PlanetaryDossier } from './components/PlanetaryDossier';
import { SpeculativeExoplanetModal } from './components/SpeculativeExoplanetModal';
import { StarshipCockpitOverlay } from './components/StarshipCockpitOverlay';
import { CosmicAudioEngine } from './audio/CosmicAudio';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<CosmicSceneManager | null>(null);

  // App States
  const [activeCategory, setActiveCategory] = useState<'solar' | 'exoplanet' | 'custom'>('solar');
  const [selectedBody, setSelectedBody] = useState<CelestialBody | null>(null);
  const [hoveredBody, setHoveredBody] = useState<CelestialBody | null>(null);

  const [timeMultiplier, setTimeMultiplier] = useState(1.0);
  const [isPaused, setIsPaused] = useState(false);
  const [isOrreryScale, setIsOrreryScale] = useState(true);

  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [currentAudioHz, setCurrentAudioHz] = useState(136.1);

  const [isSpeculativeModalOpen, setIsSpeculativeModalOpen] = useState(false);
  const [customWorlds, setCustomWorlds] = useState<CelestialBody[]>([]);
  const [simulatedDays, setSimulatedDays] = useState(0);

  // Real NASA Ephemeris & TAP data state
  const [ephemerisData, setEphemerisData] = useState<EphemerisTimeData | null>(null);
  const [nasaExoplanetCount, setNasaExoplanetCount] = useState<number>(7);

  // Starship Cockpit Pilot View State
  const [isCockpitMode, setIsCockpitMode] = useState(false);
  const [flightTelemetry, setFlightTelemetry] = useState<FlightTelemetry | null>(null);

  // Available bodies for current category
  const availableBodies = useMemo(() => {
    if (activeCategory === 'solar') {
      return SOLAR_SYSTEM_BODIES;
    }
    if (activeCategory === 'exoplanet') {
      return EXOPLANETS_CATALOG;
    }
    return customWorlds.length > 0 ? customWorlds : EXOPLANETS_CATALOG;
  }, [activeCategory, customWorlds]);

  // Fetch live NASA Exoplanet Archive data on app mount
  useEffect(() => {
    fetch('/api/nasa/exoplanets')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const rawList = json?.data || json?.exoplanets || [];
        if (Array.isArray(rawList) && rawList.length > 0) {
          const normalized = rawList.map((item: any) => ({
            name: item.pl_name || item.name,
            semiMajorAxisAU: item.pl_orbsmax || item.semiMajorAxisAU,
            eccentricity: item.pl_orbeccen ?? item.eccentricity ?? 0.01,
            inclinationDeg: item.pl_orbincl ?? item.inclinationDeg ?? 85,
            orbitalPeriodDays: item.pl_orbper || item.orbitalPeriodDays,
            radiusEarths: item.pl_rade || item.radiusEarths,
          }));
          setNasaExoplanetCount(normalized.length);
          sceneManagerRef.current?.applyNasaExoplanetData(normalized);
        }
      })
      .catch((err) => {
        console.warn('NASA TAP API background fetch warning:', err);
      });
  }, []);

  // Initialize Three.js scene once in isolated container
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const manager = new CosmicSceneManager(canvasMountRef.current, {
      onSelectBody: (body) => {
        setSelectedBody(body);
        if (body) {
          setCurrentAudioHz(body.audioFrequencyHz);
          const audio = CosmicAudioEngine.getInstance();
          audio.setPlanetaryResonance(body.audioFrequencyHz, body.id.includes('pulsar'));
          audio.playWarpEffect();
        }
      },
      onHoverBody: (body) => {
        setHoveredBody(body);
      },
      onTimeUpdate: (days, ephemeris) => {
        setSimulatedDays(Math.floor(days));
        if (ephemeris) {
          setEphemerisData(ephemeris);
        }
      },
      onFlightTelemetry: (telemetry) => {
        setFlightTelemetry(telemetry);
      },
    });

    sceneManagerRef.current = manager;

    return () => {
      manager.dispose();
      sceneManagerRef.current = null;
    };
  }, []);

  // Sync category change with 3D scene
  const handleSelectCategory = (category: 'solar' | 'exoplanet' | 'custom') => {
    setActiveCategory(category);
    setSelectedBody(null);
    CosmicAudioEngine.getInstance().playClickChirp();
    sceneManagerRef.current?.setActiveCategory(category);
  };

  // Focus body
  const handleSelectBody = (bodyId: string) => {
    CosmicAudioEngine.getInstance().playClickChirp();
    sceneManagerRef.current?.focusOnBody(bodyId);
    if (isCockpitMode) {
      CosmicAudioEngine.getInstance().playTargetLockSound();
    }
  };

  // Reset view to orbital overview
  const handleResetView = () => {
    CosmicAudioEngine.getInstance().playClickChirp();
    if (isCockpitMode) {
      sceneManagerRef.current?.exitCockpitMode();
      setIsCockpitMode(false);
    }
    sceneManagerRef.current?.resetCameraView();
    setSelectedBody(null);
  };

  // Cockpit Pilot Mode controls
  const handleToggleCockpitMode = () => {
    const audio = CosmicAudioEngine.getInstance();
    if (isAudioMuted) {
      setIsAudioMuted(false);
      audio.setMuted(false);
    }

    if (isCockpitMode) {
      sceneManagerRef.current?.exitCockpitMode();
      setIsCockpitMode(false);
      audio.setEngineThrottle(0);
      audio.playClickChirp();
    } else {
      sceneManagerRef.current?.enterCockpitMode(selectedBody?.id);
      setIsCockpitMode(true);
      audio.setEngineThrottle(0.3);
      audio.playTargetLockSound();
    }
  };

  const handleSetThrottle = (val: number) => {
    sceneManagerRef.current?.setThrottle(val);
    CosmicAudioEngine.getInstance().setEngineThrottle(val);
  };

  const handleEngageHyperdrive = (targetId?: string) => {
    sceneManagerRef.current?.engageHyperdrive(targetId);
    CosmicAudioEngine.getInstance().playHyperdriveJump();
  };

  const handleExitCockpit = () => {
    sceneManagerRef.current?.exitCockpitMode();
    setIsCockpitMode(false);
    CosmicAudioEngine.getInstance().setEngineThrottle(0);
    CosmicAudioEngine.getInstance().playClickChirp();
  };

  const handleSteer = (pitchDelta: number, yawDelta: number) => {
    sceneManagerRef.current?.setPilotSteering(pitchDelta, yawDelta);
  };

  // Time controls
  const handleSetTimeMultiplier = (rate: number) => {
    setTimeMultiplier(rate);
    sceneManagerRef.current?.setTimeMultiplier(rate);
    CosmicAudioEngine.getInstance().playClickChirp();
  };

  const handleTogglePause = () => {
    if (sceneManagerRef.current) {
      const paused = sceneManagerRef.current.togglePause();
      setIsPaused(paused);
    }
  };

  const handleToggleOrreryScale = () => {
    const nextVal = !isOrreryScale;
    setIsOrreryScale(nextVal);
    sceneManagerRef.current?.setOrreryScale(nextVal);
    CosmicAudioEngine.getInstance().playClickChirp();
  };

  // Real NASA Ephemeris Time controls
  const handleToggleLiveEphemeris = (isLive: boolean) => {
    sceneManagerRef.current?.setLiveEphemeris(isLive);
    CosmicAudioEngine.getInstance().playClickChirp();
  };

  const handleJumpToPreset = (preset: string) => {
    sceneManagerRef.current?.jumpToPreset(preset);
    CosmicAudioEngine.getInstance().playClickChirp();
  };

  const handleStepDays = (days: number) => {
    sceneManagerRef.current?.stepTimeDays(days);
    CosmicAudioEngine.getInstance().playClickChirp();
  };

  // Audio controls
  const handleToggleAudio = () => {
    const audio = CosmicAudioEngine.getInstance();
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    audio.setMuted(nextMuted);
    if (!nextMuted && selectedBody) {
      audio.setPlanetaryResonance(selectedBody.audioFrequencyHz, selectedBody.id.includes('pulsar'));
    }
  };

  const handlePlayPlanetarySound = (hz: number) => {
    const audio = CosmicAudioEngine.getInstance();
    if (isAudioMuted) {
      setIsAudioMuted(false);
      audio.setMuted(false);
    }
    audio.setPlanetaryResonance(hz, selectedBody?.id.includes('pulsar'));
    setCurrentAudioHz(hz);
  };

  // Created speculative exoplanet
  const handleSpeculativeCreated = (spec: any) => {
    if (sceneManagerRef.current) {
      const newBody = sceneManagerRef.current.addSpeculativeExoplanet(spec);
      setCustomWorlds((prev) => [newBody, ...prev]);
      setActiveCategory('custom');
      setSelectedBody(newBody);
      setCurrentAudioHz(newBody.audioFrequencyHz);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. Isolated WebGL Three.js Canvas Container (Skill compliant) */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
      />

      {/* 2. Top Bar Navigation & Brand (hidden during cockpit mode to avoid visual clutter) */}
      {!isCockpitMode && (
        <TopBar
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          selectedBodyName={selectedBody?.name || null}
          onResetView={handleResetView}
          onOpenSpeculativeModal={() => setIsSpeculativeModalOpen(true)}
        />
      )}

      {/* 3. Hover Tooltip (in Orbit Mode) */}
      {hoveredBody && !selectedBody && !isCockpitMode && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-900/90 text-slate-100 border border-slate-700/80 px-3.5 py-1.5 rounded-full text-xs font-mono shadow-xl flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: hoveredBody.surfaceColorHex }}
          />
          <span className="font-semibold text-white">{hoveredBody.name}</span>
          <span className="text-slate-400">({hoveredBody.type})</span>
          <span className="text-[10px] text-indigo-400 font-sans">Click to inspect</span>
        </div>
      )}

      {/* 4. Left Side Planetary Intelligence Dossier (in Orbit Mode) */}
      {!isCockpitMode && (
        <PlanetaryDossier
          body={selectedBody}
          onClose={() => setSelectedBody(null)}
          onPlayPlanetarySound={handlePlayPlanetarySound}
        />
      )}

      {/* 5. Starship Cockpit Overlay (Shown when Pilot View is engaged) */}
      {isCockpitMode && (
        <StarshipCockpitOverlay
          telemetry={flightTelemetry}
          availableBodies={availableBodies}
          selectedBody={selectedBody}
          onSelectTarget={handleSelectBody}
          onSetThrottle={handleSetThrottle}
          onEngageHyperdrive={handleEngageHyperdrive}
          onExitCockpit={handleExitCockpit}
          onSteer={handleSteer}
        />
      )}

      {/* 6. Sleek Collapsible Bottom Control Dock (100% viewport compliant) */}
      <BottomDock
        availableBodies={availableBodies}
        selectedBody={selectedBody}
        onSelectBody={handleSelectBody}
        onResetView={handleResetView}
        timeMultiplier={timeMultiplier}
        onSetTimeMultiplier={handleSetTimeMultiplier}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        isOrreryScale={isOrreryScale}
        onToggleOrreryScale={handleToggleOrreryScale}
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
        currentAudioHz={currentAudioHz}
        onOpenSpeculativeModal={() => setIsSpeculativeModalOpen(true)}
        isCockpitMode={isCockpitMode}
        onToggleCockpitMode={handleToggleCockpitMode}
        ephemerisData={ephemerisData || undefined}
        onToggleLiveEphemeris={handleToggleLiveEphemeris}
        onJumpToPreset={handleJumpToPreset}
        onStepDays={handleStepDays}
        nasaExoplanetsCount={nasaExoplanetCount}
      />

      {/* 7. Speculative Exoplanet Generator Modal */}
      <SpeculativeExoplanetModal
        isOpen={isSpeculativeModalOpen}
        onClose={() => setIsSpeculativeModalOpen(false)}
        onCreated={handleSpeculativeCreated}
      />
    </div>
  );
}
