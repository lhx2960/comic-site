/* =============================================================================
 * ESLint 扁平配置
 *
 * Next.js 官方规则目前仍以 eslintrc 形式发布，这里用 FlatCompat 桥接成扁平配置，
 * 保留 next/core-web-vitals 与 next/typescript 两套规则。
 *
 * 忽略项说明：docs/ 下是设计与预览用的静态页面，public/ 是生成产物，
 * .next/ 是构建产物，都不属于应用代码，不参与 lint。
 * ========================================================================== */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const currentDir = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: currentDir });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "public/**", "docs/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
