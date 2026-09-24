/* =============================================================================
 * 话级空状态「这一话不存在」（PRD F5-9）+ 阅读页路由三态判定
 *
 * 两个用途：
 *   1. 由 `[chapter]/page.tsx` **直接渲染**（T-012 的推荐做法）：话号格式非法（`01`）
 *      或数据里没有这一话时，页面直接渲染这个空状态，**不再调用 notFound()**。
 *      原因是生产构建会把这一层的 notFound() 交给上一层（`[slug]`）的边界，
 *      于是漫画明明存在却显示「这部漫画不存在」—— 即 dev 正确、prod 文案错的那条缺陷。
 *   2. 仍然作为该路由段的 not-found 边界文件存在（Next 自动识别）；被边界渲染时
 *      收不到 props，出口退化为「返回首页」。
 *
 * 深色阅读域：整块包在 `data-theme="reader"` 容器里（与阅读页正文同一套语义令牌），
 * 因为这是阅读页路由上的状态 —— PRD G10 要求阅读页内不出现站点浅色底区块，
 * ui.md §5.4 也把这个等价空状态画在深色域。容器里的 EmptyState 用的是语义类
 * （bg-surface / text-ink / border-line-control…），会自动解析成 --r-* 的深色取值，
 * 因此不需要新造任何色值。
 *
 * 为什么判定函数放在这里而不是 `page.tsx`：Next 对 page 文件的具名导出有严格校验
 * （只允许 default / metadata / generateMetadata / dynamic 等），多导出一个函数会让
 * `next build` 直接失败（T-012 实测报 TS2344）。放在这个文件里既能被单测直接 import，
 * 也不影响它作为边界文件的功能。
 * ========================================================================== */

import { EmptyState } from "@/components/EmptyState";

/** routes.md：话号必须是正整数、无前导零 */
const CHAPTER_PATTERN = /^[1-9][0-9]*$/;

/** 阅读页路由的三种结局 */
export type ReaderRouteOutcome = "comic-missing" | "chapter-missing" | "ok";

/**
 * 判定这次请求属于哪种情况（纯函数，便于单测直接钉住分支）。
 *
 * 优先级：漫画不存在 > 话不存在。所以 `/comics/nope/9` 报「这部漫画不存在」，
 * 而 `/comics/xinghai/9`（漫画在、话不在）报「这一话不存在」。
 */
export function classifyReaderRoute({
  chapterParam,
  comicExists,
  chapterExists,
}: {
  chapterParam: string;
  comicExists: boolean;
  chapterExists: boolean;
}): ReaderRouteOutcome {
  if (!comicExists) {
    return "comic-missing";
  }
  if (!CHAPTER_PATTERN.test(chapterParam) || !chapterExists) {
    return "chapter-missing";
  }
  return "ok";
}

export default function ChapterNotFound({ slug }: { slug?: string }) {
  return (
    // 与阅读页正文同一套外壳：min-h-dvh + 深色底 + 主文字色，只是没有底部进度条
    <div data-theme="reader" className="min-h-dvh bg-base text-ink">
      <main className="mx-auto w-full max-w-[1120px] px-4 py-12 md:px-6">
        <div className="mx-auto max-w-[42ch]">
          <EmptyState
            title="这一话不存在"
            description="地址里的话序号可能被改过，回详情挑一话吧。"
            actions={
              slug
                ? [
                    { label: "返回详情", href: `/comics/${slug}` },
                    { label: "返回首页", href: "/" },
                  ]
                : [{ label: "返回首页", href: "/" }]
            }
          />
        </div>
      </main>
    </div>
  );
}
