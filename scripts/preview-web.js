const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const dist = path.resolve(__dirname, '../dist');
const legacyRoutes = new Set([
  'sign-in', 'pending', 'downloads', 'projects', 'inventory', 'competition',
  'scouting', 'picklist', 'talkie', 'schedule', 'driver-station', 'notifications',
  'settings', 'admin',
]);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.webp': 'image/webp',
};

const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (legacyRoutes.has(pathname.split('/')[1])) {
      response.writeHead(302, { Location: `/app${url.pathname}${url.search}` });
      response.end();
      return;
    }
    let file = path.resolve(dist, `.${pathname}`);
    if (file !== dist && !file.startsWith(`${dist}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) && (pathname === '/app' || pathname.startsWith('/app/'))) {
      file = path.join(dist, 'app/index.html');
    }
    if (!fs.existsSync(file)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': pathname === '/.well-known/apple-app-site-association'
        ? 'application/json' : mimeTypes[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(response);
  } catch {
    response.writeHead(400).end('Bad request');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') server.listen(0, '127.0.0.1');
  else throw error;
});
server.listen(Number(process.env.PORT) || 4173, '127.0.0.1', () => {
  console.log(`Team website: http://127.0.0.1:${server.address().port}`);
  console.log(`Gentoo app: http://127.0.0.1:${server.address().port}/app`);
});
