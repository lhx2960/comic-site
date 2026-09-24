/* =============================================================================
 * EmptyState —— 空状态（服务端组件）
 *
 * 「搜索/筛选后 0 条」和「一部漫画都没有」两种场景共用这个块（PRD G2、ui.md §6）：
 * 每个状态都必须给出下一步动作，所以 actions 至少一项；按钮都是链接，
 * 点了就换 URL，于是「清除关键词」只是换一个查询串而已。
 *
 * 文案由调用方传入：同一个组件在不同场景说不同的话，避免这里出现 if 分支。
 * 所有按钮都是 inline-flex + min-h-11，保证 44px 触控底线（ui.md §7.1 的坑：
 * 行内 <a> 写 min-height 不生效）。
 * ========================================================================== */

import Link from "next/link";

export function EmptyState({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: { label: string; href: string }[];
}) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface px-4 py-10 text-center">
      {/* 虚线插画块：纯装饰，不进无障碍树 */}
      <div
        aria-hidden="true"
        className="mx-auto mb-4 size-12 rounded-sm border border-dashed border-line-strong bg-subtle"
      />
      <h2 className="text-h3 font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-[42ch] text-sm-site text-ink-2">{description}</p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {actions.map((action) => (
          <Link
            key={action.href + action.label}
            href={action.href}
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-line-control px-4 text-sm-site font-semibold text-ink"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
