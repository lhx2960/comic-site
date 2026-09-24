/* =============================================================================
 * TagFilter —— 标签筛选条（服务端组件）
 *
 * 为什么是服务端组件而不是带 onClick 的客户端按钮：筛选状态放在 URL 里
 * （D-005），链接天然完成「点一下换一次 URL」，刷新、分享、新窗口打开都成立，
 * 不需要客户端状态；这也让客户端组件数量保持在 design.md §5 的预算内。
 *
 * 因此这里用 <a> 而不是 <button aria-pressed>：链接承担导航，选中态用
 * aria-current 表达（ui.md §7.4/§10.10 的按钮方案会把 TagFilter 变成第 4 个
 * 客户端组件，与 design.md §5 冲突 —— 已在 T-004 回报里记录，等架构师裁决）。
 *
 * 手机端横向滚动、桌面换行（ui.md §8.2）；chip 高 44px，满足触控底线。
 * ========================================================================== */

import Link from "next/link";

import { toSearchString } from "@/lib/search-params";
import type { ComicQuery, Tag } from "@/types/comic";

export function TagFilter({
  tags,
  counts,
  query,
}: {
  tags: Tag[];
  /** 每个标签各命中多少部漫画（不叠加当前筛选，用于「科幻 2」这种计数） */
  counts: Record<string, number>;
  query: ComicQuery;
}) {
  return (
    <nav aria-label="按标签浏览" className="mt-4">
      <p className="text-label tracking-[0.06em] text-ink-3">按标签逛</p>

      <ul
        className="mt-2 flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {tags.map((tag) => {
          const selected = query.tag === tag.slug;
          // 单选（Q3）：点新标签替换，点已选中的标签取消，两者都保留关键词
          const nextQuery: ComicQuery = selected
            ? { q: query.q }
            : { q: query.q, tag: tag.slug };

          return (
            <li key={tag.slug} className="shrink-0">
              <Link
                href={`/${toSearchString(nextQuery)}`}
                aria-current={selected ? "true" : undefined}
                className={`inline-flex min-h-11 items-center gap-1 rounded-pill border px-4 text-sm-site whitespace-nowrap ${
                  selected
                    ? "border-accent-soft-line bg-accent-soft font-semibold text-accent"
                    : "border-line-strong text-ink-2"
                }`}
              >
                {tag.name}
                <span className={selected ? "text-accent" : "text-ink-3"}>
                  {counts[tag.slug] ?? 0}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
