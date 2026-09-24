/* =============================================================================
 * 根布局 —— App Router 的最外层壳子，包裹所有路由
 *
 * 在 App Router 里 layout.tsx 接收 children 并原样渲染，页面切换时它本身不会
 * 卸载，所以「跨页面不重复渲染的东西」和全局样式都放在这里。它必须导出
 * <html> 与 <body>，这是 App Router 的硬性要求。
 *
 * 这一层运行在服务端（Server Component），不写任何客户端状态。它负责三件事：
 *   1. 站点级元信息（lang、标题模板、描述）；
 *   2. 视口声明 —— viewportFit: "cover" 是 env(safe-area-inset-*) 生效的前提，
 *      阅读页底栏与详情页吸底按钮的「下巴留白」都依赖它；
 *   3. 全站底色与字体（用语义令牌，阅读页容器再用 data-theme="reader" 覆盖）。
 *
 * 站点名与「返回首页」入口由各页自己的顶部条承担（首页是站点名 + 搜索框，
 * 详情/阅读页是「‹ 漫画站」+ 当前作品名）：这是 ui.md §5 的逐页规格，
 * 放进 layout 反而会让首页出现两个页头。
 * ========================================================================== */

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "漫画站",
    template: "%s · 漫画站",
  },
  description: "用 Next.js App Router 实现的漫画站 MVP：浏览、搜索、阅读与本机进度。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 让页面铺满刘海屏的安全区，env(safe-area-inset-*) 才会取到真实值
  viewportFit: "cover",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      {/* bg-base / text-ink 是 @theme 语义层生成的令牌类，颜色只在这一处流转 */}
      <body className="min-h-dvh bg-base font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
