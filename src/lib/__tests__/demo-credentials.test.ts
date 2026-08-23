import { describe, expect, it } from 'vitest';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  checkDemoCredentials,
  normalizeCredential,
} from '@/lib/demo-credentials';

const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
const NBSP = String.fromCodePoint(0x00a0);

describe('normalizeCredential', () => {
  it('trims ordinary whitespace and newlines', () => {
    expect(normalizeCredential('  hunter2 \n')).toBe('hunter2');
  });

  it('trims a non-breaking space, which a clipboard can substitute for a space', () => {
    expect(normalizeCredential(`${NBSP}hunter2${NBSP}`)).toBe('hunter2');
  });

  it('strips zero-width characters from the middle of the string', () => {
    expect(normalizeCredential(`hun${ZERO_WIDTH_SPACE}ter2`)).toBe('hunter2');
  });

  it('leaves a clean value alone', () => {
    expect(normalizeCredential(DEMO_PASSWORD)).toBe(DEMO_PASSWORD);
  });
});

describe('checkDemoCredentials', () => {
  it('accepts the credentials exactly as written in the review notes', () => {
    expect(checkDemoCredentials(DEMO_EMAIL, DEMO_PASSWORD)).toBe('ok');
  });

  // The 2.1(a) rejection: pasting from App Store Connect brings the whitespace.
  it('accepts a password pasted with surrounding whitespace', () => {
    expect(checkDemoCredentials(DEMO_EMAIL, ` ${DEMO_PASSWORD}\n`)).toBe('ok');
  });

  it('accepts an email pasted with whitespace or the wrong case', () => {
    expect(checkDemoCredentials(`  ${DEMO_EMAIL.toUpperCase()} `, DEMO_PASSWORD)).toBe('ok');
  });

  it('accepts credentials carrying zero-width characters', () => {
    expect(
      checkDemoCredentials(`${ZERO_WIDTH_SPACE}${DEMO_EMAIL}`, `${DEMO_PASSWORD}${ZERO_WIDTH_SPACE}`)
    ).toBe('ok');
  });

  it('reports an empty field as empty rather than as a bad password', () => {
    expect(checkDemoCredentials(DEMO_EMAIL, '   ')).toBe('empty');
    expect(checkDemoCredentials('', DEMO_PASSWORD)).toBe('empty');
  });

  it('distinguishes an unknown email from a wrong password', () => {
    expect(checkDemoCredentials('someone@example.com', DEMO_PASSWORD)).toBe('unknown-email');
    expect(checkDemoCredentials(DEMO_EMAIL, 'wrong')).toBe('wrong-password');
  });

  it('stays case-sensitive on the password', () => {
    expect(checkDemoCredentials(DEMO_EMAIL, DEMO_PASSWORD.toLowerCase())).toBe('wrong-password');
  });
});
