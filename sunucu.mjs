// 127.0.0.1 üzerinde tek port: HTTP ile index.html'i sunar, aynı portta WebSocket açar.
// (LIVE Studio "Bağlantı" ve OBS "Tarayıcı" kaynağı http://127.0.0.1:8765/?temiz=1 adresini açar.)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';

export const HOST = '127.0.0.1';
const SAYFA = new URL('./index.html', import.meta.url);

export function sunucuAc(port) {
  const http_ = http.createServer(async (istek, yanit) => {
    const yol = new URL(istek.url, 'http://x').pathname;
    if (istek.method !== 'GET' || (yol !== '/' && yol !== '/index.html')) {
      yanit.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); yanit.end('yok'); return;
    }
    try {
      const html = await readFile(SAYFA);
      yanit.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      yanit.end(html);
    } catch (e) { yanit.writeHead(500); yanit.end(String(e.message)); }
  });
  const wss = new WebSocketServer({ server: http_ });
  wss.on('error', () => {}); // ws, http hatasını buraya da aktarır; asıl işleme aşağıdaki 'hazir' sözünde
  const hazir = new Promise((ok, hata) => {
    http_.once('error', (e) => hata(e.code === 'EADDRINUSE'
      ? new Error(`Port ${port} kullanımda: başka bir köprü ya da sahte-test açık olabilir, önce onu durdur.`) : e));
    http_.listen(port, HOST, ok);
  });
  const yolla = (o) => {
    const v = JSON.stringify({ ...o, zaman: Date.now() });
    for (const ws of wss.clients) if (ws.readyState === 1) ws.send(v);
  };
  const kapat = () => new Promise((ok) => {
    for (const ws of wss.clients) ws.terminate();
    wss.close(); http_.close(() => ok()); http_.closeAllConnections?.();
  });
  return { wss, hazir, yolla, kapat, adres: `http://${HOST}:${port}/` };
}
