/* =============================================================================
 * SectionHeading —— 分节标题（服务端组件）
 *
 * 「全部漫画 / 筛选结果 + 共 N 部」这一行在首页出现，阅读页与详情页也有同构的
 * 标题行，所以抽成组件统一字级与间距（提取自 T-004 的 page.tsx，T-008 第 10 条）。
 * ========================================================================== */

export function SectionHeading({
  title,
  countLabel,
  className = "mt-6 mb-3",
}: {
  title: string;
  /** 计数文案，例如「共 3 部」 */
  countLabel?: string;
  /** 允许调用方调整上边距（例如接在条件摘要后面） */
  className?: string;
}) {
  return (
    <div className={`${className} flex flex-wrap items-baseline gap-2`}>
      <h2 className="text-h2 font-semibold text-ink">{title}</h2>
      {countLabel ? <p className="text-sm-site text-ink-3">{countLabel}</p> : null}
    </div>
  );
}
