/**
 * Scouting cards: the one-day public page we hand an alliance partner.
 *
 * Pure and platform-free so `npm test` (vitest, node env) covers it. The screens,
 * the query hooks and the offline demo store all go through these functions, and
 * website/allianceinfo/index.html mirrors the shapes defined here.
 */

/** A card is deleted this long after it was last saved (enforced in the database). */
export const CARD_LIFETIME_MS = 24 * 3_600_000;

/** Key of the shared form in app_settings. */
export const CARD_TEMPLATE_KEY = 'alliance_card_template';

// ---- The form ----------------------------------------------------------------

export type CardFieldKind = 'text' | 'number' | 'paragraph';

export type CardField = {
  id: string;
  label: string;
  kind: CardFieldKind;
  value: string;
};

export const CARD_FIELD_KINDS: { value: CardFieldKind; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'number', label: 'Number' },
  { value: 'paragraph', label: 'Long text' },
];

export const MAX_CARD_FIELDS = 24;
export const MAX_LABEL_LENGTH = 60;
export const MAX_VALUE_LENGTH = 1000;

/** The form a team starts with, before anyone has customized it. */
export const DEFAULT_CARD_FIELDS: CardField[] = [
  { id: 'auton-points', label: 'Auton points', kind: 'number', value: '' },
  { id: 'teleop-points', label: 'TeleOp points', kind: 'number', value: '' },
  { id: 'bot-type', label: 'Type of bot', kind: 'text', value: '' },
  { id: 'compatibility', label: 'Compatibility', kind: 'paragraph', value: '' },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFieldKind = (value: unknown): value is CardFieldKind =>
  value === 'text' || value === 'number' || value === 'paragraph';

/**
 * Rebuilds stored fields from known keys, so whatever JSON is in the database
 * (or pasted into a request) can never reach a screen as anything but a
 * well-formed field. Fields without a label are dropped: a value with no label
 * means nothing to the partner reading it.
 */
export function sanitizeCardFields(value: unknown): CardField[] {
  if (!Array.isArray(value)) return [];
  const fields: CardField[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (fields.length >= MAX_CARD_FIELDS) break;
    if (!isRecord(candidate) || typeof candidate.label !== 'string') continue;
    const label = candidate.label.trim().slice(0, MAX_LABEL_LENGTH);
    if (!label) continue;

    let id =
      typeof candidate.id === 'string' && candidate.id ? candidate.id : `field-${fields.length + 1}`;
    while (seen.has(id)) id = `${id}-${fields.length + 1}`;
    seen.add(id);

    fields.push({
      id,
      label,
      kind: isFieldKind(candidate.kind) ? candidate.kind : 'text',
      value: typeof candidate.value === 'string' ? candidate.value.slice(0, MAX_VALUE_LENGTH) : '',
    });
  }
  return fields;
}

/**
 * The shared form from its app_settings value. A setting that was never saved
 * yields the default form; one saved with every field removed stays empty, because
 * that was somebody's choice.
 */
export function templateFromSetting(value: unknown): CardField[] {
  if (!isRecord(value) || !Array.isArray(value.fields)) return DEFAULT_CARD_FIELDS;
  return sanitizeCardFields(value.fields);
}

/** FTC team numbers are 1 to 5 digits. Returns null for anything else. */
export function parseTeamNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,5}$/.test(trimmed)) return null;
  const team = Number(trimmed);
  return team >= 1 ? team : null;
}

// ---- The link ----------------------------------------------------------------

/**
 * Where a partner opens the card. It lives beside the team website, outside
 * /app, because the partner has no account: gentoo.ethanyanxu.com/allianceinfo/16417.
 */
export function allianceCardUrl(origin: string, team: number): string {
  const base = origin.replace(/\/+$/, '').replace(/\/app$/, '');
  return `${base}/allianceinfo/${team}`;
}

export function isCardExpired(expiresAt: string, now: number): boolean {
  const expires = new Date(expiresAt).getTime();
  return Number.isNaN(expires) || expires <= now;
}

