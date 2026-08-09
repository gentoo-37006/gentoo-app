import { Platform } from 'react-native';
import { APP_VERSION } from '@/lib/app-version';
import { WEB_URL_OVERRIDE } from '@/lib/env';
import { labelOrigin } from '@/lib/label-origin';
import { qrPath } from '@/lib/qr';
import type { Part } from '@/lib/types';

/** Where a scanned label lands: the part's page in the web app. */
export function partUrl(partId: string): string {
  const origin =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : labelOrigin({
          platform: Platform.OS,
          appVersion: APP_VERSION,
          override: WEB_URL_OVERRIDE,
        });
  return `${origin}/inventory/${partId}`;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (c) => ESCAPES[c]);

function labelHtml(part: Part): string {
  const { path, size } = qrPath(partUrl(part.id));
  const meta = [part.part_number, part.location].filter(Boolean).join(' · ');
  return `<div class="label">
    <svg viewBox="0 0 ${size} ${size}"><path d="${path}" fill="#000"/></svg>
    <div class="text">
      <div class="name">${escapeHtml(part.name)}</div>
      ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
      <div class="meta">Scan to sign in / out</div>
    </div>
  </div>`;
}

export function labelSheetHtml(parts: Part[]): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Inventory labels</title>
<style>
  @page { margin: 10mm; }
  body { margin: 0; font-family: -apple-system, system-ui, "Segoe UI", sans-serif; color: #000; }
  .sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; }
  .label { display: flex; align-items: center; gap: 3mm; padding: 3mm; border: 0.3mm solid #000; break-inside: avoid; }
  .label svg { flex: none; width: 22mm; height: 22mm; }
  .text { min-width: 0; }
  .name { font-size: 11pt; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
  .meta { margin-top: 1mm; font-size: 8pt; color: #444; overflow-wrap: anywhere; }
</style>
</head>
<body><div class="sheet">${parts.map(labelHtml).join('')}</div></body>
</html>`;
}

/**
 * Prints labels from an offscreen iframe so the app's own styles and layout
 * stay out of the printout. Web only — the button that calls this is hidden
 * on native, where there is no print target.
 */
export function printLabels(parts: Part[]) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || parts.length === 0) return;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
  });
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) return;

  doc.open();
  doc.write(labelSheetHtml(parts));
  doc.close();

  const remove = () => frame.remove();
  win.addEventListener('afterprint', remove);
  // Safari never fires afterprint from an iframe; clean up regardless.
  setTimeout(remove, 60_000);
  setTimeout(() => {
    win.focus();
    win.print();
  }, 100);
}
