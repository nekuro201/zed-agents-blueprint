// Gera um PNG 1024x1024 de ícone sem dependências (zlib nativo do Node).
// Uso: node scripts/gen-icon.mjs [saída]
// Em seguida: pnpm tauri icon scripts/app-icon.png  (gera todos os assets em src-tauri/icons)
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] ?? path.join(root, "scripts", "app-icon.png");

const BG = [15, 17, 21, 255]; // zinc-950 escuro
const ACCENT = [245, 158, 11, 255]; // âmbar (Tailwind amber-500)
const DARK = [15, 17, 21, 255];

const buf = Buffer.alloc(SIZE * SIZE * 4);
const setPx = (x, y, c) => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = c[3];
};

// Fundo
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) setPx(x, y, BG);

// Desenha um "π" estilizado com formas geométricas (tampa + 2 pernas retangulares)
const colorRect = (x0, y0, w, h, c, radius = 0) => {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (radius > 0) {
        const dx = Math.min(x - x0, x0 + w - 1 - x);
        const dy = Math.min(y - y0, y0 + h - 1 - y);
        const corner = dx < radius && dy < radius;
        const dist = corner ? Math.hypot(dx - radius + 1, dy - radius + 1) : 0;
        if (corner && dist > radius) continue;
      }
      setPx(x, y, c);
    }
  }
};

const cx = SIZE / 2;
const stroke = 120;
const pernaW = 130;
const legGap = 90;
const topBarW = pernaW * 2 + legGap;
const topBarY = 260;
const legTopY = 300;
const legH = 420;

// tampa do π (barra horizontal)
colorRect(cx - topBarW / 2, topBarY, topBarW, stroke, ACCENT, 40);
// pernas do π (barras verticais)
colorRect(cx - topBarW / 2, legTopY, pernaW, legH - (legTopY - topBarY) + stroke, ACCENT, 24);
colorRect(cx + topBarW / 2 - pernaW, legTopY, pernaW, legH - (legTopY - topBarY) + stroke, ACCENT, 24);

// "olho" escuro central (marca de agente/sistema)
colorRect(cx - legGap / 2, 300, legGap, stroke, DARK, 20);

// ---- Encoder PNG (RGBA 8-bit) ----
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// scanlines com filtro 0
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  buf.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`Ícone gerado: ${out} (${png.length} bytes)`);
