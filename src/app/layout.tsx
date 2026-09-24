/* =============================================================================
 * 根布局 —— App Router 的最外层壳子，包裹所有路由
 *
 * 在 App Router 里 layout.tsx 接收 children 并原样渲染，页面切换时它本身不会
 * 卸载，所以「页头/页脚这类跨页面不重复渲染的东西」和全局样式都放在这里。
 * 它必须导出 <html> 与 <body>，这是 App Router 的硬性要求。
 *
 * 这一层运行在服务端（Server Component），不写任何客户端状态：全站主题由
 * globals.css 的令牌决定，页面内部再按需嵌套自己的布局。
 * ========================================================================== */

import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "漫画站",
    template: "%s · 漫画站",
  },
  description: "用 Next.js App Router 实现的漫画站 MVP：浏览、搜索、阅读与本机进度。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      {/* bg-base / text-ink 是 @theme 语义层生成的令牌类，颜色只在这一处流转 */}
      <body className="min-h-dvh bg-base font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
