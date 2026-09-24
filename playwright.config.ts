/* =============================================================================
 * Playwright 配置（T-009：独立验证的 E2E 层）
 *
 * 设计要点与理由：
 *
 * 1) 两个 project：
 *    - `chromium` 跑全部用例（G5 的浏览器矩阵里 Chrome/Edge 都是 Chromium 内核）；
 *    - `webkit` 只跑标题里带 `@webkit` 的关键路径（Safari 内核），
 *      因为 WebKit 在本机与 CI 上启动更慢，全量跑收益低。
 *
 * 2) webServer 跑的是**生产构建产物**（D-019：E2E 必须验证要发布的产物）：
 *    命令 = `pnpm build && pnpm start --port 3100`。不再用 `pnpm dev` 的原因是有实证：
 *    同一份代码在 dev 与 prod 下行为不一致（`/comics/xinghai/9` 的 404 文案一个对一个错，
 *    见 T-012 回报），而 E2E 是发布前最后一道闸，必须验真身而不是开发态。
 *
 *    端口固定 3100：本地 `reuseExistingServer` 为 true，已有服务在跑就直接复用
 *    （所以跑之前要确认 3100 上没有残留的 **dev** server，否则会验成开发态产物）；
 *    CI 下为 false，永远自己起。
 *
 * 3) 超时：`build` 的耗时计入 webServer.timeout（这里给 5 分钟，本机实测 build 约 30–60s），
 *    用例内 90s 的 timeout 是留给断言与滚动交互的，不是留给编译的。
 *
 * 4) 产物目录**继续放在仓库之外**（系统临时目录，`%TEMP%\comic-site-e2e`）。
 *    起因是一次实测故障（T-009 报告 F-04）：Playwright 把 trace/screenshot 分片
 *    写进仓库目录时，`next dev` 的文件监听会把这些写入当成源码变更反复重编译，
 *    每次重编译都会中断客户端软导航（RSC 请求被 ERR_ABORTED 掉），表现为
 *    「点链接地址栏不动」。现在 webServer 已经是生产构建（不监听文件），但这条
 *    仍然保留：① 谁临时切回 dev 就会再次踩坑；② 测试产物本来就不该进版本库。
 *    覆盖产物位置：设置环境变量 E2E_ARTIFACT_DIR。
 * ========================================================================== */

import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

/** 与 webServer.command 保持一致；换端口只要改这一处 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** 产物根目录：默认在系统临时目录，避免被 next dev 的文件监听看到 */
const ARTIFACT_ROOT = process.env.E2E_ARTIFACT_DIR ?? join(tmpdir(), "comic-site-e2e");

export default defineConfig({
  testDir: "./e2e",
  // 用例之间不共享 storage 状态（每个 test 一个全新 context），可以放心并行
  fullyParallel: true,
  // 本地不做 retry：失败必须被看见，测试会话的价值就是「不替实现者背书」
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: Boolean(process.env.CI),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: join(ARTIFACT_ROOT, "report") }],
    ["json", { outputFile: join(ARTIFACT_ROOT, "report", "results.json") }],
  ],
  outputDir: join(ARTIFACT_ROOT, "artifacts"),
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // 站点是纯中文界面，固定语言让字体与换行在 CI 与本机一致
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      grep: /@webkit/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    // D-019：验证要发布的产物 —— 先生产构建，再用 next start 起服务
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // build + 启动 + 首次探活的总预算（本机实测 build 30–60s）
    timeout: 300_000,
    // 把 build/启动日志打到测试输出里，作为「跑的是生产构建」的证据
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // 与 next.config.mjs 的默认值一致：别在受限环境里往用户目录写遥测文件
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
