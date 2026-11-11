import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CARD_FIELDS,
  DEFAULT_FIELD,
  MAX_AUTON_PATHS,
  MAX_CARD_FIELDS,
  MAX_LABEL_LENGTH,
  MAX_VALUE_LENGTH,
  allianceCardUrl,
  isCardExpired,
  parseAutonImport,
  parseTeamNumber,
  pathData,
  pathLabel,
  pressPoint,
  sanitizeAutonPlan,
  sanitizeCardFields,
  sketchPath,
  templateFromSetting,
  toField,
  toViewport,
} from '@/lib/alliance-card';

describe('sanitizeCardFields', () => {
  it('keeps well-formed fields as they are', () => {
    const fields = [
      { id: 'a', label: 'Auton points', kind: 'number', value: '32' },
      { id: 'b', label: 'Compatibility', kind: 'paragraph', value: 'We take the far side.' },
    ];
    expect(sanitizeCardFields(fields)).toEqual(fields);
  });

  it('drops a field with no label, because a bare value tells the partner nothing', () => {
    expect(sanitizeCardFields([{ id: 'a', label: '   ', kind: 'text', value: 'x' }])).toEqual([]);
  });

  it('falls back to short text for an unknown kind and to an empty value', () => {
    expect(sanitizeCardFields([{ id: 'a', label: 'Bot', kind: 'slider', value: 7 }])).toEqual([
      { id: 'a', label: 'Bot', kind: 'text', value: '' },
    ]);
  });

  it('gives every field its own id, since the screens key rows by it', () => {
    const ids = sanitizeCardFields([
      { id: 'same', label: 'One' },
      { id: 'same', label: 'Two' },
      { label: 'Three' },
    ]).map((field) => field.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('clips labels, values and the number of fields', () => {
    const many = Array.from({ length: MAX_CARD_FIELDS + 5 }, (_, index) => ({
      id: `f${index}`,
      label: 'L'.repeat(MAX_LABEL_LENGTH + 10),
      value: 'v'.repeat(MAX_VALUE_LENGTH + 10),
    }));
    const fields = sanitizeCardFields(many);
    expect(fields).toHaveLength(MAX_CARD_FIELDS);
    expect(fields[0].label).toHaveLength(MAX_LABEL_LENGTH);
    expect(fields[0].value).toHaveLength(MAX_VALUE_LENGTH);
  });

  it('returns nothing for anything that is not a list', () => {
    expect(sanitizeCardFields(null)).toEqual([]);
    expect(sanitizeCardFields({ fields: [] })).toEqual([]);
  });
});

describe('templateFromSetting', () => {
  it('starts a team that never saved a form on the default one', () => {
    expect(templateFromSetting(null)).toEqual(DEFAULT_CARD_FIELDS);
    expect(templateFromSetting({})).toEqual(DEFAULT_CARD_FIELDS);
  });

  it('keeps a form somebody emptied on purpose empty', () => {
    expect(templateFromSetting({ fields: [] })).toEqual([]);
  });

  it('reads the saved fields', () => {
    expect(templateFromSetting({ fields: [{ id: 'x', label: 'Drivetrain', value: 'Mecanum' }] })).toEqual([
      { id: 'x', label: 'Drivetrain', kind: 'text', value: 'Mecanum' },
    ]);
  });
});

describe('parseTeamNumber', () => {
  it('reads a team number, ignoring the space a keyboard adds', () => {
    expect(parseTeamNumber(' 16417 ')).toBe(16417);
  });

  it('refuses anything that is not 1 to 5 digits', () => {
    for (const input of ['', '0', '-5', '1.5', '164170', 'team 7', '1e3']) {
      expect(parseTeamNumber(input)).toBeNull();
    }
  });
});

describe('allianceCardUrl', () => {
  it('puts the card beside the team website, not under /app', () => {
    expect(allianceCardUrl('https://gentoo.ethanyanxu.com', 16417)).toBe(
      'https://gentoo.ethanyanxu.com/allianceinfo/16417'
    );
  });

  it('accepts the app origin with a trailing slash or the /app mount', () => {
    // window.location.origin never has these, but EXPO_PUBLIC_WEB_URL might.
    expect(allianceCardUrl('https://gentoo.ethanyanxu.com/', 7)).toBe(
      'https://gentoo.ethanyanxu.com/allianceinfo/7'
    );
    expect(allianceCardUrl('https://beta.gentoo.ethanyanxu.com/app', 7)).toBe(
      'https://beta.gentoo.ethanyanxu.com/allianceinfo/7'
    );
  });
});

describe('isCardExpired', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');

  it('is live until the expiry instant and expired from it on', () => {
    expect(isCardExpired('2026-11-10T12:00:01Z', now)).toBe(false);
    expect(isCardExpired('2026-11-10T12:00:00Z', now)).toBe(true);
  });

  it('treats an unreadable date as expired rather than as live forever', () => {
    expect(isCardExpired('not a date', now)).toBe(true);
  });
});

describe('sanitizeAutonPlan', () => {
  const line = { start: { x: -60, y: -60 }, end: { x: 0, y: 12 } };

  it('accepts the visualizer path list as it is', () => {
    // FieldPath[] from the auton visualizer: id and color are its own business.
    const plan = sanitizeAutonPlan([{ id: 'p1', color: '#f00', curves: [line] }]);
    // It has no names, so the paths are left unnamed: pathLabel() numbers them when shown.
    expect(plan).toEqual({ field: DEFAULT_FIELD, paths: [{ name: '', curves: [line] }] });
  });

  it('keeps a full Bézier and turns half of one into a line', () => {
    const bezier = { ...line, control1: { x: -40, y: -20 }, control2: { x: -10, y: 0 } };
    const half = { ...line, control1: { x: -40, y: -20 } };
    const plan = sanitizeAutonPlan({ field: 'decode', paths: [{ name: 'Far side', curves: [bezier, half] }] });
    expect(plan).toEqual({ field: 'decode', paths: [{ name: 'Far side', curves: [bezier, line] }] });
  });

  it('keeps a point dragged past the wall on the wall', () => {
    const plan = sanitizeAutonPlan([{ curves: [{ start: { x: -200, y: 80 }, end: { x: 0, y: 0 } }] }]);
    expect(plan?.paths[0].curves[0].start).toEqual({ x: -72, y: 72 });
  });

  it('drops curves it cannot draw and paths left with none', () => {
    const plan = sanitizeAutonPlan([
      { name: 'Broken', curves: [{ start: { x: 'a', y: 0 }, end: { x: 0, y: 0 } }, { start: { x: 0, y: 0 } }] },
      { name: 'Good', curves: [line] },
    ]);
    expect(plan?.paths.map((path) => path.name)).toEqual(['Good']);
  });

  it('returns null when nothing drawable is left', () => {
    expect(sanitizeAutonPlan(null)).toBeNull();
    expect(sanitizeAutonPlan({ paths: [] })).toBeNull();
    expect(sanitizeAutonPlan({ paths: [{ name: 'Empty', curves: [] }] })).toBeNull();
  });

  it('keeps at most as many paths as there are colours for', () => {
    const paths = Array.from({ length: MAX_AUTON_PATHS + 3 }, () => ({ curves: [line] }));
    expect(sanitizeAutonPlan(paths)?.paths).toHaveLength(MAX_AUTON_PATHS);
  });

  it('falls back to the default field for one it does not know', () => {
    expect(sanitizeAutonPlan({ field: 'moon', paths: [{ curves: [line] }] })?.field).toBe(DEFAULT_FIELD);
  });
});

describe('parseAutonImport', () => {
  it('reads pasted path data', () => {
    const text = JSON.stringify([{ id: 'a', color: '#00f', curves: [{ start: { x: 0, y: 0 }, end: { x: 24, y: 0 } }] }]);
    expect(parseAutonImport(text)).toEqual({
      plan: { field: DEFAULT_FIELD, paths: [{ name: '', curves: [{ start: { x: 0, y: 0 }, end: { x: 24, y: 0 } }] }] },
    });
  });

  it('says so when the text is not JSON or holds no paths', () => {
    expect(parseAutonImport('class Auto : OpMode()')).toHaveProperty('error');
    expect(parseAutonImport('{"paths": []}')).toHaveProperty('error');
  });
});

describe('sketchPath', () => {
  it('joins the taps with straight lines, in order', () => {
    const a = { x: -60, y: -60 };
    const b = { x: -24, y: -60 };
    const c = { x: -24, y: 0 };
    expect(sketchPath(' Near side ', [a, b, c])).toEqual({
      name: 'Near side',
      curves: [{ start: a, end: b }, { start: b, end: c }],
    });
  });

  it('needs two taps before there is a path', () => {
    expect(sketchPath('One tap', [{ x: 0, y: 0 }])).toBeNull();
  });

  it('leaves a path nobody named without a name', () => {
    expect(sketchPath('  ', [{ x: 0, y: 0 }, { x: 12, y: 0 }])?.name).toBe('');
  });
});

describe('pathLabel', () => {
  const curves = [{ start: { x: 0, y: 0 }, end: { x: 12, y: 0 } }];

  it('uses the name a path was given', () => {
    expect(pathLabel({ name: 'Near side', curves }, 3)).toBe('Near side');
  });

  it('calls an unnamed path by its number, so the two always agree', () => {
    expect(pathLabel({ name: '', curves }, 0)).toBe('Path 1');
    expect(pathLabel({ name: '', curves }, 1)).toBe('Path 2');
  });
});

describe('field and map coordinates', () => {
  it('puts the field centre in the middle and +y at the top', () => {
    expect(toViewport({ x: 0, y: 0 }, 400)).toEqual({ x: 200, y: 200 });
    expect(toViewport({ x: -72, y: 72 }, 400)).toEqual({ x: 0, y: 0 });
    expect(toViewport({ x: 72, y: -72 }, 400)).toEqual({ x: 400, y: 400 });
  });

  it('turns a tap back into the field position it landed on', () => {
    expect(toField({ x: 300, y: 100 }, 400)).toEqual({ x: 36, y: 36 });
    expect(toField(toViewport({ x: -48, y: 24 }, 320), 320)).toEqual({ x: -48, y: 24 });
  });

  it('keeps a tap outside the map on the field, and survives an unmeasured map', () => {
    expect(toField({ x: 500, y: -20 }, 400)).toEqual({ x: 72, y: 72 });
    expect(toField({ x: 10, y: 10 }, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('pressPoint', () => {
  it('reads a native press from locationX/Y', () => {
    expect(pressPoint({ locationX: 120, locationY: 40 }, 400)).toEqual({ x: 120, y: 40 });
  });

  it('reads a web click, which has no locationX/Y, from offsetX/Y', () => {
    expect(pressPoint({ offsetX: 300, offsetY: 100 }, 400)).toEqual({ x: 300, y: 100 });
    expect(toField(pressPoint({ offsetX: 300, offsetY: 100 }, 400)!, 400)).toEqual({ x: 36, y: 36 });
  });

  it('prefers the native position when an event carries both', () => {
    expect(pressPoint({ locationX: 10, locationY: 20, offsetX: 300, offsetY: 100 }, 400)).toEqual({
      x: 10,
      y: 20,
    });
  });

  it('adds no point for a press with no position', () => {
    expect(pressPoint({}, 400)).toBeNull();
    expect(pressPoint({ locationX: Number.NaN, locationY: 10 }, 400)).toBeNull();
    expect(pressPoint({ offsetX: 10 }, 400)).toBeNull();
  });

  it('adds no point for a click placed outside the map, as a keyboard click is', () => {
    expect(pressPoint({ offsetX: -212, offsetY: -340 }, 400)).toBeNull();
    expect(pressPoint({ offsetX: 401, offsetY: 10 }, 400)).toBeNull();
    expect(pressPoint({ offsetX: 0, offsetY: 400 }, 400)).toEqual({ x: 0, y: 400 });
  });
});

describe('pathData', () => {
  it('draws lines and Béziers in one path', () => {
    const path = {
      name: 'P',
      curves: [
        { start: { x: -72, y: -72 }, end: { x: 0, y: 0 } },
        { start: { x: 0, y: 0 }, end: { x: 72, y: 72 }, control1: { x: 0, y: 72 }, control2: { x: 36, y: 72 } },
      ],
    };
    expect(pathData(path, 144)).toBe('M 0 144 L 72 72 C 72 0 108 0 144 0');
  });

  it('is empty for a path with no curves', () => {
    expect(pathData({ name: 'Empty', curves: [] }, 144)).toBe('');
  });
});
