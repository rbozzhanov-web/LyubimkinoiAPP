// Regenerates every icon slot at the size that slot is actually declared to be.
//
// The icons drifted once already: a single image was copied into all five files, so
// `icon-512.png` was a 64x64 picture wearing a 512 name. Browsers judge PWA
// installability by the real pixel size, and iOS renders the home-screen icon from
// `apple-touch-icon.png`, so a wrong-size file is a real defect, not cosmetics.
// Generate, never copy: `npm run icons`.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng, encodePng } from './png.mjs';

const root = process.cwd();

// Every icon the app ships, with the size its consumer expects.
export const ICONS = [
  { file: 'assets/icon.png', size: 1024, use: 'Expo app icon (iOS/Android build)' },
  { file: 'public/apple-touch-icon.png', size: 180, use: 'iOS home screen' },
  { file: 'public/icon-512.png', size: 512, use: 'PWA manifest' },
  { file: 'public/icon-192.png', size: 192, use: 'PWA manifest / installability' },
  { file: 'public/favicon-64.png', size: 64, use: 'browser tab' },
];

// Preferred master artwork. Keep the highest-resolution export here and the rest follows.
export const SOURCE = 'assets/icon-source.png';

function pickSource() {
  try {
    return { name: SOURCE, image: decodePng(readFileSync(join(root, SOURCE))) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`${SOURCE}: ${error.message}`);
  }

  // No master yet: adopt the largest icon that still decodes and pin it as the master,
  // so the sizes can be made correct today and every later run starts from the same
  // pixels instead of re-scaling its own output.
  let best;
  for (const { file } of ICONS) {
    try {
      const image = decodePng(readFileSync(join(root, file)));
      if (!best || image.width > best.image.width) best = { name: file, image };
    } catch {
      // A slot that cannot be decoded simply cannot serve as the source.
    }
  }
  if (!best) throw new Error(`no usable source: add ${SOURCE}`);
  writeFileSync(join(root, SOURCE), encodePng(best.image));
  console.log(`Adopted ${best.name} as ${SOURCE} (${best.image.width}x${best.image.width}).`);
  return { name: SOURCE, image: best.image };
}

function makeIcons() {
  const source = pickSource();
  if (source.image.width !== source.image.height) {
    throw new Error(`${source.name} is ${source.image.width}x${source.image.height}; the icon must be square`);
  }

  console.log(`Source: ${source.name} (${source.image.width}x${source.image.height})`);
  for (const { file, size, use } of ICONS) {
    writeFileSync(join(root, file), encodePng(resize(source.image, size)));
    const note = size > source.image.width ? ` — upscaled from ${source.image.width}px` : '';
    console.log(`  ${file} → ${size}x${size}  · ${use}${note}`);
  }

  const largest = Math.max(...ICONS.map((icon) => icon.size));
  if (source.image.width < largest) {
    console.log(`\nNote: the master is only ${source.image.width}px, so anything above that is an upscale.`);
    console.log(`Replace ${SOURCE} with the full-resolution artwork (1024x1024) and re-run for crisp icons.`);
  }
}

export function resize(image, size) {
  return size === image.width ? image : size < image.width ? boxDownscale(image, size) : bicubicUpscale(image, size);
}

/** Averages each source block into one output pixel: the right filter for downscaling. */
function boxDownscale(image, size) {
  const { width, pixels } = image;
  const out = Buffer.alloc(size * size * 4);
  const step = width / size;

  for (let y = 0; y < size; y += 1) {
    const y0 = Math.floor(y * step);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * step));
    for (let x = 0; x < size; x += 1) {
      const x0 = Math.floor(x * step);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * step));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const i = (sy * width + sx) * 4;
          const alpha = pixels[i + 3] / 255;
          r += pixels[i] * alpha; g += pixels[i + 1] * alpha; b += pixels[i + 2] * alpha;
          a += pixels[i + 3]; n += 1;
        }
      }
      const target = (y * size + x) * 4;
      const meanAlpha = a / n;
      const unpremultiply = meanAlpha > 0 ? 255 / meanAlpha : 0;
      out[target] = clamp((r / n) * unpremultiply);
      out[target + 1] = clamp((g / n) * unpremultiply);
      out[target + 2] = clamp((b / n) * unpremultiply);
      out[target + 3] = clamp(meanAlpha);
    }
  }

  return { width: size, height: size, pixels: out };
}

/** Catmull-Rom: smooth enough not to blockify, sharp enough to keep the mark's edges. */
function bicubicUpscale(image, size) {
  const { width, pixels } = image;
  const out = Buffer.alloc(size * size * 4);
  const scale = width / size;

  for (let y = 0; y < size; y += 1) {
    const sy = (y + 0.5) * scale - 0.5;
    const iy = Math.floor(sy);
    const wy = weights(sy - iy);
    for (let x = 0; x < size; x += 1) {
      const sx = (x + 0.5) * scale - 0.5;
      const ix = Math.floor(sx);
      const wx = weights(sx - ix);
      let r = 0, g = 0, b = 0, a = 0;
      for (let m = 0; m < 4; m += 1) {
        const py = clampIndex(iy - 1 + m, width);
        for (let n = 0; n < 4; n += 1) {
          const px = clampIndex(ix - 1 + n, width);
          const weight = wy[m] * wx[n];
          const i = (py * width + px) * 4;
          const alpha = pixels[i + 3] / 255;
          r += pixels[i] * alpha * weight;
          g += pixels[i + 1] * alpha * weight;
          b += pixels[i + 2] * alpha * weight;
          a += pixels[i + 3] * weight;
        }
      }
      const target = (y * size + x) * 4;
      const outAlpha = clamp(a);
      const unpremultiply = outAlpha > 0 ? 255 / outAlpha : 0;
      out[target] = clamp(r * unpremultiply);
      out[target + 1] = clamp(g * unpremultiply);
      out[target + 2] = clamp(b * unpremultiply);
      out[target + 3] = outAlpha;
    }
  }

  return { width: size, height: size, pixels: out };
}

function weights(t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    -0.5 * t3 + t2 - 0.5 * t,
    1.5 * t3 - 2.5 * t2 + 1,
    -1.5 * t3 + 2 * t2 + 0.5 * t,
    0.5 * t3 - 0.5 * t2,
  ];
}

function clampIndex(value, limit) { return value < 0 ? 0 : value > limit - 1 ? limit - 1 : value; }
function clamp(value) { return value < 0 ? 0 : value > 255 ? 255 : Math.round(value); }

// Importing this module (the verifier reads ICONS from it) must not rewrite the icons.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) makeIcons();
