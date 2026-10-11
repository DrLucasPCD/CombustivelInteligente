import { mkdir, cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'src', 'assets']) {
  await cp(file, `dist/${file}`, { recursive: true });
}
console.log('App pronto em dist/');
