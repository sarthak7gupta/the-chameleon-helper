import { request as httpRequest } from 'node:http';
import { createApp } from '../server.js';
export async function setup(t, options) {
  const app = createApp(options);
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  function client() {
    let cookie = '';
    const call = async (path, body, extra = {}) => new Promise((resolve, reject) => {
      const req = httpRequest(base + path, { method: body !== undefined ? 'POST' : 'GET',
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), Cookie: cookie, Origin: base, ...extra } }, res => {
        if (res.headers['set-cookie']) cookie = res.headers['set-cookie'][0].split(';')[0];
        let text = ''; res.on('data', chunk => { text += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(text), headers: res.headers }));
      });
      req.on('error', reject); req.end(body !== undefined ? JSON.stringify(body) : undefined);
    });
    Object.defineProperty(call, 'cookie', { get: () => cookie, set: value => { cookie = value; } });
    return call;
  }
  return { ...app, base, client };
}
