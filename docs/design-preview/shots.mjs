// T-002 截图与自检脚本（第 3 次派发：移动端优先重设计）
//
// 为什么这么写（给后来接手的人）：
//  1) 用系统自带 Chrome 的无头模式（CDP），不引入任何 npm 依赖，所以仓库里不会多出 node_modules；
//  2) `chrome --screenshot` 只能截视口大小，这里改用 Page.captureScreenshot(captureBeyondViewport) 拿整页；
//  3) 除了截图，同时跑两组硬指标自检——「无横向滚动（360/390/430/1280）」和「可点区域 ≥44×44」，
//     结果直接打在终端里，作为 docs/reports/T-002.md 的证据。
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
const FILES = ['index.html', 'comics.html', 'detail.html', 'reader.html'];

// 截图清单：手机 = 390px（主设计基准），桌面 = 1280px（增强）。
// dsf 是像素密度；阅读页整页很长（>1.2 万 CSS px），桌面那张降到 1.5 以控制文件体积。
const SHOTS = [
  { file: 'index.html', w: 390, h: 844, dsf: 2, out: 'index-mobile.png' },
  { file: 'index.html', w: 1280, h: 900, dsf: 2, out: 'index-desktop.png' },
  { file: 'index.html', w: 390, h: 844, dsf: 2, out: 'index-states-mobile.png', selector: '#state-samples' },
  { file: 'index.html', w: 1280, h: 900, dsf: 2, out: 'index-states-desktop.png', selector: '#state-samples' },

  { file: 'comics.html', w: 390, h: 844, dsf: 2, out: 'comics-mobile.png' },
  { file: 'comics.html', w: 1280, h: 900, dsf: 2, out: 'comics-desktop.png' },
  { file: 'comics.html', w: 390, h: 844, dsf: 2, out: 'comics-states-mobile.png', selector: '#state-samples' },
  { file: 'comics.html', w: 1280, h: 900, dsf: 2, out: 'comics-states-desktop.png', selector: '#state-samples' },

  { file: 'detail.html', w: 390, h: 844, dsf: 2, out: 'detail-mobile.png' },
  { file: 'detail.html', w: 1280, h: 900, dsf: 2, out: 'detail-desktop.png' },
  { file: 'detail.html', w: 390, h: 844, dsf: 2, out: 'detail-states-mobile.png', selector: '#state-samples' },
  { file: 'detail.html', w: 1280, h: 900, dsf: 2, out: 'detail-states-desktop.png', selector: '#state-samples' },

  // 阅读页整页很长（8986 / 13324 CSS px），这两张整页图降到 1.5x / 1x，避免单张 PNG 上到 2~3MB；
  // 要看细节（1px 分隔线、3px 进度条）用下面的视口截图与状态样张，那几张都是 2x。
  { file: 'reader.html', w: 390, h: 844, dsf: 1.5, out: 'reader-mobile.png' },
  { file: 'reader.html', w: 1280, h: 900, dsf: 1, out: 'reader-desktop.png' },
  { file: 'reader.html', w: 390, h: 844, dsf: 2, out: 'reader-states-mobile.png', selector: '#state-samples' },
  { file: 'reader.html', w: 1280, h: 900, dsf: 2, out: 'reader-states-desktop.png', selector: '#state-samples' },

  // 手机视口截图（390×844，只截首屏）：详情页与阅读页的底栏是「吸底/固定」的，
  // 无头浏览器的整页截图会把固定元素画在页面中部，位置以这两张视口截图为准。
  { file: 'detail.html', w: 390, h: 844, dsf: 2, out: 'detail-mobile-viewport.png', viewport: true },
  { file: 'reader.html', w: 390, h: 844, dsf: 2, out: 'reader-mobile-viewport.png', viewport: true },
];

