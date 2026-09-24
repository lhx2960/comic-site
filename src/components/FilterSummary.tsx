/* =============================================================================
 * FilterSummary —— 生效的筛选条件摘要（服务端组件）
 *
 * 「已选条件」+ 若干只读条件 chip + 「清除筛选」。只在真的带着条件时渲染，
 * 是 F2-3「页面上能看到当前生效的筛选条件」与 F2-4「清除筛选」的落点。
 * 条件文案由调用方拼好传进来，组件本身不关心 URL 结构（提取自 T-004 的
 * page.tsx，T-008 第 10 条）。
 * ========================================================================== */

import Link from "next/link";

export function FilterSummary({
  conditions,
  clearHref = "/",
}: {
  /** 形如 ["关键词「zzzz」", "标签「科幻」"] */
  conditions: string[];
  clearHref?: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <p className="text-label tracking-[0.06em] text-ink-3">已选条件</p>

      {conditions.map((condition) => (
        <span
          key={condition}
          className="inline-flex h-8 items-center rounded-pill bg-accent-soft px-3 text-caption text-accent"
        >
          {condition}
        </span>
      ))}

      <Link
        href={clearHref}
        className="inline-flex min-h-11 items-center rounded-sm border border-line-control px-3 text-sm-site font-semibold text-ink"
      >
        清除筛选
      </Link>
    </div>
  );
}
