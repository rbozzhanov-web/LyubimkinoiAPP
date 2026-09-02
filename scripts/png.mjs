// Minimal dependency-free PNG reader/writer, enough for the app icon pipeline.
// Only what the icons need: non-interlaced images, decoded to straight RGBA8 and
// written back as RGBA8. Keeping it dependency-free means `npm ci --ignore-scripts`
// in CI can run it without pulling an image toolchain.
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Reads the header alone. Cheap enough to run over every icon in a verification step. */
export function readSize(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  if (buffer.length < 33) throw new Error('PNG is truncated before the header');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');

  let offset = 8;
  let header;
  let palette;
  let transparency;
  let sawEnd = false;
  const data = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    // A chunk that runs past the file is the signature of the truncated uploads
    // that corrupted these icons before; say so rather than decoding garbage.
    if (end + 4 > buffer.length) throw new Error(`PNG is truncated inside its ${type} chunk`);

    if (type === 'IHDR') {
      header = {
        width: buffer.readUInt32BE(start),
        height: buffer.readUInt32BE(start + 4),
        depth: buffer[start + 8],
        colorType: buffer[start + 9],
        interlace: buffer[start + 12],
      };
    } else if (type === 'PLTE') palette = buffer.subarray(start, end);
    else if (type === 'tRNS') transparency = buffer.subarray(start, end);
    else if (type === 'IDAT') data.push(buffer.subarray(start, end));
    else if (type === 'IEND') { sawEnd = true; break; }

    offset = end + 4;
  }

  if (!header) throw new Error('PNG has no IHDR chunk');
  if (!sawEnd) throw new Error('PNG has no IEND chunk (file is truncated)');
  if (header.interlace !== 0) throw new Error('interlaced PNGs are not supported');
  if (!data.length) throw new Error('PNG has no image data');

  const raw = inflateSync(Buffer.concat(data));
  const samples = unfilter(raw, header);
  const pixels = toRgba(samples, header, palette, transparency);
  return { width: header.width, height: header.height, pixels };
}

function unfilter(raw, { width, height, depth, colorType }) {
  const channels = CHANNELS[colorType];
  if (channels === undefined) throw new Error(`unsupported PNG color type ${colorType}`);
  const bitsPerPixel = channels * depth;
  const bytesPerPixel = Math.max(1, bitsPerPixel >> 3);
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const out = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const row = out.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? out.subarray((y - 1) * stride, y * stride) : undefined;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = prior ? prior[x] : 0;
      const upLeft = prior && x >= bytesPerPixel ? prior[x - bytesPerPixel] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`unsupported PNG row filter ${filter}`);
      row[x] = value & 0xff;
    }
  }

  return { bytes: out, stride, channels };
}

function toRgba(samples, { width, height, depth, colorType }, palette, transparency) {
  const { bytes, stride, channels } = samples;
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      const read = (channel) => {
        if (depth === 8) return bytes[y * stride + (x * channels + channel)];
        if (depth === 16) return bytes[y * stride + (x * channels + channel) * 2];
        // Sub-byte depths only occur on grayscale and palette images (channels === 1).
        const bitIndex = x * depth;
        const byte = bytes[y * stride + (bitIndex >> 3)];
        const shift = 8 - depth - (bitIndex & 7);
        return (byte >> shift) & ((1 << depth) - 1);
      };

      if (colorType === 3) {
        if (!palette) throw new Error('palette PNG has no PLTE chunk');
        const index = read(0);
        pixels[target] = palette[index * 3];
        pixels[target + 1] = palette[index * 3 + 1];
        pixels[target + 2] = palette[index * 3 + 2];
        pixels[target + 3] = transparency && index < transparency.length ? transparency[index] : 255;
      } else if (colorType === 0 || colorType === 4) {
        const gray = scale(read(0), depth);
        pixels[target] = gray;
        pixels[target + 1] = gray;
        pixels[target + 2] = gray;
        pixels[target + 3] = colorType === 4 ? scale(read(1), depth) : 255;
      } else {
        pixels[target] = scale(read(0), depth);
        pixels[target + 1] = scale(read(1), depth);
        pixels[target + 2] = scale(read(2), depth);
        pixels[target + 3] = colorType === 6 ? scale(read(3), depth) : 255;
      }
    }
  }

  return pixels;
}

function scale(value, depth) {
  if (depth === 8 || depth === 16) return value;
  return Math.round((value * 255) / ((1 << depth) - 1));
}

export function encodePng({ width, height, pixels }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : undefined;
    const { filter, line } = chooseFilter(row, prior, stride);
    raw[y * (stride + 1)] = filter;
    line.copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Picks the row filter with the smallest absolute sum, the heuristic libpng uses. */
function chooseFilter(row, prior, stride) {
  let best;
  for (const filter of [0, 1, 2, 3, 4]) {
    const line = Buffer.alloc(stride);
    let score = 0;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? row[x - 4] : 0;
      const up = prior ? prior[x] : 0;
      const upLeft = prior && x >= 4 ? prior[x - 4] : 0;
      let value = row[x];
      if (filter === 1) value -= left;
      else if (filter === 2) value -= up;
      else if (filter === 3) value -= (left + up) >> 1;
      else if (filter === 4) value -= paeth(left, up, upLeft);
      line[x] = value & 0xff;
      score += Math.min(line[x], 256 - line[x]);
    }
    if (!best || score < best.score) best = { filter, line, score };
  }
  return best;
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