// 自检用的视口宽度：360 = 最小支持宽度，390 = 主设计基准，430 = 大屏手机，1280 = 桌面增强
const CHECK_WIDTHS = [360, 390, 430, 1280];

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
        const { resolve: res, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`)) : res(msg.result);
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
  waitFor(method, sessionId, timeoutMs = 20000) {
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

/** 打开一个页面（指定视口与像素密度），返回 target 与 session */
async function openPage(cdp, { file, width, height, dsf }) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: dsf, mobile: false },
    sessionId,
  );
  const loaded = cdp.waitFor('Page.loadEventFired', sessionId);
  await cdp.send('Page.navigate', { url: pathToFileURL(join(HERE, file)).href }, sessionId);
  await loaded;
  await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true }, sessionId);
  await sleep(180);
  return { targetId, sessionId };
}

async function evaluate(cdp, sessionId, expression) {
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text ?? '页面脚本执行失败');
  return res.result.value;
}

const MAP_TARGETS_JS = `(() => {
  const out = [];
  document.querySelectorAll('a,button,input,[role="button"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 34),
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 16),
    });
  });
  return out;
})()`;

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

let failures = 0;

try {
  const version = await waitForDevTools();
  console.log(`浏览器: ${version.Browser}`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new Cdp(ws);

  // ---------- 自检 1：横向滚动（360/390/430/1280，四个页面各跑一遍） ----------
  console.log('\n[自检 1] 无横向滚动（判定：scrollWidth <= 视口宽 + 1）');
  for (const width of CHECK_WIDTHS) {
    for (const file of FILES) {
      const { targetId, sessionId } = await openPage(cdp, { file, width, height: 844, dsf: 1 });
      const m = await evaluate(
        cdp,
        sessionId,
        '(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight }))()',
      );
      const ok = m.sw <= m.iw + 1;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? '✓' : '✗'} ${file.padEnd(12)} @${String(width).padEnd(5)} scrollWidth=${m.sw} innerWidth=${m.iw} 页面高=${m.sh}${ok ? '' : '  ← 出现横向滚动'}`,
      );
      await cdp.send('Target.closeTarget', { targetId });
    }
  }

  // ---------- 自检 2：可点区域 ≥44×44（390px，四个页面各跑一遍） ----------
  console.log('\n[自检 2] 可点区域 ≥44×44（判定：每个 a/button/input 的宽高都不小于 44）');
  for (const file of FILES) {
    const { targetId, sessionId } = await openPage(cdp, { file, width: 390, height: 844, dsf: 1 });
    const targets = await evaluate(cdp, sessionId, MAP_TARGETS_JS);
    const bad = targets.filter((t) => t.w < 44 || t.h < 44);
    if (bad.length) failures += 1;
    const minH = Math.min(...targets.map((t) => t.h));
    const minW = Math.min(...targets.map((t) => t.w));
    console.log(
      `  ${bad.length ? '✗' : '✓'} ${file.padEnd(12)} 可点元素 ${String(targets.length).padStart(3)} 个；最小宽 ${minW}px、最小高 ${minH}px${bad.length ? '  ← 有元素小于 44px' : ''}`,
    );
    bad.forEach((t) => console.log(`      · 偏小：<${t.tag} class="${t.cls}"> ${t.w}×${t.h} “${t.text}”`));
    await cdp.send('Target.closeTarget', { targetId });
  }

  // ---------- 截图 ----------
  // ---------- 自检 3：卡片栅格几何（手机 2 列 / ≤340px 单列 / 桌面 3 列） ----------
  console.log('\n[自检 3] 卡片栅格：列数与首卡宽度（读 computed grid-template-columns）');
  for (const file of ['index.html', 'comics.html']) {
    for (const width of [320, 360, 390, 1280]) {
      const { targetId, sessionId } = await openPage(cdp, { file, width, height: 844, dsf: 1 });
      const g = await evaluate(
        cdp,
        sessionId,
        `(() => {
          const box = document.querySelector('.cards');
          const first = box && box.firstElementChild;
          const cols = box ? getComputedStyle(box).gridTemplateColumns.split(' ').filter(Boolean) : [];
          const r = first ? first.getBoundingClientRect() : null;
          const cover = first ? first.querySelector('.cover').getBoundingClientRect() : null;
          return {
            columns: cols.length,
            colWidth: cols.length ? Math.round(parseFloat(cols[0])) : 0,
            cardW: r ? Math.round(r.width) : 0,
            cardH: r ? Math.round(r.height) : 0,
            coverW: cover ? Math.round(cover.width) : 0,
            coverH: cover ? Math.round(cover.height) : 0,
            cardRadius: first ? getComputedStyle(first).borderRadius : '—',
            coverRadius: first ? getComputedStyle(first.querySelector('.cover')).borderRadius : '—',
          };
        })()`,
      );
      const ratio = g.coverW && g.coverH ? (g.coverH / g.coverW).toFixed(2) : '—';
      console.log(
        `  ${file.padEnd(12)} @${String(width).padEnd(5)} ${g.columns} 列 × ${g.colWidth}px；首卡 ${g.cardW}×${g.cardH} 圆角 ${g.cardRadius}；封面 ${g.coverW}×${g.coverH} 圆角 ${g.coverRadius}（比例 1:${ratio}）`,
      );
      await cdp.send('Target.closeTarget', { targetId });
    }
  }

  // ---------- 截图 ----------
  console.log('\n[截图] 每页 390px / 1280px 各一张，状态样张区再各拍一张');
  for (const shot of SHOTS) {
    const { targetId, sessionId } = await openPage(cdp, {
      file: shot.file,
      width: shot.w,
      height: shot.h,
      dsf: shot.dsf,
    });

    let clip;
    if (shot.viewport) {
      // 只截当前视口（手机首屏）：固定/吸底元素的位置以这类截图为准
      clip = { x: 0, y: 0, width: shot.w, height: shot.h, scale: 1 };
    } else if (shot.selector) {
      const rect = await evaluate(
        cdp,
        sessionId,
        `(() => { const el = document.querySelector(${JSON.stringify(shot.selector)});
          const r = el.getBoundingClientRect();
          return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height }; })()`,
      );
      clip = { x: rect.x, y: rect.y, width: Math.ceil(rect.width), height: Math.ceil(rect.height), scale: 1 };
    } else {
      const { cssContentSize } = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
      clip = { x: 0, y: 0, width: Math.ceil(cssContentSize.width), height: Math.ceil(cssContentSize.height), scale: 1 };
    }

    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip }, sessionId);
    const outFile = resolve(HERE, shot.out);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, Buffer.from(data, 'base64'));
    const size = pngSize(outFile);
    console.log(
      `  ✓ ${shot.out.padEnd(26)} CSS ${clip.width}×${clip.height} @${shot.dsf}x → PNG ${size.width}×${size.height} ${(size.bytes / 1024).toFixed(0)}KB`,
    );
    await cdp.send('Target.closeTarget', { targetId });
  }
  ws.close();
} finally {
  child.kill();
}

console.log(failures === 0 ? '\n自检结论：全部通过（0 项不合格）' : `\n自检结论：有 ${failures} 项不合格`);
process.exitCode = failures === 0 ? 0 : 1;
