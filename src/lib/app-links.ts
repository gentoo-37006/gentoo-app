export const APP_WEB_PATH = '/app';

/** Public web paths always include the app mount point, exactly once. */
export function appWebPath(path = '/'): string {
  const relative = path.startsWith('/') ? path : `/${path}`;
  if (relative === APP_WEB_PATH || relative.startsWith(`${APP_WEB_PATH}/`) ||
      relative.startsWith(`${APP_WEB_PATH}?`) || relative.startsWith(`${APP_WEB_PATH}#`)) {
    return relative;
  }
  return `${APP_WEB_PATH}${relative === '/' ? '' : relative}`;
}

export function appWebUrl(origin: string, path = '/'): string {
  const base = origin.replace(/\/+$/, '').replace(/\/app$/, '');
  return `${base}${appWebPath(path)}`;
}

/** Native routes have no web mount point; retain legacy links and OAuth URLs. */
export function nativeAppPath(path: string): string {
  try {
    const url = new URL(path, 'https://gentoo.ethanyanxu.com');
    if (url.protocol !== 'https:' && url.protocol !== 'http:' &&
        !(url.protocol === 'gentoo:' && url.hostname === 'app')) return path;
    const pathname = url.protocol === 'gentoo:' ? `/app${url.pathname}` : url.pathname;
    if (pathname !== APP_WEB_PATH && !pathname.startsWith(`${APP_WEB_PATH}/`)) return path;
    return `${pathname.slice(APP_WEB_PATH.length) || '/'}${url.search}${url.hash}`;
  } catch {
    return path;
  }
}

const APP_ROUTE_ROOTS = new Set([
  'dashboard', 'projects', 'inventory', 'competition', 'scouting', 'picklist', 'talkie',
  'schedule', 'driver-station', 'notifications', 'settings', 'admin', 'downloads',
]);

/** Only allow local app screens as destinations after authentication. */
export function appReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') ||
      value.includes('\\') || /[\u0000-\u0020\u007f]/.test(value)) return null;
  const internal = nativeAppPath(value);
  const url = new URL(internal, 'https://gentoo.ethanyanxu.com');
  if (url.origin !== 'https://gentoo.ethanyanxu.com') return null;
  const destination = `${url.pathname}${url.search}${url.hash}`;
  if (url.pathname === '/') return destination;
  return APP_ROUTE_ROOTS.has(url.pathname.split('/')[1]) ? destination : null;
}
