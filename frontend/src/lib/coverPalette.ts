/**
 * Pulls 3 vivid colours out of a cover image (Open Library serves covers with CORS,
 * so the canvas isn't tainted). Cached per URL; resolves to [] if anything fails.
 */
const cache = new Map<string, Promise<string[]>>();

export function coverPalette(url: string): Promise<string[]> {
  let p = cache.get(url);
  if (!p) {
    p = extract(url).catch(() => []);
    cache.set(url, p);
  }
  return p;
}

async function extract(url: string): Promise<string[]> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();

  const w = 24;
  const h = 36;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Bucket pixels by hue; weight each by saturation so muddy greys don't win.
  const buckets = Array.from({ length: 12 }, () => ({ weight: 0, h: 0, s: 0, l: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const [hue, sat, light] = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!);
    if (light < 0.12 || light > 0.92) continue;
    const weight = sat * sat + 0.02;
    const b = buckets[Math.floor(hue / 30) % 12]!;
    b.weight += weight;
    b.h += hue * weight;
    b.s += sat * weight;
    b.l += light * weight;
  }
  const top = buckets
    .filter((b) => b.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((b) => {
      const hue = Math.round(b.h / b.weight);
      // Keep the glow soft and bright whatever the cover is: lift saturation, clamp lightness.
      const sat = Math.round(Math.min(90, Math.max(55, (b.s / b.weight) * 100 + 20)));
      const light = Math.round(Math.min(72, Math.max(58, (b.l / b.weight) * 100)));
      return `hsl(${hue} ${sat}% ${light}%)`;
    });
  return top;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
