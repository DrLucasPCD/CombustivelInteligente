import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    // Do not expose Git, credentials, source-maintenance or test files in preview.
    if (pathname.split('/').some(part => part.startsWith('.') || ['tmp', 'scripts', 'tests', 'node_modules'].includes(part))) {
      response.writeHead(404); response.end(); return;
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache' });
    response.end(content);
  } catch { response.writeHead(404); response.end('Não encontrado'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://localhost:${port}`));
