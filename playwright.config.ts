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
 * 2) webServer 用 `pnpm dev`（任务单要求「能在本地对 pnpm dev 起的站点跑用例」）：
 *    端口用 3100 而不是 3000，避免和开发者已经开着的 dev server 抢端口。
 *    `reuseExistingServer` 本地为 true：重复执行 `pnpm e2e` 不必反复冷启动。
 *
 * 3) 超时给得很宽：dev 模式首次访问某个路由要现场编译（几百毫秒到十几秒），
 *    E2E 断言的是行为正确性，不是首字节时间。
 *
 * 4) 产物目录**必须放在仓库之外**（系统临时目录）。原因不是洁癖，是实测故障：
 *    Playwright 在跑用例时会把 trace/screenshot 分片写进产物目录，而 `next dev`
 *    的文件监听会把这些写入当成源码变更反复重编译；每次重编译都会中断客户端
 *    软导航（RSC 请求被 ERR_ABORTED 掉），表现为「点链接地址栏不动」。
 *    把产物写到仓库外，dev server 就看不到这些写入，用例才能稳定。
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
    command: `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // 与 next.config.mjs 的默认值一致：别在受限环境里往用户目录写遥测文件
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
