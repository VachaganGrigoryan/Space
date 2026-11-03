import * as THREE from 'three';

// Simplex-like 2D noise helper using trigonometric harmonics for crisp, repeatable canvas textures
function noise2D(x: number, y: number): number {
  return (
    Math.sin(x * 1.5 + Math.cos(y * 2.2)) * 0.35 +
    Math.sin(x * 3.7 - Math.sin(y * 4.1)) * 0.25 +
    Math.sin(x * 8.1 + y * 7.9) * 0.15 +
    Math.cos(x * 15.3 - y * 14.1) * 0.1 +
    0.5
  );
}

// Fractional Brownian Motion for natural continental, crater, and atmospheric turbulence
function fbm(x: number, y: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise2D(x * freq, y * freq) * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return val / maxAmp;
}

export class ProceduralTextureFactory {
  private static cache = new Map<string, THREE.CanvasTexture>();

  public static createTexture(
    key: string,
    width: number,
    height: number,
    drawFn: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
    isColorMap = true
  ): THREE.CanvasTexture {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFn(ctx, width, height);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    if (isColorMap) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    this.cache.set(key, texture);
    return texture;
  }

  // 1. Sun Solar Plasma Texture
  public static getSunTexture(): THREE.CanvasTexture {
    return this.createTexture('sun_plasma', 1024, 512, (ctx, w, h) => {
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const n = fbm(nx * 12, ny * 12, 5);
          const granules = Math.sin(nx * 40) * Math.cos(ny * 40) * 0.15;
          const val = Math.min(1, Math.max(0, n + granules));

          const idx = (y * w + x) * 4;
          // Radiance palette: from deep orange-red (#ef4444) to gold (#fbbf24) to blazing white-yellow (#fef08a)
          data[idx] = Math.floor(255); // Red
          data[idx + 1] = Math.floor(130 + val * 125); // Green
          data[idx + 2] = Math.floor(10 + Math.pow(val, 3) * 150); // Blue
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Add sunspots
      ctx.fillStyle = 'rgba(75, 20, 5, 0.75)';
      const spots = [
        { x: w * 0.25, y: h * 0.45, r: 16 },
        { x: w * 0.28, y: h * 0.47, r: 10 },
        { x: w * 0.65, y: h * 0.52, r: 22 },
        { x: w * 0.68, y: h * 0.54, r: 12 },
        { x: w * 0.82, y: h * 0.42, r: 14 },
      ];
      spots.forEach((s) => {
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        grad.addColorStop(0, 'rgba(40, 10, 0, 0.9)');
        grad.addColorStop(0.6, 'rgba(120, 30, 5, 0.6)');
        grad.addColorStop(1, 'rgba(240, 140, 20, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  // 2. Earth Biosphere & Oceans
  public static getEarthTexture(): THREE.CanvasTexture {
    return this.createTexture('earth_biosphere', 1024, 512, (ctx, w, h) => {
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h; // 0 (north) to 1 (south)
        const latDist = Math.abs(ny - 0.5) * 2; // 0 at equator, 1 at poles

        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const continentNoise = fbm(nx * 4, ny * 4, 5);

          const idx = (y * w + x) * 4;

          // Polar Ice Caps
          if (latDist > 0.88 + (fbm(nx * 10, ny * 10, 2) - 0.5) * 0.1) {
            data[idx] = 235;
            data[idx + 1] = 245;
            data[idx + 2] = 255;
            data[idx + 3] = 255;
            continue;
          }

          // Land vs Ocean threshold
          if (continentNoise > 0.52) {
            // Land: forest green, savannah, and mountains
            const elevation = (continentNoise - 0.52) / 0.48;
            if (elevation > 0.6) {
              // High mountain/arid ridge
              data[idx] = 160 + Math.floor(elevation * 50);
              data[idx + 1] = 140 + Math.floor(elevation * 40);
              data[idx + 2] = 100;
            } else if (latDist > 0.6) {
              // Tundra / boreal
              data[idx] = 110;
              data[idx + 1] = 135;
              data[idx + 2] = 90;
            } else if (latDist < 0.25) {
              // Tropical rainforest
              data[idx] = 25;
              data[idx + 1] = 115;
              data[idx + 2] = 45;
            } else {
              // Temperate grassland / plains
              data[idx] = 45 + Math.floor(elevation * 40);
              data[idx + 1] = 130 + Math.floor(elevation * 30);
              data[idx + 2] = 55;
            }
          } else {
            // Ocean: deep blue with shallow continental shelves
            const depth = 0.52 - continentNoise;
            if (depth < 0.05) {
              // Turquoise coastal shelf
              data[idx] = 20;
              data[idx + 1] = 110;
              data[idx + 2] = 175;
            } else {
              // Deep ocean
              data[idx] = 12;
              data[idx + 1] = 40 + Math.floor(depth * 30);
              data[idx + 2] = 110 + Math.floor(depth * 80);
            }
          }
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    });
  }

  // 3. Dynamic Cloud Layer Texture
  public static getCloudsTexture(tint = '#ffffff'): THREE.CanvasTexture {
    return this.createTexture(`clouds_${tint}`, 1024, 512, (ctx, w, h) => {
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          // Swirling cloud bands with sinusoidal shear
          const swirl = Math.sin(ny * Math.PI * 6 + nx * 3) * 0.1;
          const cloudNoise = fbm((nx + swirl) * 6, ny * 6, 5);

          const idx = (y * w + x) * 4;
          if (cloudNoise > 0.5) {
            const alpha = Math.min(240, Math.floor((cloudNoise - 0.5) * 480));
            data[idx] = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
            data[idx + 3] = alpha;
          } else {
            data[idx + 3] = 0; // Transparent
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    });
  }

  // 4. Moon & Mercury Cratered Regolith Texture
  public static getCrateredTexture(baseGray = 160, contrast = 50): THREE.CanvasTexture {
    return this.createTexture(`craters_${baseGray}_${contrast}`, 1024, 512, (ctx, w, h) => {
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const n = fbm(nx * 8, ny * 8, 5);
          const fine = noise2D(nx * 32, ny * 32) * 0.2;
          const val = Math.min(255, Math.max(0, baseGray + (n + fine - 0.6) * contrast));

          const idx = (y * w + x) * 4;
          data[idx] = Math.floor(val);
          data[idx + 1] = Math.floor(val * 0.98);
          data[idx + 2] = Math.floor(val * 0.95);
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Procedural craters
      for (let i = 0; i < 40; i++) {
        const cx = Math.random() * w;
        const cy = Math.random() * h;
        const rad = 6 + Math.random() * 24;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grad.addColorStop(0, 'rgba(40, 40, 40, 0.7)');
        grad.addColorStop(0.7, 'rgba(90, 90, 90, 0.4)');
        grad.addColorStop(0.85, 'rgba(230, 230, 230, 0.8)'); // Ejecta rim
        grad.addColorStop(1, 'rgba(150, 150, 150, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // 5. Mars Rusty Surface Texture
  public static getMarsTexture(): THREE.CanvasTexture {
    return this.createTexture('mars_rusty', 1024, 512, (ctx, w, h) => {
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        const latDist = Math.abs(ny - 0.5) * 2;

        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const idx = (y * w + x) * 4;

          // Polar Ice Caps (dry ice / water ice)
          if (latDist > 0.9) {
            data[idx] = 245;
            data[idx + 1] = 240;
            data[idx + 2] = 235;
            data[idx + 3] = 255;
            continue;
          }

          const n = fbm(nx * 5, ny * 5, 5);
          // Iron oxide palette: rich orange-red, dark basalt highlands, ochre lowlands
          data[idx] = Math.floor(175 + n * 60);
          data[idx + 1] = Math.floor(60 + n * 40);
          data[idx + 2] = Math.floor(30 + n * 25);
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Valles Marineris canyon rift
      ctx.strokeStyle = 'rgba(70, 20, 10, 0.75)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.55);
      ctx.bezierCurveTo(w * 0.45, h * 0.58, w * 0.52, h * 0.52, w * 0.65, h * 0.54);
      ctx.stroke();

      // Olympus Mons caldera
      const omGrad = ctx.createRadialGradient(w * 0.28, h * 0.42, 2, w * 0.28, h * 0.42, 28);
      omGrad.addColorStop(0, 'rgba(120, 35, 15, 0.9)');
      omGrad.addColorStop(0.5, 'rgba(210, 95, 45, 0.85)');
      omGrad.addColorStop(1, 'rgba(175, 60, 30, 0)');
      ctx.fillStyle = omGrad;
      ctx.beginPath();
      ctx.arc(w * 0.28, h * 0.42, 28, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 6. Jupiter Banded Atmosphere with Great Red Spot
  public static getJupiterTexture(): THREE.CanvasTexture {
    return this.createTexture('jupiter_bands', 1024, 512, (ctx, w, h) => {
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          // Zonal harmonic jet streams
          const bandFrequency = Math.sin(ny * Math.PI * 18);
          const turbulence = fbm(nx * 10, ny * 10, 4) * 0.25;
          const band = (bandFrequency + turbulence + 1) * 0.5;

          const idx = (y * w + x) * 4;
          // Zones (light cream) vs Belts (warm brown/ochre)
          data[idx] = Math.floor(215 + band * 35);
          data[idx + 1] = Math.floor(140 + band * 85);
          data[idx + 2] = Math.floor(80 + band * 110);
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // The Great Red Spot (anticyclonic vortex)
      const grsX = w * 0.62;
      const grsY = h * 0.65;
      const grsW = 60;
      const grsH = 34;

      ctx.save();
      ctx.translate(grsX, grsY);
      ctx.scale(grsW / 2, grsH / 2);
      const spotGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      spotGrad.addColorStop(0, '#991b1b');
      spotGrad.addColorStop(0.5, '#dc2626');
      spotGrad.addColorStop(0.85, '#ea580c');
      spotGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // 7. Saturn Golden Atmospheric Bands
  public static getSaturnTexture(): THREE.CanvasTexture {
    return this.createTexture('saturn_bands', 1024, 512, (ctx, w, h) => {
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const bandFrequency = Math.sin(ny * Math.PI * 24);
          const subtleNoise = fbm(nx * 6, ny * 6, 3) * 0.12;
          const band = (bandFrequency + subtleNoise + 1) * 0.5;

          const idx = (y * w + x) * 4;
          data[idx] = Math.floor(226 + band * 22);
          data[idx + 1] = Math.floor(198 + band * 30);
          data[idx + 2] = Math.floor(145 + band * 45);
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    });
  }

  // 8. Saturn / Exoplanet Rings Radial Texture
  public static getRingTexture(colorHex = '#d8b982'): THREE.CanvasTexture {
    return this.createTexture(`ring_${colorHex}`, 1024, 64, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, 0);

      // Convert hex to rgb
      const c = new THREE.Color(colorHex);
      const r = Math.floor(c.r * 255);
      const g = Math.floor(c.g * 255);
      const b = Math.floor(c.b * 255);

      // C Ring (faint inner)
      grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.0)`);
      grad.addColorStop(0.12, `rgba(${r}, ${g}, ${b}, 0.35)`);
      grad.addColorStop(0.28, `rgba(${r}, ${g}, ${b}, 0.55)`);

      // B Ring (brightest and densest)
      grad.addColorStop(0.32, `rgba(${r}, ${g}, ${b}, 0.95)`);
      grad.addColorStop(0.62, `rgba(${r}, ${g}, ${b}, 0.98)`);

      // Cassini Division (dark gap)
      grad.addColorStop(0.64, `rgba(${r}, ${g}, ${b}, 0.04)`);
      grad.addColorStop(0.70, `rgba(${r}, ${g}, ${b}, 0.05)`);

      // A Ring with Encke gap
      grad.addColorStop(0.72, `rgba(${r}, ${g}, ${b}, 0.85)`);
      grad.addColorStop(0.86, `rgba(${r}, ${g}, ${b}, 0.2)`); // Encke gap
      grad.addColorStop(0.89, `rgba(${r}, ${g}, ${b}, 0.82)`);
      grad.addColorStop(0.96, `rgba(${r}, ${g}, ${b}, 0.4)`);
      grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // 9. Uranus / Neptune Ice Giant Texture
  public static getIceGiantTexture(isNeptune = false): THREE.CanvasTexture {
    const key = isNeptune ? 'neptune_storm' : 'uranus_ice';
    return this.createTexture(key, 1024, 512, (ctx, w, h) => {
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const n = fbm(nx * 6, ny * 6, 4);
          const idx = (y * w + x) * 4;

          if (isNeptune) {
            // Neptune deep cobalt blue with supersonic methane cirrus streaks
            data[idx] = Math.floor(25 + n * 25);
            data[idx + 1] = Math.floor(75 + n * 65);
            data[idx + 2] = Math.floor(190 + n * 65);
          } else {
            // Uranus serene cyan-aquamarine
            data[idx] = Math.floor(80 + n * 45);
            data[idx + 1] = Math.floor(200 + n * 45);
            data[idx + 2] = Math.floor(220 + n * 35);
          }
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      if (isNeptune) {
        // High-altitude bright white methane cloud streaks
        ctx.strokeStyle = 'rgba(215, 235, 255, 0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.4);
        ctx.lineTo(w * 0.4, h * 0.42);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.35);
        ctx.lineTo(w * 0.85, h * 0.37);
        ctx.stroke();

        // Neptune's Great Dark Spot
        const dsGrad = ctx.createRadialGradient(w * 0.38, h * 0.6, 2, w * 0.38, h * 0.6, 30);
        dsGrad.addColorStop(0, 'rgba(10, 25, 80, 0.85)');
        dsGrad.addColorStop(0.7, 'rgba(20, 60, 160, 0.6)');
        dsGrad.addColorStop(1, 'rgba(30, 90, 220, 0)');
        ctx.fillStyle = dsGrad;
        ctx.beginPath();
        ctx.arc(w * 0.38, h * 0.6, 30, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // 10. Speculative / Exoplanet Custom Procedural Texture
  public static getSpeculativeTexture(
    type: string,
    primaryHex: string,
    secondaryHex: string,
    emissiveHex = '#000000'
  ): THREE.CanvasTexture {
    const key = `speculative_${type}_${primaryHex}_${secondaryHex}_${emissiveHex}`;
    return this.createTexture(key, 1024, 512, (ctx, w, h) => {
      const c1 = new THREE.Color(primaryHex);
      const c2 = new THREE.Color(secondaryHex);
      const cEm = new THREE.Color(emissiveHex);

      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const idx = (y * w + x) * 4;

          let factor = 0.5;
          let isFissure = false;

          if (type.includes('lava') || type.includes('fissure') || type.includes('cancri')) {
            // Molten magma cracks
            const n = fbm(nx * 10, ny * 10, 5);
            factor = n;
            if (n > 0.68) isFissure = true;
          } else if (type.includes('band') || type.includes('gas') || type.includes('wasp')) {
            // Extreme gas bands
            const band = Math.sin(ny * Math.PI * 20);
            factor = (band + fbm(nx * 8, ny * 8, 3) * 0.3 + 1) * 0.5;
          } else if (type.includes('ocean') || type.includes('kepler') || type.includes('trappist')) {
            // Continental / oceanic archipelago
            factor = fbm(nx * 6, ny * 6, 5);
          } else {
            // Cratered alien rocky world
            factor = fbm(nx * 8, ny * 8, 4);
          }

          factor = Math.min(1, Math.max(0, factor));

          if (isFissure && emissiveHex !== '#000000') {
            data[idx] = Math.floor(cEm.r * 255);
            data[idx + 1] = Math.floor(cEm.g * 255);
            data[idx + 2] = Math.floor(cEm.b * 255);
          } else {
            data[idx] = Math.floor((c1.r * (1 - factor) + c2.r * factor) * 255);
            data[idx + 1] = Math.floor((c1.g * (1 - factor) + c2.g * factor) * 255);
            data[idx + 2] = Math.floor((c1.b * (1 - factor) + c2.b * factor) * 255);
          }
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    });
  }

  // 11. Normal / Bump Map Generator
  public static getBumpMap(key: string, roughnessFactor = 0.5): THREE.CanvasTexture {
    return this.createTexture(`bump_${key}`, 512, 256, (ctx, w, h) => {
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const n = fbm(nx * 12, ny * 12, 4);
          const v = Math.floor(n * 255 * roughnessFactor);
          const idx = (y * w + x) * 4;
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }, false); // Data map, linear space
  }
}