// ---- Auton paths -------------------------------------------------------------

/** Field inches, origin at the centre of the field, +x right and +y up. */
export type FieldPosition = { x: number; y: number };

/**
 * One piece of a path: a straight line, or a cubic Bézier when both control
 * points are present. The same shape as `FieldCurve` in the auton visualizer,
 * so its paths can be pasted in unchanged.
 */
export type AutonCurve = {
  start: FieldPosition;
  end: FieldPosition;
  control1?: FieldPosition;
  control2?: FieldPosition;
};

/** `name` is empty for a path nobody named; pathLabel() gives it one to show. */
export type AutonPath = { name: string; curves: AutonCurve[] };

export type FieldId = 'biobuzz' | 'decode' | 'intothedeep' | 'centerstage';

export type AutonPlan = { field: FieldId; paths: AutonPath[] };

export const FIELD_SIZE_INCHES = 144;
const HALF_FIELD = FIELD_SIZE_INCHES / 2;

/** Same presets, in the same order, as the auton visualizer. */
export const AUTON_FIELDS: { value: FieldId; label: string }[] = [
  { value: 'biobuzz', label: 'Biobuzz' },
  { value: 'decode', label: 'Decode' },
  { value: 'intothedeep', label: 'Into The Deep' },
  { value: 'centerstage', label: 'Centerstage' },
];

export const DEFAULT_FIELD: FieldId = 'biobuzz';

export const MAX_AUTON_PATHS = 6;
export const MAX_PATH_CURVES = 120;
export const MAX_PATH_NAME_LENGTH = 40;

/**
 * One colour per path, by position. Fixed order, never cycled: the list is as
 * long as MAX_AUTON_PATHS. Every path also carries its number on the map, so
 * colour is never the only way to tell two paths apart.
 */
export const AUTON_PATH_COLOURS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
] as const;

/** Ink for the number printed on each colour: white, except on the yellow. */
export const AUTON_PATH_INKS = ['#ffffff', '#ffffff', '#ffffff', '#0b0b0b', '#ffffff', '#ffffff'] as const;

const isFieldId = (value: unknown): value is FieldId =>
  AUTON_FIELDS.some((field) => field.value === value);

const round = (value: number) => Math.round(value * 100) / 100;

function sanitizePosition(value: unknown): FieldPosition | null {
  if (!isRecord(value)) return null;
  const { x, y } = value;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  // A point dragged just past the wall is kept on the wall, not thrown away.
  return {
    x: round(Math.max(-HALF_FIELD, Math.min(HALF_FIELD, x))),
    y: round(Math.max(-HALF_FIELD, Math.min(HALF_FIELD, y))),
  };
}

function sanitizeCurve(value: unknown): AutonCurve | null {
  if (!isRecord(value)) return null;
  const start = sanitizePosition(value.start);
  const end = sanitizePosition(value.end);
  if (!start || !end) return null;
  const control1 = sanitizePosition(value.control1);
  const control2 = sanitizePosition(value.control2);
  // Half a Bézier cannot be drawn, so one control point alone means a line.
  return control1 && control2 ? { start, end, control1, control2 } : { start, end };
}

/**
 * Rebuilds a plan from known keys. Returns null when nothing drawable is left,
 * so callers store "no paths" as null instead of an empty shell.
 */
export function sanitizeAutonPlan(value: unknown): AutonPlan | null {
  const source = Array.isArray(value) ? { paths: value } : value;
  if (!isRecord(source) || !Array.isArray(source.paths)) return null;

  const paths: AutonPath[] = [];
  for (const candidate of source.paths) {
    if (paths.length >= MAX_AUTON_PATHS) break;
    if (!isRecord(candidate) || !Array.isArray(candidate.curves)) continue;
    const curves = candidate.curves
      .map(sanitizeCurve)
      .filter((curve): curve is AutonCurve => curve !== null)
      .slice(0, MAX_PATH_CURVES);
    if (curves.length === 0) continue;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    paths.push({ name: name.slice(0, MAX_PATH_NAME_LENGTH), curves });
  }
  if (paths.length === 0) return null;
  return { field: isFieldId(source.field) ? source.field : DEFAULT_FIELD, paths };
}

