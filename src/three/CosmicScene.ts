import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CelestialBody, MoonData, SOLAR_SYSTEM_BODIES, EXOPLANETS_CATALOG } from '../data/celestialData';
import { ProceduralTextureFactory } from './proceduralTextures';
import {
  calculateKeplerianPosition,
  generateKeplerianOrbitCurve,
  dateToJulianDate,
  julianDateToDate,
  NASA_JPL_PLANETARY_ELEMENTS,
  KeplerianElements,
} from '../physics/keplerianOrbits';

export interface EphemerisTimeData {
  julianDate: number;
  calendarDate: Date;
  dateString: string;
  isLive: boolean;
  timeRateDaysPerSec: number;
}

export interface FlightTelemetry {
  inCockpit: boolean;
  throttle: number; // 0 to 1
  speedKmS: number;
  distanceToTargetAU: number;
  distanceKm: number;
  isWarping: boolean;
  targetBodyName: string;
  targetScreenPos: { x: number; y: number; visible: boolean };
  shieldStatus: number;
  headingDeg: number;
  cockpitFov: number;
}

export interface SceneCallbacks {
  onSelectBody: (body: CelestialBody | null) => void;
  onHoverBody: (body: CelestialBody | null) => void;
  onTimeUpdate: (simulatedDays: number, ephemeris?: EphemerisTimeData) => void;
  onFlightTelemetry?: (telemetry: FlightTelemetry) => void;
}

interface CelestialObject3D {
  data: CelestialBody;
  pivotGroup: THREE.Group; // Orbit center pivot
  axialGroup: THREE.Group; // Planet axial tilt pivot
  bodyMesh: THREE.Mesh;
  atmosphereMesh?: THREE.Mesh;
  cloudMesh?: THREE.Mesh;
  ringMesh?: THREE.Mesh;
  orbitLine?: THREE.LineLoop;
  keplerianElements?: KeplerianElements;
  orbitScaleFactor: number;
  moonObjects: {
    data: MoonData;
    pivot: THREE.Group;
    mesh: THREE.Mesh;
  }[];
  solarFlares?: THREE.Mesh[];
}

export class CosmicSceneManager {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;

  private bodiesMap = new Map<string, CelestialObject3D>();
  private activeCategory: 'solar' | 'exoplanet' | 'custom' = 'solar';
  private selectedBodyId: string | null = null;
  private hoveredBodyId: string | null = null;

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private interactiveMeshes: THREE.Mesh[] = [];
  private lastPointerMoveTime = 0;

  // Camera tracking
  private isSoftwareGl = false;
  private isTrackingTarget = false;
  private cameraTargetPos = new THREE.Vector3(0, 45, 95);
  private controlsTargetPos = new THREE.Vector3(0, 0, 0);
  private cameraTransitionProgress = 1.0;

  // Starship Cockpit Pilot View & Perspective Camera Transformation
  private isCockpitMode = false;
  private normalFov = 45;
  private cockpitFov = 78;
  private targetFov = 45;
  private shipPosition = new THREE.Vector3(0, 20, 65);
  private shipVelocity = new THREE.Vector3(0, 0, 0);
  private shipForward = new THREE.Vector3(0, 0, -1);
  private pilotMouseLook = new THREE.Vector2(0, 0);
  private throttle = 0.0; // 0 to 1
  private isWarping = false;
  private warpProgress = 0.0;
  private warpOrigin = new THREE.Vector3();
  private warpDestination = new THREE.Vector3();
  private warpStreaksMesh!: THREE.LineSegments;
  private cockpitShake = 0.0;

  // Simulation & Ephemeris Time
  private clock = new THREE.Clock();
  private timeMultiplier = 1.0;
  private isPaused = false;
  private simulatedDays = 0;
  private currentJulianDate: number = dateToJulianDate(new Date());
  private isLiveEphemeris: boolean = true;
  private timeRateDaysPerSec: number = 2.0;

  // Display mode
  private isOrreryScale = true; // true = readable interactive view, false = true proportional

  // Render loop control
  private animFrameId = 0;
  private isDisposed = false;

  // Background stars & Asteroid Belt
  private starfieldMesh!: THREE.InstancedMesh;
  private asteroidBeltMesh?: THREE.InstancedMesh;

