import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { OFFLINE_PLANETARY_LORE, PlanetaryLoreRecord } from './src/data/planetaryLoreData';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Gemini API client on server-side with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-Memory Server Caches to preserve quota and maximize performance
const loreCache = new Map<string, PlanetaryLoreRecord>();
const askCache = new Map<string, string>();

// Multi-Model Fallback Helper
async function generateWithFallback(params: any): Promise<{ text: string; modelUsed: string }> {
  // Try flash-lite first (higher limits), then flash-latest, then 3.8-flash
  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      return { text: response.text || '', modelUsed: model };
    } catch (err: any) {
      lastErr = err;
      const errMsg = String(err?.message || '');
      if (
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('quota') ||
        errMsg.includes('limit')
      ) {
        console.warn(`[Gemini Engine] Model ${model} quota exhausted, falling back to next model...`);
        continue;
      }
      // Non-quota error, still try next model or rethrow
      console.warn(`[Gemini Engine] Model ${model} encountered error:`, errMsg);
    }
  }

  throw lastErr;
}

// Endpoint 1: Generate Deep Planetary Lore & Scientific Dossier
app.post('/api/gemini/lore', async (req, res) => {
  const { name, id, type, parentStar, distanceAU, temperatureK, atmosphere, radiusKm, orbitalPeriodDays, moonsCount } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Celestial body name is required.' });
  }

  const lookupKey = (id || name).toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Check in-memory server cache
  if (loreCache.has(lookupKey)) {
    return res.json({ success: true, data: loreCache.get(lookupKey), cached: true });
  }

  // 2. Check pre-compiled offline database for instant lookup
  // If present, we can return it directly or attempt live enhancement
  const offlineMatchKey = Object.keys(OFFLINE_PLANETARY_LORE).find(
    (k) => lookupKey.includes(k) || k.includes(lookupKey)
  );

  try {
    const prompt = `You are a planetary astrophysicist and cosmic science communicator.
Generate a rich, deeply engaging, and scientifically rigorous cosmic profile for the celestial body: "${name}".
Known data:
- Type/Classification: ${type || 'Unknown'}
- Host Star: ${parentStar || 'The Sun'}
- Distance from Star: ${distanceAU ?? 'Variable'} AU
- Surface/Atmospheric Temperature: ${temperatureK ? `${temperatureK} K (${Math.round(temperatureK - 273.15)}°C)` : 'Unknown'}
- Atmospheric Composition: ${atmosphere || 'Unknown'}
- Radius: ${radiusKm ? `${radiusKm} km` : 'Unknown'}
- Orbital Period: ${orbitalPeriodDays ? `${orbitalPeriodDays} Earth days` : 'Unknown'}
- Known Moons: ${moonsCount ?? 0}

Please provide a structured scientific response formatted strictly as JSON with:
1. "overview": 2-3 engaging sentences summarizing what makes this world extraordinary.
2. "surfaceConditions": A detailed paragraph describing what a human observer standing or floating on the surface (or cloud tops) would see, feel, and experience (lighting, sky color, pressure, weather phenomena).
3. "atmosphereAndClimate": A breakdown of atmospheric dynamics, wind speeds, storms, greenhouse/freezing effects, or radiation belts.
4. "scientificMysteries": 2-3 intriguing unresolved scientific questions or ongoing research mysteries about this body.
5. "expeditionLog": A vivid 3-sentence transmission from an imaginary futuristic autonomous research probe or rover (e.g. "PROBE ODYSSEY-VII: ...").
6. "habitabilityVerdict": A concise assessment of potential for life (past, present, microbial, or extremophile) and colonization viability.
7. "funFact": A mind-blowing, memorable astronomical fact.`;

    const result = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            surfaceConditions: { type: Type.STRING },
            atmosphereAndClimate: { type: Type.STRING },
            scientificMysteries: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            expeditionLog: { type: Type.STRING },
            habitabilityVerdict: { type: Type.STRING },
            funFact: { type: Type.STRING },
          },
          required: [
            'overview',
            'surfaceConditions',
            'atmosphereAndClimate',
            'scientificMysteries',
            'expeditionLog',
            'habitabilityVerdict',
            'funFact',
          ],
        },
      },
    });

    const parsed = JSON.parse(result.text || '{}') as PlanetaryLoreRecord;
    loreCache.set(lookupKey, parsed);
    return res.json({ success: true, data: parsed, modelUsed: result.modelUsed });
  } catch (error: any) {
    console.warn('[Gemini lore endpoint] Falling back to offline telemetry database:', error?.message);

    // If offline database has this body, return rich pre-compiled lore
    if (offlineMatchKey && OFFLINE_PLANETARY_LORE[offlineMatchKey]) {
      const offlineRecord = OFFLINE_PLANETARY_LORE[offlineMatchKey];
      loreCache.set(lookupKey, offlineRecord);
      return res.json({
        success: true,
        data: offlineRecord,
        isOfflineFallback: true,
      });
    }

    // Dynamic procedural fallback for custom/speculative bodies
    const tempC = temperatureK ? Math.round(temperatureK - 273.15) : 20;
    const proceduralFallback: PlanetaryLoreRecord = {
      overview: `${name} is an extraordinary ${type || 'exoplanet'} orbiting ${parentStar || 'its host star'} at a distance of ${distanceAU || '1.0'} AU.`,
      surfaceConditions: `Surface telemetry records ambient temperatures around ${temperatureK || 300} K (${tempC}°C) under an atmosphere composed of ${atmosphere || 'nitrogen, methane, and volatile gases'}. Surface lighting is heavily tinted by stellar emission from ${parentStar || 'the primary star'}.`,
      atmosphereAndClimate: `Atmospheric circulation is governed by ${temperatureK && temperatureK > 1000 ? 'extreme thermal convection and supersonic jet winds' : 'moderate climatic bands and weather fronts'}. ${atmosphere || 'Dense chemical vapors insulate the planetary crust.'}`,
      scientificMysteries: [
        `The chemical evolution and atmospheric retention of ${name} under host star radiation.`,
        `Subsurface tectonic dynamics and potential geothermal hydrothermal activity.`,
        `Direct high-contrast coronagraph imaging prospects with next-generation space observatories.`
      ],
      expeditionLog: `SSV-COSMOSCOPE-SURVEY: Telemetry lock verified on ${name}. Optical spectroscopy matches expected absorption bands. Trajectory stable in orbit.`,
      habitabilityVerdict: tempC > -30 && tempC < 60
        ? 'Potentially habitable in localized climate zones or subsurface aquifers for extremophile microorganisms.'
        : 'Surface environment exceeds baseline organic biological tolerance; requires environmental shielding suits and life support.',
      funFact: `Spectroscopic signatures indicate unique rotational and orbital dynamics characterized by an equilibrium surface temperature of ${temperatureK || 300} Kelvin.`
    };

    loreCache.set(lookupKey, proceduralFallback);
    return res.json({
      success: true,
      data: proceduralFallback,
      isOfflineFallback: true,
    });
  }
});

