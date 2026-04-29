/**
 * Captcha Image Generator
 *
 * Pure Canvas drawing logic — no Angular / DOM-framework dependencies
 * beyond the platform `document`. Renders a hardened captcha PNG from
 * a plain-text code string and returns it as a data URL.
 *
 * Hardening (in order of how much each adds to bot resistance):
 *   1. Per-character random rotation, skew, font size, vertical jitter
 *   2. Variable-color text + drop shadow
 *   3. Background gradient + 3 layers of noise (dots / circles / wavy lines)
 *   4. 8 quadratic-bezier crossing lines through the text
 *   5. Random rectangles + diagonals
 *   6. Per-pixel noise injection on ~5% of pixels
 *
 * Throws if the 2D canvas context is unavailable (extremely rare; only
 * happens in environments without canvas support such as some headless
 * browsers without canvas polyfills).
 */
export function generateCaptchaImage(captchaCode: string): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  canvas.width = 180;
  canvas.height = 60;

  // ─── Background gradient ────────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#f0f0f0');
  gradient.addColorStop(0.5, '#e8e8e8');
  gradient.addColorStop(1, '#f5f5f5');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ─── Noise: small dots ──────────────────────────────────────────────
  ctx.fillStyle = '#d0d0d0';
  for (let i = 0; i < 100; i++) {
    ctx.beginPath();
    const size = Math.random() * 2 + 0.5;
    ctx.arc(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      size,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }

  // ─── Noise: hollow circles ──────────────────────────────────────────
  ctx.strokeStyle = '#c0c0c0';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 5 + 2,
      0,
      2 * Math.PI
    );
    ctx.stroke();
  }

  // ─── Noise: wavy horizontal lines ───────────────────────────────────
  ctx.strokeStyle = '#b0b0b0';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const y = Math.random() * canvas.height;
    ctx.moveTo(0, y);
    for (let x = 0; x < canvas.width; x += 10) {
      ctx.lineTo(x, y + Math.sin(x * 0.1 + i) * 3);
    }
    ctx.stroke();
  }

  // ─── Distorted text ────────────────────────────────────────────────
  const charSpacing = canvas.width / (captchaCode.length + 1);
  const baseY = canvas.height / 2;

  for (let i = 0; i < captchaCode.length; i++) {
    const char = captchaCode[i];
    const baseX = charSpacing * (i + 1);

    const yOffset = (Math.random() - 0.5) * 8;
    const x = baseX + (Math.random() - 0.5) * 3;
    const y = baseY + yOffset;

    const rotation = (Math.random() - 0.5) * 0.5;
    const fontSize = 24 + Math.random() * 8;
    ctx.font = `bold ${fontSize}px Arial`;

    const colorVariation = Math.floor(Math.random() * 80);
    ctx.fillStyle = `rgb(${40 + colorVariation}, ${40 + colorVariation}, ${40 + colorVariation})`;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.transform(1, Math.random() * 0.2 - 0.1, Math.random() * 0.1 - 0.05, 1, 0, 0);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }

  // ─── Crossing curved lines through text ─────────────────────────────
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    const startX = Math.random() * canvas.width;
    const startY = Math.random() * canvas.height;
    const endX = Math.random() * canvas.width;
    const endY = Math.random() * canvas.height;
    ctx.moveTo(startX, startY);
    const cpX = (startX + endX) / 2 + (Math.random() - 0.5) * 20;
    const cpY = (startY + endY) / 2 + (Math.random() - 0.5) * 20;
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.stroke();
  }

  // ─── Random rectangles ──────────────────────────────────────────────
  ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 10 + 2,
      Math.random() * 10 + 2
    );
  }

  // ─── Diagonal lines ─────────────────────────────────────────────────
  ctx.strokeStyle = '#aaaaaa';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, 0);
    ctx.lineTo(Math.random() * canvas.width, canvas.height);
    ctx.stroke();
  }

  // ─── Per-pixel noise (~5% of pixels) ────────────────────────────────
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() > 0.95) {
      const noise = Math.random() * 30 - 15;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
}
