import { describe, expect, it } from 'vitest';
import { appReturnTo, appWebPath, appWebUrl, nativeAppPath } from '@/lib/app-links';

describe('app web links', () => {
  it('mounts every public app link under /app exactly once', () => {
    expect(appWebPath('/')).toBe('/app');
    expect(appWebPath('/dashboard')).toBe('/app/dashboard');
    expect(appWebPath('/inventory/part-1')).toBe('/app/inventory/part-1');
    expect(appWebPath('/app/inventory/part-1')).toBe('/app/inventory/part-1');
    expect(appWebPath('/application')).toBe('/app/application');
    expect(appWebUrl('https://gentoo.ethanyanxu.com/', '/inventory/part-1'))
      .toBe('https://gentoo.ethanyanxu.com/app/inventory/part-1');
    expect(appWebUrl('https://parts.example.org/app/', '/inventory/part-1'))
      .toBe('https://parts.example.org/app/inventory/part-1');
  });
});

describe('native app links', () => {
  it.each(['gentoo.ethanyanxu.com', 'beta.gentoo.ethanyanxu.com'])(
    'opens a prefixed QR link on %s at the native part screen', (host) => {
      expect(nativeAppPath(`https://${host}/app/inventory/part-1?tab=stock#checkout`))
        .toBe('/inventory/part-1?tab=stock#checkout');
    }
  );

  it('handles the app root, relative links, and custom app scheme', () => {
    expect(nativeAppPath('https://gentoo.ethanyanxu.com/app')).toBe('/');
    expect(nativeAppPath('/app/projects/project-1')).toBe('/projects/project-1');
    expect(nativeAppPath('/app/dashboard/')).toBe('/dashboard/');
    expect(nativeAppPath('gentoo://app/inventory/part-1')).toBe('/inventory/part-1');
  });

  it('preserves legacy labels, native OAuth callbacks, and development links', () => {
    for (const link of [
      'https://gentoo.ethanyanxu.com/inventory/part-1',
      'gentoo://callback?code=abc',
      'exp://localhost:8081/--/inventory/part-1',
      'https://gentoo.ethanyanxu.com/application',
    ]) expect(nativeAppPath(link)).toBe(link);
  });
});

describe('returning after sign-in', () => {
  it('accepts local app destinations with or without the web prefix', () => {
    expect(appReturnTo('/app/inventory/part-1')).toBe('/inventory/part-1');
    expect(appReturnTo('/projects/project-1?task=task-1')).toBe('/projects/project-1?task=task-1');
    expect(appReturnTo('/app/driver-station')).toBe('/driver-station');
    expect(appReturnTo('/app/dashboard/')).toBe('/dashboard/');
    expect(appReturnTo('/')).toBe('/');
  });

  it('rejects external destinations and authentication loops', () => {
    for (const path of [
      'https://example.com', '//example.com/inventory', '/sign-in', '/app/pending',
      '/inventory/../../sign-in', '/\\example.com', '/app//example.com',
      '/\n/example.com', null, ['inventory'],
    ]) expect(appReturnTo(path)).toBeNull();
  });
});
