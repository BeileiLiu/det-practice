import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [url, output, widthArg = '1440', heightArg = '1000', portArg = '9225'] = process.argv.slice(2);
if (!url || !output) {
  console.error('usage: node scripts/capture-page.mjs <url> <output> [width] [height] [debug-port]');
  process.exit(2);
}

const width = Number(widthArg);
const height = Number(heightArg);
const port = Number(portArg);
const target = await fetch(`http://127.0.0.1:${port}/json/new?about%3Ablank`, { method: 'PUT' }).then((res) => res.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve: done, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else done(message.result || {});
};

await new Promise((done, reject) => {
  socket.onopen = done;
  socket.onerror = reject;
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((done, reject) => pending.set(id, { resolve: done, reject }));
}

await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width <= 820,
  screenWidth: width,
  screenHeight: height,
});
await command('Page.navigate', { url });
await new Promise((done) => setTimeout(done, 1800));
const metrics = await command('Runtime.evaluate', {
  expression: '({innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth})',
  returnByValue: true,
});
const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify(metrics.result.value));
socket.close();
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
