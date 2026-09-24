/* =============================================================================
 * PostCSS 配置 —— Tailwind CSS v4 的接入点
 *
 * Tailwind v4 不再需要 tailwind.config.js：设计令牌直接写在
 * src/app/globals.css 的 @theme 里，这个插件负责把 @import "tailwindcss"
 * 与 @theme 编译成真正的 CSS。仍然需要它，是因为 Next.js 在构建期会调用 PostCSS。
 * ========================================================================== */

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
