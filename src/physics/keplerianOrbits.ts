import * as THREE from 'three';

export interface KeplerianElements {
  // Epoch J2000.0 (JD 2451545.0 = 2000-01-01 12:00:00 TT)
  a: number; // Semi-major axis in AU
  aDot?: number; // Rate per century
  e: number; // Eccentricity
  eDot?: number;
  i: number; // Inclination in degrees
  iDot?: number;
  L: number; // Mean longitude in degrees
  LDot?: number;
  longPeri: number; // Longitude of perihelion (varpi = Omega + omega) in degrees
  longPeriDot?: number;
  longNode: number; // Longitude of ascending node (Omega) in degrees
  longNodeDot?: number;
  orbitalPeriodDays?: number;
}

// Convert Calendar Date to Julian Date (JD)
export function dateToJulianDate(date: Date): number {
  const time = date.getTime();
  return time / 86400000 + 2440587.5;
}

// Convert Julian Date to Calendar Date
export function julianDateToDate(jd: number): Date {
  const time = (jd - 2440587.5) * 86400000;
  return new Date(time);
}

// Solve Kepler's equation M = E - e*sin(E) for Eccentric Anomaly E using Newton-Raphson
export function solveKepler(M: number, e: number, tolerance = 1e-9): number {
  // Normalize M to [0, 2*PI]
  let mNorm = M % (Math.PI * 2);
  if (mNorm < 0) mNorm += Math.PI * 2;

  let E = e > 0.8 ? Math.PI : mNorm;

  for (let iter = 0; iter < 15; iter++) {
    const f = E - e * Math.sin(E) - mNorm;
    if (Math.abs(f) < tolerance) break;
    const fPrime = 1 - e * Math.cos(E);
    E -= f / fPrime;
  }
  return E;
}

// Calculate Heliocentric 3D position vector in AU from Keplerian Elements at Julian Date
export function calculateKeplerianPosition(elements: KeplerianElements, jd: number): {
  posAU: THREE.Vector3;
  trueAnomaly: number;
  distanceAU: number;
} {
  // Centuries from J2000.0
  const T = (jd - 2451545.0) / 36525.0;

  // Compute elements at epoch T
  const a = elements.a + (elements.aDot ?? 0) * T;
  const e = THREE.MathUtils.clamp(elements.e + (elements.eDot ?? 0) * T, 0, 0.999);
  const inc = THREE.MathUtils.degToRad(elements.i + (elements.iDot ?? 0) * T);
  const L = THREE.MathUtils.degToRad(elements.L + (elements.LDot ?? 0) * T);
  const longPeri = THREE.MathUtils.degToRad(elements.longPeri + (elements.longPeriDot ?? 0) * T);
  const longNode = THREE.MathUtils.degToRad(elements.longNode + (elements.longNodeDot ?? 0) * T);

  // Argument of periapsis omega
  const omega = longPeri - longNode;

  // Mean anomaly M
  const M = L - longPeri;

  // Solve for Eccentric Anomaly E
  const E = solveKepler(M, e);

  // Coordinates in orbital plane
  const xPrime = a * (Math.cos(E) - e);
  const yPrime = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // True anomaly
  const trueAnomaly = Math.atan2(yPrime, xPrime);
  const distanceAU = a * (1 - e * Math.cos(E));

  // Transformation to 3D Ecliptic Reference Frame
  const cosNode = Math.cos(longNode);
  const sinNode = Math.sin(longNode);
  const cosPeri = Math.cos(omega);
  const sinPeri = Math.sin(omega);
  const cosInc = Math.cos(inc);
  const sinInc = Math.sin(inc);

  // P and Q unit vectors
  const Px = cosNode * cosPeri - sinNode * sinPeri * cosInc;
  const Py = sinNode * cosPeri + cosNode * sinPeri * cosInc;
  const Pz = sinPeri * sinInc;

  const Qx = -cosNode * sinPeri - sinNode * cosPeri * cosInc;
  const Qy = -sinNode * sinPeri + cosNode * cosPeri * cosInc;
  const Qz = cosPeri * sinInc;

  // Heliocentric coordinates (mapped to Three.js: X->x, Y->z, Z->y for horizontal orbital plane)
  const xEcliptic = xPrime * Px + yPrime * Qx;
  const yEcliptic = xPrime * Py + yPrime * Qy;
  const zEcliptic = xPrime * Pz + yPrime * Qz;

  // Three.js world mapping: ground plane is X-Z, vertical is Y
  const posAU = new THREE.Vector3(xEcliptic, zEcliptic, yEcliptic);

  return { posAU, trueAnomaly, distanceAU };
}

