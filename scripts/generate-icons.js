import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

function createIcon(size, isMaskable = false) {
  const png = new PNG({ width: size, height: size });

  // Theme colors: Navy #1e293b -> (30, 41, 59), Emerald/Teal #0d9488 -> (13, 148, 136), White (255, 255, 255)
  const bgR = 30, bgG = 41, bgB = 59;
  const accentR = 13, accentG = 148, accentB = 136;
  const brandR = 56, brandG = 189, brandB = 248; // Sky-400

  // Corner radius for non-maskable (squircle)
  const cornerRadius = isMaskable ? 0 : size * 0.22;
  const center = size / 2;

  // Safe zone for maskable is 80% (10% margin on all sides)
  const contentScale = isMaskable ? 0.68 : 0.75;
  const contentHalf = (size * contentScale) / 2;
  const contentBox = {
    left: center - contentHalf,
    right: center + contentHalf,
    top: center - contentHalf,
    bottom: center + contentHalf
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Squircle clipping for non-maskable icons
      let inShape = true;
      if (!isMaskable) {
        const dx = Math.max(Math.abs(x - center) - (center - cornerRadius), 0);
        const dy = Math.max(Math.abs(y - center) - (center - cornerRadius), 0);
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
          inShape = false;
        }
      }

      if (!inShape) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
        continue;
      }

      // Default background: gradient from #1e293b to #0f172a
      const gradFactor = y / size;
      let r = Math.round(bgR * (1 - gradFactor * 0.3));
      let g = Math.round(bgG * (1 - gradFactor * 0.3));
      let b = Math.round(bgB * (1 - gradFactor * 0.3));
      let a = 255;

      // Draw Calendar / Community Spaces glyph
      const inGlyph = (
        x >= contentBox.left && x <= contentBox.right &&
        y >= contentBox.top && y <= contentBox.bottom
      );

      if (inGlyph) {
        const relX = (x - contentBox.left) / (contentBox.right - contentBox.left);
        const relY = (y - contentBox.top) / (contentBox.bottom - contentBox.top);

        // Header bar of calendar (top 24%)
        if (relY <= 0.24) {
          r = accentR;
          g = accentG;
          b = accentB;
        } else if (relY >= 0.28) {
          // Calendar Body: 3x3 Grid of space slots
          const col = Math.floor(relX * 3.4);
          const row = Math.floor((relY - 0.28) * 4.2);

          const cellX = (relX * 3.4) % 1;
          const cellY = ((relY - 0.28) * 4.2) % 1;

          if (col >= 0 && col < 3 && row >= 0 && row < 3) {
            // Margin within cell
            if (cellX > 0.18 && cellX < 0.82 && cellY > 0.20 && cellY < 0.80) {
              if ((row + col) % 2 === 0) {
                // Active reserved space cell
                r = brandR;
                g = brandG;
                b = brandB;
              } else {
                // Clean white/light neutral cell
                r = 241;
                g = 245;
                b = 249;
              }
            }
          }
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return png;
}

const publicDir = path.resolve('public');

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false }
];

for (const target of targets) {
  const filePath = path.join(publicDir, target.file);
  const png = createIcon(target.size, target.maskable);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated ${target.file} (${target.size}x${target.size})`);
}
