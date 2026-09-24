/* =============================================================================
 * SiteHeader —— 站点顶部条（服务端组件）
 *
 * 三个页面共用同一条顶部条，但形态不同，所以这里用 props 表达差异：
 *   - 首页：站点名（带主色方块）+ 右侧搜索框（children）；
 *   - 详情页：‹ 漫画站 + 「/」+ 当前作品名（backHref + current）。
 * 阅读页保留自己的顶部条（ReaderStrip 里）：它要跟着滚动方向收起/显示、
 * 收起时加 inert，交互逻辑与这里不同，硬合并会让两边都变复杂（D-015 不做状态改造）。
 *
 * 提取自 T-004/T-005 就地写在页面里的同一段标记（T-008 第 10 条、D-014）。
 * ========================================================================== */

import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({
  title = "漫画站",
  backHref,
  current,
  children,
}: {
  /** 站点名；有 backHref 时它同时是返回按钮的文字 */
  title?: string;
  /** 有值时渲染「‹ 站点名」作为返回入口（G7：非首页都要能回上一级） */
  backHref?: string;
  /** 当前上下文（详情页显示作品名），超长省略 */
  current?: string;
  /** 右侧插槽：首页放搜索框 */
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/[0.96] backdrop-blur-sm">
      <div className="mx-auto flex min-h-14 max-w-[1120px] items-center gap-2 px-4 md:px-6">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm-site font-semibold text-ink"
          >
            <span aria-hidden="true">‹</span> {title}
          </Link>
        ) : (
          <Link
            href="/"
            // 首页变体里这个链接指向的就是当前页，用 aria-current 明确「你在这里」
            aria-current="page"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 text-base font-bold text-ink"
          >
            <span aria-hidden="true" className="size-[18px] rounded-xs bg-accent" />
            {title}
          </Link>
        )}

        {current ? (
          <>
            <span aria-hidden="true" className="text-ink-disabled">
              /
            </span>
            <span className="min-w-0 truncate text-sm-site text-ink-2">{current}</span>
          </>
        ) : null}

        {children ? (
          <div className="min-w-0 flex-1 md:ml-auto md:max-w-[420px]">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