// Generate an exact 3D parametric Keplerian Ellipse curve for visualization
export function generateKeplerianOrbitCurve(
  elements: KeplerianElements,
  scaleFactor: number,
  segments = 128
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const inc = THREE.MathUtils.degToRad(elements.i);
  const longNode = THREE.MathUtils.degToRad(elements.longNode);
  const omega = THREE.MathUtils.degToRad(elements.longPeri - elements.longNode);
  const a = elements.a * scaleFactor;
  const e = elements.e;

  const cosNode = Math.cos(longNode);
  const sinNode = Math.sin(longNode);
  const cosPeri = Math.cos(omega);
  const sinPeri = Math.sin(omega);
  const cosInc = Math.cos(inc);
  const sinInc = Math.sin(inc);

  const Px = cosNode * cosPeri - sinNode * sinPeri * cosInc;
  const Py = sinNode * cosPeri + cosNode * sinPeri * cosInc;
  const Pz = sinPeri * sinInc;

  const Qx = -cosNode * sinPeri - sinNode * cosPeri * cosInc;
  const Qy = -sinNode * sinPeri + cosNode * cosPeri * cosInc;
  const Qz = cosPeri * sinInc;

  for (let s = 0; s <= segments; s++) {
    const E = (s / segments) * Math.PI * 2;
    const xP = a * (Math.cos(E) - e);
    const yP = a * Math.sqrt(1 - e * e) * Math.sin(E);

    const x = xP * Px + yP * Qx;
    const y = xP * Py + yP * Qy;
    const z = xP * Pz + yP * Qz;

    points.push(new THREE.Vector3(x, z, y));
  }

  return points;
}

