/* =============================================================================
 * ComicGrid —— 卡片网格容器（服务端组件）
 *
 * 手机 2 列、`≤340px` 由卡片自己退化成单列横向卡、桌面按
 * `repeat(auto-fill, minmax(280px,1fr))` 排（ui.md §5.1/§8.1）。
 * 把栅格从页面里抽出来，是为了让「列数与间距」只有一个定义处
 * （提取自 T-004 的 page.tsx，T-008 第 10 条）。
 * ========================================================================== */

import type { ReactNode } from "react";

export function ComicGrid({ children }: { children: ReactNode }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:gap-6">
      {children}
    </ul>
  );
}
