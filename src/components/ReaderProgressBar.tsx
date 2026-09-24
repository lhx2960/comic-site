/* =============================================================================
 * ReaderProgressBar —— 阅读页底部固定进度条（客户端组件）
 *
 * 它是「当前位置」的可视化：一条 3px 轨道 + 按当前页比例填充的主色，
 * 下面一行文字「第 x 话 · 第 y 页 / 共 n 页」和「回到顶部」。
 *
 * 为什么整条固定在底部：阅读时用户不需要为了看进度而滚回顶部；为了避免它压住
 * 画面，阅读页容器在底部预留了 `52px + 安全区`（ui.md §5.4「不遮挡画面」）。
 *
 * 无障碍：外层用 role="progressbar" 并给出 aria-valuemin/valuemax/valuenow，
 * 屏幕阅读器能读出「第 6 页，共 10 页」；文字部分不设 aria-live，避免滚动时
 * 每帧都被朗读（ui.md §10.5）。
 * ========================================================================== */

"use client";

/**
 * 进度百分比（0～100 的整数）。抽成纯函数是为了能被单测直接钉住边界：
 * 第 1 页不是 0%、末页一定是 100%、总页数为 0 时返回 0。
 */
export function progressPercent(page: number, totalPages: number): number {
  if (totalPages <= 0) {
    return 0;
  }
  const ratio = page / totalPages;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function ReaderProgressBar({
  chapter,
  page,
  totalPages,
}: {
  chapter: number;
  page: number;
  totalPages: number;
}) {
  const percent = progressPercent(page, totalPages);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,0px)]">
      <div
        role="progressbar"
        aria-label="本话阅读进度"
        aria-valuemin={1}
        aria-valuemax={totalPages}
        aria-valuenow={page}
        aria-valuetext={`第 ${chapter} 话 · 第 ${page} 页 / 共 ${totalPages} 页`}
        className="h-[3px] w-full bg-line"
      >
        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${percent}%` }} />
      </div>

      <div className="mx-auto flex min-h-[52px] max-w-[1120px] items-center gap-3 px-4 md:px-6">
        <p className="min-w-0 flex-1 truncate text-caption text-ink-2">
          <span className="font-semibold text-ink">第 {chapter} 话</span> · 第 {page} 页 / 共{" "}
          {totalPages} 页
        </p>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm px-3 text-caption text-ink-2 hover:bg-subtle"
        >
          回到顶部
        </button>
      </div>
    </div>
  );
}