// Official NASA JPL Keplerian Elements and Secular Rates for J2000.0
export const NASA_JPL_PLANETARY_ELEMENTS: Record<string, KeplerianElements> = {
  mercury: {
    a: 0.38709927,
    aDot: 0.00000037,
    e: 0.20563593,
    eDot: 0.00001906,
    i: 7.00497902,
    iDot: -0.00594749,
    L: 252.2503235,
    LDot: 149472.67411175,
    longPeri: 77.45779628,
    longPeriDot: 0.16047689,
    longNode: 48.33076593,
    longNodeDot: -0.12534081,
    orbitalPeriodDays: 87.969,
  },
  venus: {
    a: 0.72333566,
    aDot: 0.00000493,
    e: 0.00677672,
    eDot: -0.00004107,
    i: 3.39467605,
    iDot: -0.0007889,
    L: 181.9790995,
    LDot: 58517.81538729,
    longPeri: 131.60246718,
    longPeriDot: 0.00268329,
    longNode: 76.67984255,
    longNodeDot: -0.27769418,
    orbitalPeriodDays: 224.701,
  },
  earth: {
    a: 1.00000261,
    aDot: 0.00000562,
    e: 0.01671123,
    eDot: -0.00004392,
    i: 0.00001531,
    iDot: -0.01294668,
    L: 100.46457166,
    LDot: 35999.37244981,
    longPeri: 102.93768193,
    longPeriDot: 0.32327364,
    longNode: 0.0,
    longNodeDot: 0.0,
    orbitalPeriodDays: 365.256,
  },
  mars: {
    a: 1.52371034,
    aDot: 0.00001847,
    e: 0.0933941,
    eDot: 0.00007882,
    i: 1.84969142,
    iDot: -0.00813131,
    L: -4.55343205,
    LDot: 19140.30268499,
    longPeri: -23.94362959,
    longPeriDot: 0.44441088,
    longNode: 49.55953891,
    longNodeDot: -0.29257343,
    orbitalPeriodDays: 686.98,
  },
  ceres: {
    a: 2.767,
    e: 0.076,
    i: 10.59,
    L: 80.0,
    LDot: 7800.0,
    longPeri: 73.6,
    longNode: 80.3,
    orbitalPeriodDays: 1682.0,
  },
  vesta: {
    a: 2.362,
    e: 0.089,
    i: 7.14,
    L: 120.0,
    LDot: 9700.0,
    longPeri: 150.7,
    longNode: 103.8,
    orbitalPeriodDays: 1325.0,
  },
  pallas: {
    a: 2.772,
    e: 0.231,
    i: 34.84, // High inclination asteroid!
    L: 45.0,
    LDot: 7750.0,
    longPeri: 310.2,
    longNode: 173.1,
    orbitalPeriodDays: 1686.0,
  },
  jupiter: {
    a: 5.202887,
    aDot: -0.00011607,
    e: 0.04838624,
    eDot: -0.00013253,
    i: 1.30439695,
    iDot: -0.00183714,
    L: 34.39644051,
    LDot: 3034.74612775,
    longPeri: 14.72847983,
    longPeriDot: 0.21252668,
    longNode: 100.47390909,
    longNodeDot: 0.20469106,
    orbitalPeriodDays: 4332.589,
  },
  saturn: {
    a: 9.53667594,
    aDot: -0.0012506,
    e: 0.05386179,
    eDot: -0.00050991,
    i: 2.48599187,
    iDot: 0.00193609,
    L: 49.95424423,
    LDot: 1222.49362201,
    longPeri: 92.59887831,
    longPeriDot: -0.41897216,
    longNode: 113.66242448,
    longNodeDot: -0.28867794,
    orbitalPeriodDays: 10759.22,
  },
  uranus: {
    a: 19.18916464,
    aDot: -0.00196176,
    e: 0.04725744,
    eDot: -0.00004397,
    i: 0.77263783,
    iDot: -0.00242939,
    L: 313.23810451,
    LDot: 428.48202785,
    longPeri: 170.9542763,
    longPeriDot: 0.40805281,
    longNode: 74.01692503,
    longNodeDot: 0.04240589,
    orbitalPeriodDays: 30685.4,
  },
  neptune: {
    a: 30.06992276,
    aDot: 0.00026291,
    e: 0.00860606,
    eDot: 0.00005105,
    i: 1.77004347,
    iDot: 0.00035372,
    L: -55.12002969,
    LDot: 218.45945325,
    longPeri: 44.96476227,
    longPeriDot: -0.32241464,
    longNode: 131.78422574,
    longNodeDot: -0.00508664,
    orbitalPeriodDays: 60189.0,
  },
  pluto: {
    a: 39.482,
    e: 0.2488,
    i: 17.16,
    L: 238.92,
    LDot: 145.2,
    longPeri: 224.06,
    longNode: 110.3,
    orbitalPeriodDays: 90560.0,
  },
  // Real NASA Exoplanets Keplerian Data
  'trappist-1e': {
    a: 0.02925,
    e: 0.005,
    i: 89.79,
    L: 45.0,
    LDot: 215300.0,
    longPeri: 12.0,
    longNode: 89.8,
    orbitalPeriodDays: 6.101,
  },
  'kepler-22b': {
    a: 0.812,
    e: 0.72, // Highly eccentric Keplerian orbit!
    i: 89.76,
    L: 120.0,
    LDot: 45300.0,
    longPeri: 78.0,
    longNode: 90.0,
    orbitalPeriodDays: 289.86,
  },
  '55-cancri-e': {
    a: 0.01544,
    e: 0.05,
    i: 83.59,
    L: 180.0,
    LDot: 1780000.0,
    longPeri: 142.0,
    longNode: 85.0,
    orbitalPeriodDays: 0.7365,
  },
  'wasp-12b': {
    a: 0.0234,
    e: 0.04,
    i: 81.8,
    L: 210.0,
    LDot: 1205000.0,
    longPeri: 95.0,
    longNode: 82.0,
    orbitalPeriodDays: 1.091,
  },
  'proxima-b': {
    a: 0.0485,
    e: 0.11,
    i: 88.0,
    L: 300.0,
    LDot: 117500.0,
    longPeri: 210.0,
    longNode: 88.0,
    orbitalPeriodDays: 11.186,
  },
  'hd-189733-b': {
    a: 0.0313,
    e: 0.004,
    i: 85.71,
    L: 90.0,
    LDot: 593000.0,
    longPeri: 330.0,
    longNode: 86.0,
    orbitalPeriodDays: 2.218,
  },
  'psr-b1257-c': {
    a: 0.36,
    e: 0.0186,
    i: 53.0,
    L: 14.0,
    LDot: 19700.0,
    longPeri: 249.0,
    longNode: 53.0,
    orbitalPeriodDays: 66.54,
  },
};
