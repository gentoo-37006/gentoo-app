import createQr from 'qrcode-generator';

/**
 * A QR code as a single SVG path on a square viewBox, so the same geometry can
 * be drawn with react-native-svg on screen and as inline SVG in printed labels.
 * The quiet zone (`margin`) is baked into the viewBox — scanners need it.
 */
export function qrPath(text: string, margin = 2): { path: string; size: number } {
  const qr = createQr(0, 'M');
  qr.addData(text);
  qr.make();

  const modules = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return { path, size: modules + margin * 2 };
}
