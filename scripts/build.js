import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/web', { recursive: true });
for (const file of ['index.html', 'helper.html', 'web/app.js', 'web/style.css']) await copyFile(file, `dist/${file}`);
console.log('Static frontend built in dist/. LAN play opens the local launcher.');