export type AutonImport = { plan: AutonPlan } | { error: string };

/**
 * Reads path data pasted from the auton visualizer. Accepts either its list of
 * paths (`[{ id, color, curves }]`) or that list wrapped as `{ field, paths }`.
 */
export function parseAutonImport(text: string): AutonImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'That is not path data. Copy it from the visualizer again.' };
  }
  const plan = sanitizeAutonPlan(parsed);
  return plan ? { plan } : { error: 'There are no paths in that data.' };
}

/** A path sketched by tapping the map: straight lines between the taps, in order. */
export function sketchPath(name: string, points: FieldPosition[]): AutonPath | null {
  if (points.length < 2) return null;
  return {
    name: name.trim().slice(0, MAX_PATH_NAME_LENGTH),
    curves: points.slice(1).map((end, index) => ({ start: points[index], end })),
  };
}

/**
 * What a path is called beside its number. A path with no name is called by its
 * place in the list ("Path 2"), worked out when it is shown and never stored, so
 * the name still matches the number after an earlier path is removed.
 */
export function pathLabel(path: AutonPath, index: number): string {
  return path.name || `Path ${index + 1}`;
}

/** Field inches to pixels in a square map `size` pixels wide. */
export function toViewport(position: FieldPosition, size: number): FieldPosition {
  return {
    x: (position.x / FIELD_SIZE_INCHES + 0.5) * size,
    y: (0.5 - position.y / FIELD_SIZE_INCHES) * size,
  };
}

/** The inverse of toViewport, clamped to the field: where a tap landed. */
export function toField(pixel: FieldPosition, size: number): FieldPosition {
  if (size <= 0) return { x: 0, y: 0 };
  const clamp = (value: number) => Math.max(-HALF_FIELD, Math.min(HALF_FIELD, value));
  return {
    x: round(clamp((pixel.x / size - 0.5) * FIELD_SIZE_INCHES)),
    y: round(clamp((0.5 - pixel.y / size) * FIELD_SIZE_INCHES)),
  };
}

/** What a press event says about where it landed, on native and on the web. */
export type PressLocation = {
  locationX?: number;
  locationY?: number;
  offsetX?: number;
  offsetY?: number;
};

/**
 * Where a press landed inside the pressed view, in pixels from its top-left
 * corner. Native presses report locationX/Y. On the web a press is a click,
 * which has no locationX/Y and reports offsetX/Y instead.
 *
 * Null when the event has no position inside a view `size` pixels wide: a click
 * made from the keyboard or by a screen reader carries no real one, and must not
 * add a point in a corner of the map.
 */
export function pressPoint(event: PressLocation, size: number): FieldPosition | null {
  const isNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const native = isNumber(event.locationX) && isNumber(event.locationY);
  const x = native ? event.locationX : event.offsetX;
  const y = native ? event.locationY : event.offsetY;
  if (!isNumber(x) || !isNumber(y)) return null;
  if (x < 0 || y < 0 || x > size || y > size) return null;
  return { x, y };
}

/** The SVG `d` attribute for a path on a square map `size` pixels wide. */
export function pathData(path: AutonPath, size: number): string {
  const first = path.curves[0];
  if (!first) return '';
  const point = (position: FieldPosition) => {
    const { x, y } = toViewport(position, size);
    return `${round(x)} ${round(y)}`;
  };
  const commands = [`M ${point(first.start)}`];
  for (const curve of path.curves) {
    commands.push(
      curve.control1 && curve.control2
        ? `C ${point(curve.control1)} ${point(curve.control2)} ${point(curve.end)}`
        : `L ${point(curve.end)}`
    );
  }
  return commands.join(' ');
}
