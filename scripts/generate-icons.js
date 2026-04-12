/**
 * 生成 Chrome 扩展图标
 * 使用纯 Canvas API 绘制简约的请求录制器图标
 * 运行: node scripts/generate-icons.js
 */
const { createCanvas } = (() => {
  try {
    return require('canvas');
  } catch {
    // 如果没有 canvas 包，用简单的 SVG 转 PNG 方案
    return { createCanvas: null };
  }
})();

const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const outDir = path.join(__dirname, '..', 'public', 'icons');

// 生成 SVG 图标内容
function generateSvg(size) {
  const r = size / 2;
  const strokeW = Math.max(1, size / 16);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#1677ff"/>
  <circle cx="${r}" cy="${r}" r="${r * 0.35}" fill="none" stroke="#fff" stroke-width="${strokeW}"/>
  <circle cx="${r}" cy="${r}" r="${r * 0.15}" fill="#ff4d4f"/>
  <rect x="${r - strokeW/2}" y="${size * 0.12}" width="${strokeW}" height="${r * 0.35}" fill="#fff" rx="${strokeW/2}"/>
</svg>`;
}

// 确保目录存在
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 生成各尺寸 SVG 图标
sizes.forEach((size) => {
  const svg = generateSvg(size);
  const filePath = path.join(outDir, `icon${size}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`Generated: ${filePath}`);
});

console.log('Done! SVG icons generated. Update manifest.json to use .svg extensions.');