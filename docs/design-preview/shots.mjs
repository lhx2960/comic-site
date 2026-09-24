// T-002 截图脚本：用系统自带 Chrome 的无头模式（CDP）给每个预览页截「整页 + 2 倍像素密度」的 PNG。
// 为什么这么写：
//  1) 单独用 `chrome --screenshot` 只能截视口大小（实测 390x800 就是 390x800），截不到整页；
//     这里改用 Chrome DevTools Protocol 的 Page.captureScreenshot(captureBeyondViewport) 拿整页。
//  2) 用 deviceScaleFactor:2 让截图是视网膜分辨率，评审时能看清 1px 边框与文字。
//  3) 不依赖任何 npm 包（Node 22 自带 fetch / WebSocket），所以不用往仓库里装 node_modules。
//
// 用法（在仓库根目录）：node docs/design-preview/shots.mjs

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 9333;
const SHOTS = [
  { file: 'index.html', width: 390, height: 844, out: 'index-mobile.png' },
  { file: 'index.html', width: 1280, height: 900, out: 'index-desktop.png' },
  { file: 'comics.html', width: 390, height: 844, out: 'comics-mobile.png' },
  { file: 'comics.html', width: 1280, height: 900, out: 'comics-desktop.png' },
  { file: 'detail.html', width: 390, height: 844, out: 'detail-mobile.png' },
  { file: 'detail.html', width: 1280, height: 900, out: 'detail-desktop.png' },
  { file: 'reader.html', width: 390, height: 844, out: 'reader-mobile.png' },
  { file: 'reader.html', width: 1280, height: 900, out: 'reader-desktop.png' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error('没找到本机 Chrome/Edge，请手动指定可执行文件路径');
  return found;
}

async function waitForDevTools(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      /* 浏览器还没起来，继续等 */
    }
    await sleep(150);
  }
  throw new Error('等待 Chrome DevTools 端口超时');
}

/** 极简 CDP 客户端：发命令 + 等事件，够这个脚本用 */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.waiters = [];
    ws.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8');
      const msg = JSON.parse(raw);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`)) : resolve(msg.result);
      } else if (msg.method) {
        this.waiters = this.waiters.filter((w) => {
          if (w.method !== msg.method || (w.sessionId && w.sessionId !== msg.sessionId)) return true;
          w.resolve(msg.params);
          return false;
        });
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  waitFor(method, sessionId, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`等待事件 ${method} 超时`)), timeoutMs);
      this.waiters.push({
        method,
        sessionId,
        resolve: (params) => {
          clearTimeout(timer);
          resolve(params);
        },
      });
    });
  }
}

function pngSize(file) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

const chrome = findChrome();
const userDataDir = mkdtempSync(join(tmpdir(), 'comic-site-shots-'));
const child = spawn(
  chrome,
  [
    '--headless=new',
    '--no-sandbox', // 沙箱环境里 GPU 进程起不来，实测必须给这个参数
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-crash-reporter',
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${PORT}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  const version = await waitForDevTools();
  console.log(`浏览器: ${version.Browser}`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new Cdp(ws);

  for (const shot of SHOTS) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: shot.width, height: shot.height, deviceScaleFactor: 2, mobile: false },
      sessionId,
    );
    const url = pathToFileURL(join(HERE, shot.file)).href;
    const loaded = cdp.waitFor('Page.loadEventFired', sessionId);
    await cdp.send('Page.navigate', { url }, sessionId);
    await loaded;
    // 等字体与布局稳定，再量内容高度（量出来的高度用来截整页）
    await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true }, sessionId);
    await sleep(250);
    const { cssContentSize } = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
    const width = Math.ceil(cssContentSize.width);
    const height = Math.ceil(cssContentSize.height);
    const { data } = await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } },
      sessionId,
    );
    const outFile = resolve(HERE, shot.out);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, Buffer.from(data, 'base64'));
    const size = pngSize(outFile);
    console.log(
      `✓ ${shot.out.padEnd(20)} CSS ${width}x${height} → PNG ${size.width}x${size.height} ${(size.bytes / 1024).toFixed(0)}KB (${shot.file})`,
    );
    await cdp.send('Target.closeTarget', { targetId });
  }
  ws.close();
} finally {
  child.kill();
}