  // Central star light
  private centralStarLight!: THREE.PointLight;
  private centralStarMesh!: THREE.Mesh;

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Detect software WebGL guard
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Setup Three.js Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712); // Deep cosmic void
    this.scene.fog = new THREE.FogExp2(0x030712, 0.0018);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    this.camera.position.set(0, 55, 110);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 3. Environment Map with PMREMGenerator
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch (e) {
      console.warn('RoomEnvironment setup error:', e);
    }

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 600;
    this.controls.maxPolarAngle = Math.PI * 0.95;

    this.controls.addEventListener('start', () => {
      // User manual rotation detaches automatic camera lock
      if (this.cameraTransitionProgress >= 0.95) {
        this.isTrackingTarget = false;
      }
    });

    // 5. Lighting Rig
    this.setupLighting();

    // 6. Deep Space Starfield & Nebulae
    this.setupStarfield();

    // 6b. Starship Cockpit Warp Streaks
    this.setupWarpStreaks();

    // 6c. Asteroid Belt Instanced Geometry
    this.setupAsteroidBelt();

    // 7. Populate Solar System & Exoplanets
    this.buildCatalogObjects();

    // 8. Event Listeners
    window.addEventListener('resize', this.onWindowResize);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);

    // 9. Start Lossless Render Loop
    this.startLoop();
  }

  private setupLighting() {
    // Central point light from host star (Sun)
    this.centralStarLight = new THREE.PointLight(0xfff7ed, 4.0, 500, 1.2);
    this.centralStarLight.position.set(0, 0, 0);
    this.scene.add(this.centralStarLight);

    // Ambient cosmic fill - deep indigo/nebula tint
    const hemiLight = new THREE.HemisphereLight(0x1e1b4b, 0x020617, 0.45);
    this.scene.add(hemiLight);

    // Subtle directional key light for specular highlights on dark sides
    const dirKey = new THREE.DirectionalLight(0xffffff, 0.3);
    dirKey.position.set(30, 40, 20);
    this.scene.add(dirKey);
  }

  private setupStarfield() {
    const starCount = this.isSoftwareGl ? 1500 : 3500;
    const geometry = new THREE.SphereGeometry(0.3, 4, 4);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    this.starfieldMesh = new THREE.InstancedMesh(geometry, material, starCount);
    const dummy = new THREE.Object3D();
    const starColors = [
      new THREE.Color('#ffffff'), // Class A/F white
      new THREE.Color('#93c5fd'), // Class O/B blue giant
      new THREE.Color('#fef08a'), // Class G yellow
      new THREE.Color('#f97316'), // Class K orange
      new THREE.Color('#f87171'), // Class M red dwarf
    ];

    for (let i = 0; i < starCount; i++) {
      // Distribute stars on a large spherical shell
      const radius = 350 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      dummy.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      const scale = 0.4 + Math.random() * 1.8;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      this.starfieldMesh.setMatrixAt(i, dummy.matrix);

      const color = starColors[Math.floor(Math.random() * starColors.length)];
      this.starfieldMesh.setColorAt(i, color);
    }

    this.starfieldMesh.instanceMatrix.needsUpdate = true;
    if (this.starfieldMesh.instanceColor) {
      this.starfieldMesh.instanceColor.needsUpdate = true;
    }
    this.scene.add(this.starfieldMesh);

    // Add gentle distant volumetric nebula dust clouds
    const dustCount = 8;
    for (let j = 0; j < dustCount; j++) {
      const dustGeo = new THREE.DodecahedronGeometry(45 + j * 12, 1);
      const dustMat = new THREE.MeshBasicMaterial({
        color: j % 2 === 0 ? 0x312e81 : 0x431407,
        wireframe: false,
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
        side: THREE.BackSide,
      });
      const dustMesh = new THREE.Mesh(dustGeo, dustMat);
      dustMesh.position.set((j - 4) * 80, (j % 3 - 1) * 60, (j % 2 === 0 ? -1 : 1) * 200);
      dustMesh.rotation.set(j * 0.4, j * 0.8, 0);
      this.scene.add(dustMesh);
    }
  }

  // Setup Starship Cockpit Warp Streaks
  private setupWarpStreaks() {
    const streakCount = 350;
    const streakGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(streakCount * 6);

    for (let i = 0; i < streakCount; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = (Math.random() - 0.5) * 40;
      const z = -Math.random() * 80 - 4;
      const len = 1.2 + Math.random() * 2.8;

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;

      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z - len;
    }

    streakGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const streakMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });

    this.warpStreaksMesh = new THREE.LineSegments(streakGeo, streakMat);
    this.warpStreaksMesh.frustumCulled = false;
    this.camera.add(this.warpStreaksMesh);
    this.scene.add(this.camera);
  }

  // Setup Main Asteroid Belt (Instanced between Mars and Jupiter)
  private setupAsteroidBelt() {
    const asteroidCount = this.isSoftwareGl ? 600 : 1200;
    const geo = new THREE.DodecahedronGeometry(0.12, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.88,
      metalness: 0.12,
    });

    this.asteroidBeltMesh = new THREE.InstancedMesh(geo, mat, asteroidCount);
    const dummy = new THREE.Object3D();
    const colors = [
      new THREE.Color('#78716c'),
      new THREE.Color('#a8a29e'),
      new THREE.Color('#57534e'),
      new THREE.Color('#44403c'),
      new THREE.Color('#a16207'),
      new THREE.Color('#71717a'),
    ];

    for (let i = 0; i < asteroidCount; i++) {
      // Semi-major axis between 2.1 AU and 3.3 AU, scaled to display units (23 to 31.5)
      const dist = 23.0 + Math.random() * 8.5;
      const angle = Math.random() * Math.PI * 2;
      const incVariance = (Math.random() - 0.5) * 2.2; // Vertical thickness
      const eccentricityOffset = (Math.random() - 0.5) * 1.5;

      const x = Math.cos(angle) * (dist + eccentricityOffset);
      const z = Math.sin(angle) * (dist + eccentricityOffset);
      const y = incVariance;

      dummy.position.set(x, y, z);
      const scale = 0.35 + Math.random() * 1.5;
      dummy.scale.set(scale, scale * (0.8 + Math.random() * 0.4), scale);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.updateMatrix();

      this.asteroidBeltMesh.setMatrixAt(i, dummy.matrix);
      this.asteroidBeltMesh.setColorAt(i, colors[Math.floor(Math.random() * colors.length)]);
    }

    this.asteroidBeltMesh.instanceMatrix.needsUpdate = true;
    if (this.asteroidBeltMesh.instanceColor) {
      this.asteroidBeltMesh.instanceColor.needsUpdate = true;
    }
    this.scene.add(this.asteroidBeltMesh);
  }

  // Build all procedural 3D bodies
  private buildCatalogObjects() {
    // 1. Build Solar System
    SOLAR_SYSTEM_BODIES.forEach((body) => {
      this.createCelestialObject(body);
    });

    // 2. Build Exoplanets
    EXOPLANETS_CATALOG.forEach((body) => {
      this.createCelestialObject(body);
    });

    this.updateVisibleCategory();
  }

  // Composite 3–12 Part Procedural Model Builder
  private createCelestialObject(body: CelestialBody) {
    const pivotGroup = new THREE.Group();
    pivotGroup.name = `orbit_pivot_${body.id}`;
    this.scene.add(pivotGroup);

    const axialGroup = new THREE.Group();
    axialGroup.name = `axial_tilt_${body.id}`;
    // Set axial tilt
    axialGroup.rotation.z = THREE.MathUtils.degToRad(body.axialTiltDeg);
    pivotGroup.add(axialGroup);

    // Keplerian Elements & Display Orbit Scaling
    const keplerianElements: KeplerianElements | undefined =
      NASA_JPL_PLANETARY_ELEMENTS[body.id] ||
      (body.eccentricity !== undefined && body.distanceAU > 0
        ? {
            a: body.distanceAU,
            e: body.eccentricity,
            i: body.inclinationDeg ?? 0,
            L: Math.random() * 360,
            longPeri: Math.random() * 360,
            longNode: Math.random() * 360,
            orbitalPeriodDays: body.orbitalPeriodDays,
          }
        : undefined);

    const orbitScaleFactor =
      body.distanceAU > 0 && body.displayOrbitDistance > 0
        ? body.displayOrbitDistance / body.distanceAU
        : 18.5;

    // Initial position along orbit
    if (keplerianElements) {
      const state = calculateKeplerianPosition(keplerianElements, this.currentJulianDate);
      axialGroup.position.set(
        state.posAU.x * orbitScaleFactor,
        state.posAU.y * orbitScaleFactor,
        state.posAU.z * orbitScaleFactor
      );
    } else {
      const initialAngle = Math.random() * Math.PI * 2;
      axialGroup.position.set(
        Math.cos(initialAngle) * body.displayOrbitDistance,
        0,
        Math.sin(initialAngle) * body.displayOrbitDistance
      );
    }

    // Texture selection
    const surfaceTexture = this.resolveSurfaceTexture(body);
    const bumpMap = ProceduralTextureFactory.getBumpMap(body.id, body.roughness);

    // Main Body Sphere
    const sphereGeo = new THREE.SphereGeometry(body.displayRadius, 48, 48);
    let bodyMat: THREE.Material;

    if (body.type === 'Star') {
      // Incandescent star emissive material
      bodyMat = new THREE.MeshBasicMaterial({
        map: surfaceTexture,
        color: new THREE.Color(body.surfaceColorHex),
      });
    } else {
      bodyMat = new THREE.MeshStandardMaterial({
        map: surfaceTexture,
        bumpMap: bumpMap,
        bumpScale: 0.04,
        roughness: body.roughness,
        metalness: body.metalness,
        emissive: body.emissiveColorHex ? new THREE.Color(body.emissiveColorHex) : new THREE.Color(0x000000),
        emissiveIntensity: body.emissiveColorHex ? 0.8 : 0.0,
      });
    }

    const bodyMesh = new THREE.Mesh(sphereGeo, bodyMat);
    bodyMesh.name = body.id;
    (bodyMesh as any).celestialBodyData = body;
    axialGroup.add(bodyMesh);
    this.interactiveMeshes.push(bodyMesh);

    if (body.type === 'Star') {
      this.centralStarMesh = bodyMesh;
    }

    // Part 2: Solar Flares & Corona (for Sun)
    const solarFlares: THREE.Mesh[] = [];
    if (body.type === 'Star') {
      // Corona glow billboard
      const coronaGeo = new THREE.SphereGeometry(body.displayRadius * 1.15, 32, 32);
      const coronaMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
      axialGroup.add(coronaMesh);

      // Solar flare prominence loops using TubeGeometry
      for (let f = 0; f < 5; f++) {
        const angle = (f / 5) * Math.PI * 2;
        const curve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(Math.cos(angle) * body.displayRadius * 0.95, Math.sin(angle) * body.displayRadius * 0.95, 0),
          new THREE.Vector3(Math.cos(angle) * body.displayRadius * 1.5, Math.sin(angle) * body.displayRadius * 1.5, 0.8),
          new THREE.Vector3(Math.cos(angle + 0.3) * body.displayRadius * 1.5, Math.sin(angle + 0.3) * body.displayRadius * 1.5, -0.8),
          new THREE.Vector3(Math.cos(angle + 0.35) * body.displayRadius * 0.95, Math.sin(angle + 0.35) * body.displayRadius * 0.95, 0)
        );
        const flareGeo = new THREE.TubeGeometry(curve, 20, 0.12, 8, false);
        const flareMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
        });
        const flareMesh = new THREE.Mesh(flareGeo, flareMat);
        axialGroup.add(flareMesh);
        solarFlares.push(flareMesh);
      }
    }

    // Part 3: Atmosphere Glow Scattering Shell
    let atmosphereMesh: THREE.Mesh | undefined;
    if (body.hasAtmosphere && body.type !== 'Star') {
      const atmoScale = body.atmosphereScale || 1.05;
      const atmoGeo = new THREE.SphereGeometry(body.displayRadius * atmoScale, 36, 36);
      const atmoMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(body.atmosphereGlowColorHex || '#38bdf8'),
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      });
      atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
      axialGroup.add(atmosphereMesh);
    }

    // Part 4: Dynamic Rotating Cloud Layer
    let cloudMesh: THREE.Mesh | undefined;
    if (body.hasClouds) {
      const cloudGeo = new THREE.SphereGeometry(body.displayRadius * 1.018, 40, 40);
      const cloudTexture = ProceduralTextureFactory.getCloudsTexture(body.cloudColorHex || '#ffffff');
      const cloudMat = new THREE.MeshStandardMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        roughness: 0.8,
      });
      cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      axialGroup.add(cloudMesh);
    }

    // Part 5: Rings System (Saturn, Uranus, Exoplanets)
    let ringMesh: THREE.Mesh | undefined;
    if (body.hasRings && body.ringData) {
      const ringGeo = new THREE.RingGeometry(body.ringData.innerRadius, body.ringData.outerRadius, 64);
      const ringTexture = ProceduralTextureFactory.getRingTexture(body.ringData.colorHex);

      // Rotate ring geometry to lie flat in equator plane
      ringGeo.rotateX(Math.PI / 2);

      const ringMat = new THREE.MeshStandardMaterial({
        map: ringTexture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: body.ringData.opacity,
        roughness: 0.6,
        metalness: 0.1,
      });

      ringMesh = new THREE.Mesh(ringGeo, ringMat);
      axialGroup.add(ringMesh);
    }

    // Part 6: Moons Sub-System
    const moonObjects: { data: MoonData; pivot: THREE.Group; mesh: THREE.Mesh }[] = [];
    if (body.moons && body.moons.length > 0) {
      body.moons.forEach((m) => {
        const moonPivot = new THREE.Group();
        moonPivot.name = `moon_pivot_${m.id}`;
        axialGroup.add(moonPivot);

        const moonRadius = Math.max(0.2, (m.radiusKm / body.radiusKm) * body.displayRadius * 1.5);
        const moonGeo = new THREE.SphereGeometry(moonRadius, 24, 24);
        const moonTex = ProceduralTextureFactory.getCrateredTexture(150, 40);
        const moonMat = new THREE.MeshStandardMaterial({
          map: moonTex,
          color: new THREE.Color(m.colorHex),
          roughness: 0.85,
          metalness: 0.1,
        });

        const moonMesh = new THREE.Mesh(moonGeo, moonMat);
        moonMesh.position.set(m.orbitRadius, 0, 0);
        moonMesh.name = m.id;
        (moonMesh as any).moonData = m;
        (moonMesh as any).parentBody = body;
        moonPivot.add(moonMesh);
        this.interactiveMeshes.push(moonMesh);

        // Subtle moon orbit ring
        const moonOrbitGeo = new THREE.BufferGeometry();
        const pts: THREE.Vector3[] = [];
        for (let a = 0; a <= 64; a++) {
          const theta = (a / 64) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(theta) * m.orbitRadius, 0, Math.sin(theta) * m.orbitRadius));
        }
        moonOrbitGeo.setFromPoints(pts);
        const moonOrbitLine = new THREE.LineLoop(
          moonOrbitGeo,
          new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.3 })
        );
        axialGroup.add(moonOrbitLine);

        moonObjects.push({ data: m, pivot: moonPivot, mesh: moonMesh });
      });
    }

    // Part 7: Planetary Orbit Line (Exact 3D Keplerian Parametric Curve)
    let orbitLine: THREE.LineLoop | undefined;
    if (body.displayOrbitDistance > 0) {
      const orbitGeo = new THREE.BufferGeometry();
      let orbitPoints: THREE.Vector3[] = [];

      if (keplerianElements) {
        // True 3D Parametric Keplerian Curve with real eccentricity, inclination, and perihelion
        orbitPoints = generateKeplerianOrbitCurve(keplerianElements, orbitScaleFactor, 128);
      } else {
        const segments = 128;
        for (let s = 0; s <= segments; s++) {
          const theta = (s / segments) * Math.PI * 2;
          orbitPoints.push(
            new THREE.Vector3(
              Math.cos(theta) * body.displayOrbitDistance,
              0,
              Math.sin(theta) * body.displayOrbitDistance
            )
          );
        }
      }

      orbitGeo.setFromPoints(orbitPoints);
      orbitLine = new THREE.LineLoop(
        orbitGeo,
        new THREE.LineBasicMaterial({
          color: body.isAsteroid ? 0xa8a29e : body.category === 'solar' ? 0x334155 : 0x4f46e5,
          transparent: true,
          opacity: body.isAsteroid ? 0.35 : 0.45,
        })
      );
      this.scene.add(orbitLine);
    }

    this.bodiesMap.set(body.id, {
      data: body,
      pivotGroup,
      axialGroup,
      bodyMesh,
      atmosphereMesh,
      cloudMesh,
      ringMesh,
      orbitLine,
      keplerianElements,
      orbitScaleFactor,
      moonObjects,
      solarFlares,
    });
  }

  private resolveSurfaceTexture(body: CelestialBody): THREE.CanvasTexture {
    switch (body.texturePattern) {
      case 'sun_plasma':
        return ProceduralTextureFactory.getSunTexture();
      case 'earth_biosphere':
        return ProceduralTextureFactory.getEarthTexture();
      case 'mercury_craters':
        return ProceduralTextureFactory.getCrateredTexture(140, 60);
      case 'moon_craters':
        return ProceduralTextureFactory.getCrateredTexture(160, 45);
      case 'venus_clouds':
        return ProceduralTextureFactory.getSpeculativeTexture('band', '#d97706', '#b45309');
      case 'mars_rusty':
        return ProceduralTextureFactory.getMarsTexture();
      case 'jupiter_bands':
        return ProceduralTextureFactory.getJupiterTexture();
      case 'saturn_bands':
        return ProceduralTextureFactory.getSaturnTexture();
      case 'uranus_ice':
        return ProceduralTextureFactory.getIceGiantTexture(false);
      case 'neptune_storm':
        return ProceduralTextureFactory.getIceGiantTexture(true);
      case 'pluto_nitrogen':
        return ProceduralTextureFactory.getSpeculativeTexture('crater', '#c2b69d', '#8b684c');
      case 'trappist_ocean':
        return ProceduralTextureFactory.getSpeculativeTexture('ocean', '#0284c7', '#991b1b');
      case 'kepler_waterworld':
        return ProceduralTextureFactory.getSpeculativeTexture('ocean', '#0d9488', '#0284c7');
      case 'cancri_lava':
        return ProceduralTextureFactory.getSpeculativeTexture('lava_fissure', '#7f1d1d', '#f59e0b', '#ea580c');
      case 'wasp_hotjupiter':
        return ProceduralTextureFactory.getSpeculativeTexture('band', '#18181b', '#b91c1c', '#dc2626');
      case 'proxima_rock':
        return ProceduralTextureFactory.getSpeculativeTexture('crater', '#a16207', '#451a03');
      case 'hd189733_cobalt':
        return ProceduralTextureFactory.getSpeculativeTexture('band', '#1d4ed8', '#0284c7');
      case 'pulsar_neutron':
        return ProceduralTextureFactory.getSpeculativeTexture('lava_fissure', '#6b21a8', '#0f172a', '#a855f7');
      default:
        return ProceduralTextureFactory.getSpeculativeTexture(
          'rock',
          body.surfaceColorHex,
          body.secondaryColorHex,
          body.emissiveColorHex
        );
    }
  }

  // Add dynamically created speculative exoplanet from Gemini
  public addSpeculativeExoplanet(spec: any) {
    const id = `speculative_${Date.now()}`;
    const newBody: CelestialBody = {
      id,
      name: spec.name,
      type: 'Exoplanet',
      category: 'custom',
      parentStar: spec.parentStar || 'Alien Star',
      systemName: `${spec.name} System`,
      radiusKm: spec.radiusKm || 12000,
      massEarths: spec.massEarths || 3.5,
      distanceAU: spec.distanceAU || 1.2,
      orbitalPeriodDays: spec.orbitalPeriodDays || 340,
      rotationPeriodHours: 28,
      axialTiltDeg: 12,
      temperatureK: spec.temperatureK || 310,
      surfaceGravityG: 1.3,
      atmosphere: spec.atmosphere || 'Dense nitrogen-oxygen blend',
      moonsCount: 0,
      displayRadius: Math.min(3.5, Math.max(1.2, (spec.radiusKm || 12000) / 7000)),
      displayOrbitDistance: 28.0,
      surfaceColorHex: spec.surfaceColorHex || '#10b981',
      secondaryColorHex: spec.secondaryColorHex || '#065f46',
      emissiveColorHex: spec.emissiveColorHex || '#000000',
      roughness: 0.5,
      metalness: 0.15,
      texturePattern: 'generic_speculative',
      hasAtmosphere: true,
      atmosphereGlowColorHex: spec.cloudColorHex || '#34d399',
      atmosphereScale: 1.06,
      hasClouds: (spec.cloudDensity ?? 0.5) > 0.2,
      cloudColorHex: spec.cloudColorHex || '#ffffff',
      cloudSpeedFactor: 1.2,
      hasRings: !!spec.hasRings,
      ringData: spec.hasRings
        ? {
            innerRadius: (spec.ringInnerRatio || 1.4) * 2.2,
            outerRadius: (spec.ringOuterRatio || 2.4) * 2.2,
            colorHex: spec.ringColorHex || '#fbbf24',
            opacity: 0.7,
          }
        : undefined,
      tagline: spec.nickname || spec.overview,
      scientificHighlights: [
        spec.surfaceLore || 'Spectroscopy reveals unique atmospheric chemistry.',
        spec.habitabilityVerdict || 'Habitability index under analysis.',
        `Equilibrium temperature: ${spec.temperatureK} K (${Math.round((spec.temperatureK || 300) - 273.15)}°C).`,
      ],
      audioFrequencyHz: 330,
    };

    this.createCelestialObject(newBody);
    this.setActiveCategory('custom');
    this.focusOnBody(id);
    return newBody;
  }

  // Switch between Solar System, Exoplanets, and Custom worlds
  public setActiveCategory(category: 'solar' | 'exoplanet' | 'custom') {
    this.activeCategory = category;
    this.updateVisibleCategory();

    // Adjust central star lighting and appearance
    if (category === 'solar') {
      this.centralStarLight.color.setHex(0xfff7ed);
      if (this.centralStarMesh) {
        (this.centralStarMesh.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
      }
    } else if (category === 'exoplanet') {
      // Exoplanet host star defaults to a deep orange-red / azure tint
      this.centralStarLight.color.setHex(0xfeb272);
      if (this.centralStarMesh) {
        (this.centralStarMesh.material as THREE.MeshBasicMaterial).color.setHex(0xea580c);
      }
    }

    // Default camera reset
    this.resetCameraView();
  }

  private updateVisibleCategory() {
    this.bodiesMap.forEach((obj, bodyId) => {
      const isVisible =
        obj.data.category === this.activeCategory ||
        (bodyId === 'sun' && (this.activeCategory === 'solar' || this.activeCategory === 'exoplanet'));

      obj.pivotGroup.visible = isVisible;
      if (obj.orbitLine) {
        obj.orbitLine.visible = isVisible;
      }
    });

    if (this.asteroidBeltMesh) {
      this.asteroidBeltMesh.visible = this.activeCategory === 'solar';
    }
  }

  // Smooth camera transition to target body
  public focusOnBody(bodyId: string) {
    const targetObj = this.bodiesMap.get(bodyId);
    if (!targetObj) return;

    this.selectedBodyId = bodyId;
    this.callbacks.onSelectBody(targetObj.data);

    // Compute target position in world space
    const targetWorldPos = new THREE.Vector3();
    targetObj.axialGroup.getWorldPosition(targetWorldPos);

    this.controlsTargetPos.copy(targetWorldPos);

    // Position camera slightly offset and elevated
    const offsetDistance = Math.max(3.5, targetObj.data.displayRadius * 3.8);
    this.cameraTargetPos.set(
      targetWorldPos.x + offsetDistance * 0.8,
      targetWorldPos.y + offsetDistance * 0.5,
      targetWorldPos.z + offsetDistance * 1.1
    );

    this.isTrackingTarget = true;
    this.cameraTransitionProgress = 0.0;
  }

  public resetCameraView() {
    this.selectedBodyId = null;
    this.callbacks.onSelectBody(null);
    this.isTrackingTarget = false;

    this.controlsTargetPos.set(0, 0, 0);
    this.cameraTargetPos.set(0, 50, 110);
    this.cameraTransitionProgress = 0.0;
  }

  // Pointer Interaction (Raycasting)
  private onPointerMove = (e: MouseEvent) => {
    const now = performance.now();
    if (now - this.lastPointerMoveTime < 24) return; // throttle raycasting
    this.lastPointerMoveTime = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const bodyData: CelestialBody = (hit as any).celestialBodyData;
      if (bodyData && bodyData.id !== this.hoveredBodyId) {
        this.hoveredBodyId = bodyData.id;
        this.callbacks.onHoverBody(bodyData);
        this.container.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredBodyId !== null) {
        this.hoveredBodyId = null;
        this.callbacks.onHoverBody(null);
        this.container.style.cursor = 'grab';
      }
    }
  };

  private onPointerDown = (e: MouseEvent) => {
    // Only handle primary click
    if (e.button !== 0) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const bodyData: CelestialBody = (hit as any).celestialBodyData;
      if (bodyData) {
        this.focusOnBody(bodyData.id);
      }
    }
  };

  private onWindowResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  // Simulation Controls
  public setTimeMultiplier(factor: number) {
    this.timeMultiplier = factor;
  }

  public togglePause(): boolean {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  public setOrreryScale(isOrrery: boolean) {
    this.isOrreryScale = isOrrery;
    this.bodiesMap.forEach((obj) => {
      const scale = isOrrery ? 1.0 : 0.45;
      obj.axialGroup.scale.set(scale, scale, scale);
    });
  }

  // Starship Cockpit Pilot View Controls & Camera Transformation
  public enterCockpitMode(targetBodyId?: string) {
    this.isCockpitMode = true;
    this.targetFov = this.cockpitFov; // Perspective transformation to wide-angle 78deg
    this.controls.enabled = false;
    this.isTrackingTarget = false;

    if (targetBodyId) {
      this.selectedBodyId = targetBodyId;
    } else if (!this.selectedBodyId) {
      this.selectedBodyId = this.bodiesMap.has('earth') ? 'earth' : Array.from(this.bodiesMap.keys())[1] || 'sun';
    }

    const targetObj = this.selectedBodyId ? this.bodiesMap.get(this.selectedBodyId) : null;
    if (targetObj) {
      const targetPos = new THREE.Vector3();
      targetObj.axialGroup.getWorldPosition(targetPos);
      const dist = Math.max(12, targetObj.data.displayRadius * 6);
      this.shipPosition.set(targetPos.x + dist * 0.7, targetPos.y + dist * 0.35, targetPos.z + dist * 0.9);
      this.shipForward.subVectors(targetPos, this.shipPosition).normalize();
    } else {
      this.shipPosition.set(0, 15, 60);
      this.shipForward.set(0, -0.1, -1).normalize();
    }

    this.camera.position.copy(this.shipPosition);
    this.camera.lookAt(this.shipPosition.clone().add(this.shipForward));

    if (this.warpStreaksMesh) {
      (this.warpStreaksMesh.material as THREE.LineBasicMaterial).opacity = 0.35;
    }
  }

  public exitCockpitMode() {
    this.isCockpitMode = false;
    this.targetFov = this.normalFov; // Perspective returns to 45deg
    this.controls.enabled = true;
    this.isWarping = false;
    this.throttle = 0.0;

    if (this.warpStreaksMesh) {
      (this.warpStreaksMesh.material as THREE.LineBasicMaterial).opacity = 0.0;
    }

    if (this.selectedBodyId) {
      this.focusOnBody(this.selectedBodyId);
    } else {
      this.resetCameraView();
    }
  }

  public isCockpitActive(): boolean {
    return this.isCockpitMode;
  }

  public setThrottle(val: number) {
    this.throttle = Math.max(0, Math.min(1, val));
  }

  public setPilotSteering(pitchDelta: number, yawDelta: number) {
    this.pilotMouseLook.x = THREE.MathUtils.clamp(this.pilotMouseLook.x + yawDelta, -0.85, 0.85);
    this.pilotMouseLook.y = THREE.MathUtils.clamp(this.pilotMouseLook.y + pitchDelta, -0.65, 0.65);
  }

  public engageHyperdrive(targetBodyId?: string) {
    if (targetBodyId) {
      this.selectedBodyId = targetBodyId;
    }
    const targetObj = this.selectedBodyId ? this.bodiesMap.get(this.selectedBodyId) : null;
    if (!targetObj) return;

    this.isWarping = true;
    this.warpProgress = 0.0;
    this.throttle = 1.0;
    this.warpOrigin.copy(this.shipPosition);

    const targetPos = new THREE.Vector3();
    targetObj.axialGroup.getWorldPosition(targetPos);
    const approachDist = Math.max(4.5, targetObj.data.displayRadius * 3.5);
    const approachDir = new THREE.Vector3().subVectors(this.warpOrigin, targetPos).normalize();
    this.warpDestination.copy(targetPos).add(approachDir.multiplyScalar(approachDist));
  }

  // Animation & Lossless Pacing Loop
  private startLoop() {
    const tick = () => {
      if (this.isDisposed) return;

      const delta = Math.min(0.1, this.clock.getDelta());

      // Perspective Camera FOV interpolation (damped transformation)
      if (Math.abs(this.camera.fov - (this.isWarping ? 88 : this.targetFov)) > 0.1) {
        this.camera.fov = THREE.MathUtils.damp(
          this.camera.fov,
          this.isWarping ? 88 : this.targetFov,
          6,
          delta
        );
        this.camera.updateProjectionMatrix();
      }

      // Ephemeris Time & Keplerian Orbital Mechanics Update
      if (this.isLiveEphemeris) {
        this.currentJulianDate = dateToJulianDate(new Date());
      } else if (!this.isPaused) {
        const stepDays = delta * this.timeRateDaysPerSec * this.timeMultiplier;
        this.currentJulianDate += stepDays;
        this.simulatedDays += stepDays;
      }

      const calendarDate = julianDateToDate(this.currentJulianDate);
      const ephemerisData: EphemerisTimeData = {
        julianDate: this.currentJulianDate,
        calendarDate,
        dateString: calendarDate.toUTCString(),
        isLive: this.isLiveEphemeris,
        timeRateDaysPerSec: this.isLiveEphemeris ? 1 / 86400 : this.timeRateDaysPerSec * this.timeMultiplier,
      };
      this.callbacks.onTimeUpdate(this.simulatedDays, ephemerisData);

      // Rotate Asteroid Belt
      if (this.asteroidBeltMesh && this.activeCategory === 'solar') {
        const beltSpeed = (this.isLiveEphemeris ? 0.002 : delta * 0.02 * this.timeMultiplier) * (this.isPaused ? 0 : 1);
        this.asteroidBeltMesh.rotation.y += beltSpeed;
      }

      this.bodiesMap.forEach((obj) => {
        if (!obj.pivotGroup.visible) return;

        // 1. Orbital position calculation
        if (obj.keplerianElements) {
          // Precise Keplerian orbital mechanics position computed from current Julian date
          const state = calculateKeplerianPosition(obj.keplerianElements, this.currentJulianDate);
          obj.axialGroup.position.set(
            state.posAU.x * obj.orbitScaleFactor,
            state.posAU.y * obj.orbitScaleFactor,
            state.posAU.z * obj.orbitScaleFactor
          );
        } else if (!this.isPaused && obj.data.orbitalPeriodDays > 0 && obj.data.displayOrbitDistance > 0) {
          // Fallback circular revolution
          const orbitSpeed = ((delta * 15 * this.timeMultiplier) / obj.data.orbitalPeriodDays) * (Math.PI * 2);
          obj.pivotGroup.rotation.y += orbitSpeed;
        }

        // 2. Axial self-rotation
        if (!this.isPaused || this.isLiveEphemeris) {
          const rotMult = this.isLiveEphemeris ? 1 : this.timeMultiplier;
          const rotSpeed = (delta * 2.5 * rotMult) / Math.max(1, Math.abs(obj.data.rotationPeriodHours));
          obj.bodyMesh.rotation.y += obj.data.rotationPeriodHours < 0 ? -rotSpeed : rotSpeed;

          // 3. Clouds differential rotation
          if (obj.cloudMesh) {
            obj.cloudMesh.rotation.y += rotSpeed * (obj.data.cloudSpeedFactor || 1.2);
          }
        }

        // 4. Moons revolution
        if (obj.moonObjects && obj.moonObjects.length > 0 && (!this.isPaused || this.isLiveEphemeris)) {
          const moonMult = this.isLiveEphemeris ? 1 : this.timeMultiplier;
          obj.moonObjects.forEach((m) => {
            m.pivot.rotation.y += delta * (1.5 / m.data.orbitPeriod) * moonMult;
          });
        }

        // 5. Solar flares subtle oscillation
        if (obj.solarFlares && obj.solarFlares.length > 0) {
          const t = this.clock.getElapsedTime();
          obj.solarFlares.forEach((flare, idx) => {
            flare.rotation.z = Math.sin(t * 1.5 + idx) * 0.08;
          });
        }
      });

      // Starship Cockpit Navigation & Perspective Transformation Loop
      if (this.isCockpitMode) {
        const targetObj = this.selectedBodyId ? this.bodiesMap.get(this.selectedBodyId) : null;
        const targetWorldPos = new THREE.Vector3();
        if (targetObj) {
          targetObj.axialGroup.getWorldPosition(targetWorldPos);
        }

        if (this.isWarping) {
          this.warpProgress += delta * 0.45;
          const p = Math.min(1.0, this.warpProgress);
          // Smooth cubic warp acceleration
          const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          this.shipPosition.lerpVectors(this.warpOrigin, this.warpDestination, ease);
          this.cockpitShake = Math.sin(this.clock.getElapsedTime() * 45) * 0.06 * (1 - p);

          if (this.warpStreaksMesh) {
            (this.warpStreaksMesh.material as THREE.LineBasicMaterial).opacity = 0.9;
          }

          if (this.warpProgress >= 1.0) {
            this.isWarping = false;
            this.warpProgress = 1.0;
            this.throttle = 0.15;
          }
        } else {
          // Sub-light cruise flight
          if (this.throttle > 0 && targetObj) {
            const dirToTarget = new THREE.Vector3().subVectors(targetWorldPos, this.shipPosition).normalize();
            const cruiseSpeed = this.throttle * 30 * delta;
            this.shipPosition.addScaledVector(dirToTarget, cruiseSpeed);
            this.cockpitShake = Math.sin(this.clock.getElapsedTime() * 25) * 0.015 * this.throttle;
          } else {
            this.cockpitShake = 0.0;
          }

          if (this.warpStreaksMesh) {
            (this.warpStreaksMesh.material as THREE.LineBasicMaterial).opacity = 0.2 + this.throttle * 0.5;
          }
        }

        // Set camera at cockpit bridge with vibration
        this.camera.position.copy(this.shipPosition);
        this.camera.position.y += this.cockpitShake;
        this.camera.position.x += this.cockpitShake * 0.5;

        // Camera orientation towards target with pilot mouse sway
        if (targetObj) {
          const lookPos = targetWorldPos.clone();
          lookPos.x += this.pilotMouseLook.x * 20;
          lookPos.y += this.pilotMouseLook.y * 20;
          this.camera.lookAt(lookPos);
          this.shipForward.subVectors(targetWorldPos, this.shipPosition).normalize();

          // Project target to screen coordinate (0 to 100%) for HUD reticle
          const projected = targetWorldPos.clone().project(this.camera);
          const screenX = ((projected.x + 1) / 2) * 100;
          const screenY = ((-projected.y + 1) / 2) * 100;
          const isVisible = projected.z < 1 && screenX >= -10 && screenX <= 110 && screenY >= -10 && screenY <= 110;

          // Distance calculation
          const distUnits = this.shipPosition.distanceTo(targetWorldPos);
          const distAU = distUnits / 18.5;
          const distKm = Math.round(distAU * 149597870);
          const speedKmS = this.isWarping ? 299792 : Math.round(this.throttle * 5200);

          // Calculate heading angle in degrees
          const headingDeg = Math.round(
            ((Math.atan2(this.shipForward.x, this.shipForward.z) * 180) / Math.PI + 360) % 360
          );

          this.callbacks.onFlightTelemetry?.({
            inCockpit: true,
            throttle: this.throttle,
            speedKmS,
            distanceToTargetAU: parseFloat(distAU.toFixed(3)),
            distanceKm: distKm,
            isWarping: this.isWarping,
            targetBodyName: targetObj.data.name,
            targetScreenPos: { x: screenX, y: screenY, visible: isVisible },
            shieldStatus: 100,
            headingDeg,
            cockpitFov: Math.round(this.camera.fov),
          });
        }

        // Animate Warp Streaks
        if (this.warpStreaksMesh) {
          const posAttr = this.warpStreaksMesh.geometry.attributes.position as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;
          const warpSpeed = this.isWarping ? 140 : this.throttle * 45 + 3;

          for (let i = 0; i < arr.length; i += 6) {
            arr[i + 2] += warpSpeed * delta;
            arr[i + 5] = arr[i + 2] - (this.isWarping ? 22 : this.throttle * 8 + 1.8);
            if (arr[i + 2] > 6) {
              arr[i + 2] = -85 - Math.random() * 20;
              arr[i + 5] = arr[i + 2] - 2;
            }
          }
          posAttr.needsUpdate = true;
        }
      } else {
        // Standard Orbit Camera mode navigation
        if (this.cameraTransitionProgress < 1.0) {
          this.cameraTransitionProgress += delta * 1.4;
          const alpha = 1 - Math.exp(-6 * delta);

          this.controls.target.lerp(this.controlsTargetPos, alpha);
          this.camera.position.lerp(this.cameraTargetPos, alpha);

          if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.1) {
            this.cameraTransitionProgress = 1.0;
          }
        } else if (this.isTrackingTarget && this.selectedBodyId) {
          const targetObj = this.bodiesMap.get(this.selectedBodyId);
          if (targetObj) {
            const worldPos = new THREE.Vector3();
            targetObj.axialGroup.getWorldPosition(worldPos);

            const deltaOffset = worldPos.clone().sub(this.controls.target);
            this.controls.target.copy(worldPos);
            this.camera.position.add(deltaOffset);
          }
        }

        this.controls.update();
      }

      // Render frame
      this.renderer.render(this.scene, this.camera);

      // Software WebGL pacing guard
      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.animFrameId = requestAnimationFrame(tick);
      }
    };

    tick();
  }

  // Software WebGL pacing helper
  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();

    const poll = () => {
      if (this.isDisposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.animFrameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.animFrameId = window.setTimeout(cb, 80);
      }
    };
    this.animFrameId = window.setTimeout(poll, 5);
  }

  // Ephemeris & Time Control Methods
  public setJulianDate(jd: number) {
    this.currentJulianDate = jd;
    this.isLiveEphemeris = false;
  }

  public setLiveEphemeris(isLive: boolean) {
    this.isLiveEphemeris = isLive;
    if (isLive) {
      this.currentJulianDate = dateToJulianDate(new Date());
    }
  }

  public isLive(): boolean {
    return this.isLiveEphemeris;
  }

  public getJulianDate(): number {
    return this.currentJulianDate;
  }

  public stepTimeDays(days: number) {
    this.isLiveEphemeris = false;
    this.currentJulianDate += days;
  }

  public jumpToDate(date: Date) {
    this.isLiveEphemeris = false;
    this.currentJulianDate = dateToJulianDate(date);
  }

  public jumpToPreset(preset: string) {
    switch (preset) {
      case 'now':
        this.setLiveEphemeris(true);
        break;
      case 'apollo11':
        // Apollo 11 Lunar Landing: July 20, 1969
        this.jumpToDate(new Date('1969-07-20T20:17:40Z'));
        break;
      case 'voyager1':
        // Voyager 1 Launch: Sept 5, 1977
        this.jumpToDate(new Date('1977-09-05T12:56:00Z'));
        break;
      case 'new_horizons':
        // New Horizons Pluto Flyby: July 14, 2015
        this.jumpToDate(new Date('2015-07-14T11:49:57Z'));
        break;
      case 'great_conjunction_2020':
        // Jupiter-Saturn Great Conjunction: Dec 21, 2020
        this.jumpToDate(new Date('2020-12-21T18:20:00Z'));
        break;
      case 'alignment_2030':
        // Solar System alignment: May 15, 2030
        this.jumpToDate(new Date('2030-05-15T00:00:00Z'));
        break;
    }
  }

  public applyNasaExoplanetData(exoplanetsData: any[]) {
    if (!exoplanetsData || !Array.isArray(exoplanetsData)) return;

    exoplanetsData.forEach((exo) => {
      const targetName = (exo.name || '').toLowerCase();
      const bodyEntry = Array.from(this.bodiesMap.values()).find(
        (b) => b.data.name.toLowerCase() === targetName || b.data.id === targetName
      );

      if (bodyEntry && exo.semiMajorAxisAU && exo.eccentricity !== undefined) {
        bodyEntry.keplerianElements = {
          a: exo.semiMajorAxisAU,
          e: exo.eccentricity,
          i: exo.inclinationDeg ?? 85,
          L: Math.random() * 360,
          longPeri: exo.argumentOfPeriastronDeg ?? 0,
          longNode: 0,
          orbitalPeriodDays: exo.orbitalPeriodDays,
        };
        // Re-generate orbit line with true 3D Keplerian curve
        if (bodyEntry.orbitLine) {
          const pts = generateKeplerianOrbitCurve(
            bodyEntry.keplerianElements,
            bodyEntry.orbitScaleFactor,
            128
          );
          bodyEntry.orbitLine.geometry.setFromPoints(pts);
        }
      }
    });
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.animFrameId);

    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);

    this.controls.dispose();
    this.renderer.dispose();

    if (this.container && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