// Endpoint 2: Interactive Cosmic Inquiry / Q&A about current body
app.post('/api/gemini/ask', async (req, res) => {
  const { bodyName, question, bodyContext } = req.body;

  if (!bodyName || !question) {
    return res.status(400).json({ error: 'Body name and question are required.' });
  }

  const cacheKey = `${bodyName}:${question}`.toLowerCase().trim();
  if (askCache.has(cacheKey)) {
    return res.json({ success: true, answer: askCache.get(cacheKey) });
  }

  const systemInstruction = `You are COSMOS, the onboard AI astrophysicist of the CosmoScope Explorer.
You possess encyclopedic knowledge of celestial mechanics, planetary science, stellar evolution, and astrobiology.
Answer the user's question about "${bodyName}" vividly, accurately, with clear explanations of physics and planetary science.
Keep the answer focused (2-3 concise paragraphs), intellectually inspiring, and scientifically sound.
Context about ${bodyName}: ${JSON.stringify(bodyContext || {})}`;

  try {
    const result = await generateWithFallback({
      contents: question,
      config: {
        systemInstruction,
      },
    });

    askCache.set(cacheKey, result.text);
    return res.json({ success: true, answer: result.text, modelUsed: result.modelUsed });
  } catch (error: any) {
    console.warn('[Gemini ask endpoint] Generating offline astrophysical response:', error?.message);

    // Astrobiology / physics synthesis fallback
    const qLower = question.toLowerCase();
    let fallbackAnswer = '';

    if (qLower.includes('cloud') || qLower.includes('floating') || qLower.includes('city') || qLower.includes('survive')) {
      fallbackAnswer = `Atmospheric engineering on ${bodyName} depends heavily on pressure gradients and atmospheric density. In worlds like Venus or gas giants with deep atmospheres, human habitats can theoretically achieve positive buoyancy using breathable air (nitrogen/oxygen) as a lifting gas, floating in temperate altitude bands where temperatures hover between 0°C and 50°C.\n\nHowever, habitats must feature acid-resistant alloys and thermal shielding against harsh atmospheric corrosives and ultraviolet radiation.`;
    } else if (qLower.includes('sunset') || qLower.includes('sky') || qLower.includes('light') || qLower.includes('look')) {
      fallbackAnswer = `Sunset on ${bodyName} is dictated by atmospheric optical thickness and the spectral type of ${bodyContext?.parentStar || 'its host star'}. Rayleigh scattering of atmospheric gases preferentially scatters shorter wavelengths, while aerosols and dust create striking twilight glows—such as the pale blue sunsets of Mars or the deep crimson twilight bands of tidally locked worlds like TRAPPIST-1e.`;
    } else if (qLower.includes('water') || qLower.includes('life') || qLower.includes('microbial') || qLower.includes('ocean')) {
      fallbackAnswer = `Liquid water stability is bounded by the triple point of H2O and ambient atmospheric pressure. On ${bodyName}, temperatures of ${bodyContext?.temperatureK || 300} K determine whether surface water remains liquid, boils into supercritical steam, or freezes into bedrock ice.\n\nSubsurface hydrothermal environments remain the prime candidates for extremophile chemotrophic life, shielded from cosmic radiation and harsh surface conditions.`;
    } else {
      fallbackAnswer = `Based on telemetry from ${bodyName}, its planetary parameters (${bodyContext?.type || 'terrestrial planet'} orbiting ${bodyContext?.parentStar || 'its parent star'} with gravity ${bodyContext?.gravity || 1.0}g and atmosphere of ${bodyContext?.atmosphere || 'gaseous compounds'}) establish an environment shaped by extreme celestial mechanics.\n\nPlanetary scientists study these dynamics to understand how atmospheric evolution, stellar flares, and orbital eccentricity shape geological and atmospheric conditions over billions of years.`;
    }

    fallbackAnswer += '\n\n*(Telemetry Note: Response synthesized from onboard astrophysics database while Gemini Free Tier daily API quota refreshes. Add billing in Settings > Secrets for unlimited live model queries).*';

    askCache.set(cacheKey, fallbackAnswer);
    return res.json({ success: true, answer: fallbackAnswer, isOfflineFallback: true });
  }
});

