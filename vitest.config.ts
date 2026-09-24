/* =============================================================================
 * Vitest 配置 —— 单元测试只跑纯逻辑与小组件
 *
 * 别名必须与 tsconfig.json 的 paths 保持一致（Vitest 不会自己读 tsconfig 的 paths）：
 *   @/*     -> src/*
 *   @data/* -> data/*
 * 默认环境是 node（访问层、URL 解析都是纯函数）；需要 DOM 的组件测试在文件顶部
 * 写 `// @vitest-environment jsdom` 单独声明，让大部分测试保持轻量。
 * ========================================================================== */

import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@data": fileURLToPath(new URL("./data", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
});
