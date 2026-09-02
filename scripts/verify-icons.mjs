// Fails the build when an icon is not the size it claims to be, or is a truncated file.
//
// Both have shipped before: five slots once held the same image under different names,
// and two icon commits landed PNGs whose data ran off the end of the file. Existence
// checks did not catch either, because the files existed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng, readSize } from './png.mjs';
import { ICONS } from './make-icons.mjs';

const root = process.cwd();
const problems = [];

for (const { file, size, use } of ICONS) {
  try {
    const buffer = readFileSync(join(root, file));
    const header = readSize(buffer);
    if (header.width !== size || header.height !== size) {
      problems.push(`${file} is ${header.width}x${header.height}, expected ${size}x${size} (${use})`);
      continue;
    }
    // Decoding fully is what catches a truncated upload; the header alone still parses.
    decodePng(buffer);
  } catch (error) {
    problems.push(`${file}: ${error.message}`);
  }
}

// The manifest is what the browser believes; it must agree with the files on disk.
const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons ?? []) {
  const declared = Number(String(icon.sizes).split('x')[0]);
  const known = ICONS.find((item) => item.file === `public/${icon.src}`);
  if (!known) problems.push(`manifest lists ${icon.src}, which the icon pipeline does not generate`);
  else if (known.size !== declared) problems.push(`manifest declares ${icon.src} as ${icon.sizes}, but it is generated at ${known.size}x${known.size}`);
}

if (problems.length) {
  console.error('Icon verification failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nRun `npm run icons` to regenerate them from assets/icon-source.png.');
  process.exit(1);
}

console.log(`Icons verified: ${ICONS.map((icon) => `${icon.size}px`).join(', ')} — each the size it claims.`);