// Endpoint 3: Procedural Speculative Exoplanet Generator
app.post('/api/gemini/create-exoplanet', async (req, res) => {
  const { userConcept } = req.body;

  const prompt = `Design a fascinating, scientifically grounded speculative exoplanet ${
    userConcept ? `based on the user's concept: "${userConcept}"` : 'with unique and extreme astrophysical phenomena'
  }.

Synthesize realistic astronomical parameters, physical metrics, and visual rendering parameters for our 3D procedural engine.

Return strict JSON:
{
  "name": "Designation name (e.g. Kepler-947b or Astraea-IV)",
  "nickname": "Poetic epithet (e.g. 'The Crystalline Forge' or 'The Eternal Sunset')",
  "type": "Terrestrial / Super-Earth / Hycean Ocean World / Hot Jupiter / Carbon World / Chthonian Planet / Ice Giant",
  "parentStar": "Star name and spectral class (e.g. Gliese-832, M-dwarf)",
  "distanceAU": number (orbital radius from star, e.g. 0.04 to 45.0),
  "radiusKm": number (e.g. 3500 to 90000),
  "massEarths": number (e.g. 0.2 to 450.0),
  "temperatureK": number (e.g. 40 to 2400),
  "orbitalPeriodDays": number (e.g. 1.2 to 12000),
  "atmosphere": "Atmospheric gases (e.g. N2-CO2-CH4 or H2-He with vaporized silica)",
  "surfaceColorHex": "Primary hex color code (e.g. #3b82f6)",
  "secondaryColorHex": "Secondary accent hex color code (e.g. #10b981)",
  "cloudColorHex": "Cloud/haze hex color code (e.g. #e0f2fe)",
  "emissiveColorHex": "Lava/aurora/bioluminescent glow hex (or #000000 if none)",
  "hasRings": boolean,
  "ringColorHex": "Ring hex color code (e.g. #d97706)",
  "ringInnerRatio": number (between 1.3 and 1.7),
  "ringOuterRatio": number (between 2.1 and 2.8),
  "cloudDensity": number (between 0.0 and 1.0),
  "textureType": "rocky_cratered | banded_gas | oceanic_continents | lava_fissures | icy_cracks | turbulent_storm",
  "overview": "2-sentence introduction",
  "surfaceLore": "Detailed paragraph describing surface/atmospheric environment",
  "habitabilityVerdict": "Assessment of life potential",
  "soundscapeDescription": "Brief description of the planet's simulated radio/acoustic frequency profile"
}`;

  try {
    const result = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            nickname: { type: Type.STRING },
            type: { type: Type.STRING },
            parentStar: { type: Type.STRING },
            distanceAU: { type: Type.NUMBER },
            radiusKm: { type: Type.NUMBER },
            massEarths: { type: Type.NUMBER },
            temperatureK: { type: Type.NUMBER },
            orbitalPeriodDays: { type: Type.NUMBER },
            atmosphere: { type: Type.STRING },
            surfaceColorHex: { type: Type.STRING },
            secondaryColorHex: { type: Type.STRING },
            cloudColorHex: { type: Type.STRING },
            emissiveColorHex: { type: Type.STRING },
            hasRings: { type: Type.BOOLEAN },
            ringColorHex: { type: Type.STRING },
            ringInnerRatio: { type: Type.NUMBER },
            ringOuterRatio: { type: Type.NUMBER },
            cloudDensity: { type: Type.NUMBER },
            textureType: { type: Type.STRING },
            overview: { type: Type.STRING },
            surfaceLore: { type: Type.STRING },
            habitabilityVerdict: { type: Type.STRING },
            soundscapeDescription: { type: Type.STRING },
          },
          required: [
            'name',
            'nickname',
            'type',
            'parentStar',
            'distanceAU',
            'radiusKm',
            'massEarths',
            'temperatureK',
            'orbitalPeriodDays',
            'atmosphere',
            'surfaceColorHex',
            'secondaryColorHex',
            'cloudColorHex',
            'hasRings',
            'textureType',
            'overview',
            'surfaceLore',
            'habitabilityVerdict',
          ],
        },
      },
    });

    const parsed = JSON.parse(result.text || '{}');
    return res.json({ success: true, exoplanet: parsed, modelUsed: result.modelUsed });
  } catch (error: any) {
    console.warn('[Gemini create-exoplanet endpoint] Generating offline speculative world:', error?.message);

    // Procedural generation fallback tailored to user concept
    const concept = (userConcept || '').toLowerCase();
    const isLava = concept.includes('lava') || concept.includes('volcan') || concept.includes('fire');
    const isOcean = concept.includes('ocean') || concept.includes('water') || concept.includes('hycean');
    const isBio = concept.includes('bio') || concept.includes('fung') || concept.includes('forest') || concept.includes('green');
    const isIce = concept.includes('ice') || concept.includes('cryo') || concept.includes('cold');

    const randomSuffix = Math.floor(100 + Math.random() * 899);
    const proceduralExoplanet = {
      name: isOcean ? `Aethelgard-${randomSuffix}b` : isLava ? `Vulcanis-${randomSuffix}c` : isBio ? `Viridia-${randomSuffix}d` : `Novalis-${randomSuffix}b`,
      nickname: isOcean ? 'The Abyssal Sovereign' : isLava ? 'The Basalt Forge' : isBio ? 'The Bioluminescent Canopy' : 'The Crystal Sentinel',
      type: isOcean ? 'Hycean Ocean World' : isLava ? 'Lava Super-Earth' : isBio ? 'Biospheric Super-Earth' : 'Carbon Super-Earth',
      parentStar: isOcean ? 'Kepler-882 (G-dwarf)' : isLava ? 'Gliese-714 (M-dwarf)' : 'HD-109312 (Binary K-stars)',
      distanceAU: isOcean ? 1.15 : isLava ? 0.025 : 0.88,
      radiusKm: isOcean ? 16500 : isLava ? 9200 : 12400,
      massEarths: isOcean ? 8.4 : isLava ? 4.2 : 3.8,
      temperatureK: isOcean ? 295 : isLava ? 2100 : 288,
      orbitalPeriodDays: isOcean ? 342.5 : isLava ? 1.8 : 265.0,
      atmosphere: isOcean ? 'Hydrogen, Steam, Methane, trace Nitrogen' : isLava ? 'Vaporized rock, Carbon Dioxide, Sulfur Dioxide' : 'Nitrogen, Oxygen, trace Argon, Water Vapor',
      surfaceColorHex: isOcean ? '#0284c7' : isLava ? '#b91c1c' : isBio ? '#059669' : '#4f46e5',
      secondaryColorHex: isOcean ? '#0d9488' : isLava ? '#f59e0b' : isBio ? '#10b981' : '#818cf8',
      cloudColorHex: isOcean ? '#e0f2fe' : isLava ? '#78350f' : isBio ? '#d1fae5' : '#e0e7ff',
      emissiveColorHex: isLava ? '#ea580c' : isBio ? '#34d399' : '#000000',
      hasRings: true,
      ringColorHex: isOcean ? '#38bdf8' : isLava ? '#f59e0b' : '#a7f3d0',
      ringInnerRatio: 1.45,
      ringOuterRatio: 2.35,
      cloudDensity: 0.65,
      textureType: isOcean ? 'oceanic_continents' : isLava ? 'lava_fissures' : 'rocky_cratered',
      overview: `A magnificent ${isOcean ? 'ocean world' : isLava ? 'magma world' : 'speculative world'} inspired by: "${userConcept || 'deep astrophysical synthesis'}".`,
      surfaceLore: `Surface conditions feature breathtaking vistas of ${isOcean ? 'boundless rolling waves beneath warm mist canopies' : isLava ? 'crackling rivers of liquid basalt glowing gold against dark obsidian crust' : 'vibrant mineral formations reflecting stellar illumination'}.`,
      habitabilityVerdict: isLava
        ? 'Sterile and hostile to organic biology.'
        : 'Favorable conditions for exotic marine or microbial ecosystems.',
      soundscapeDescription: 'Deep resonance modulated by atmospheric jet streams and electromagnetic ring currents.'
    };

    return res.json({ success: true, exoplanet: proceduralExoplanet, isOfflineFallback: true });
  }
});

// NASA Endpoint 1: Live NASA Exoplanet Archive TAP Query
let nasaExoplanetCache: any = null;
let nasaExoplanetCacheTime = 0;

app.get('/api/nasa/exoplanets', async (_req, res) => {
  const now = Date.now();
  if (nasaExoplanetCache && now - nasaExoplanetCacheTime < 3600000) {
    return res.json({ success: true, data: nasaExoplanetCache, cached: true });
  }

  try {
    const query = encodeURIComponent(
      `select pl_name,hostname,pl_orbper,pl_orbsmax,pl_orbeccen,pl_orbincl,pl_bmasse,pl_rade,pl_eqt from ps where default_flag=1 and pl_orbsmax is not null and pl_name in ('TRAPPIST-1 e','Kepler-22 b','55 Cnc e','WASP-12 b','Proxima Cen b','HD 189733 b','TOI-700 d') order by pl_name`
    );
    const url = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${query}&format=json`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      nasaExoplanetCache = data;
      nasaExoplanetCacheTime = now;
      return res.json({ success: true, data, source: 'NASA Exoplanet Archive TAP' });
    }
    throw new Error(`NASA HTTP ${response.status}`);
  } catch (err: any) {
    console.warn('NASA Exoplanet Archive live query failed, using verified cache:', err?.message);
    return res.json({
      success: true,
      data: [
        { pl_name: 'TRAPPIST-1 e', hostname: 'TRAPPIST-1', pl_orbper: 6.101, pl_orbsmax: 0.02925, pl_orbeccen: 0.005, pl_orbincl: 89.79, pl_rade: 0.92 },
        { pl_name: 'Kepler-22 b', hostname: 'Kepler-22', pl_orbper: 289.86, pl_orbsmax: 0.812, pl_orbeccen: 0.72, pl_orbincl: 89.76, pl_rade: 2.1 },
        { pl_name: '55 Cnc e', hostname: '55 Cnc', pl_orbper: 0.7365, pl_orbsmax: 0.01544, pl_orbeccen: 0.05, pl_orbincl: 83.59, pl_rade: 1.875 },
        { pl_name: 'WASP-12 b', hostname: 'WASP-12', pl_orbper: 1.0914, pl_orbsmax: 0.0234, pl_orbeccen: 0.04, pl_orbincl: 81.8, pl_rade: 22.02 },
        { pl_name: 'Proxima Cen b', hostname: 'Proxima Cen', pl_orbper: 11.186, pl_orbsmax: 0.0485, pl_orbeccen: 0.11, pl_orbincl: 88.0, pl_rade: 1.07 },
      ],
      isFallback: true,
    });
  }
});

// NASA Endpoint 2: NASA JPL Horizons Live Ephemeris Query
const horizonsCache = new Map<string, any>();

app.get('/api/nasa/horizons', async (req, res) => {
  const { command, date } = req.query;
  const targetId = String(command || '399'); // Default 399 = Earth
  const dateStr = String(date || new Date().toISOString().split('T')[0]);
  const cacheKey = `${targetId}_${dateStr}`;

  if (horizonsCache.has(cacheKey)) {
    return res.json({ success: true, data: horizonsCache.get(cacheKey), cached: true });
  }

  try {
    const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='${targetId}'&EPHEM_TYPE='ELEMENTS'&CENTER='500@10'&START_TIME='${dateStr}'&STOP_TIME='${dateStr} 23:59'&STEP_SIZE='1d'`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      horizonsCache.set(cacheKey, data);
      return res.json({ success: true, data, source: 'NASA JPL Horizons API' });
    }
    throw new Error(`NASA Horizons HTTP ${response.status}`);
  } catch (err: any) {
    console.warn('NASA JPL Horizons query failed:', err?.message);
    return res.status(500).json({ error: 'Horizons API query error', message: err?.message });
  }
});

const PORT = 3000;

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CosmoScope 3D Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
