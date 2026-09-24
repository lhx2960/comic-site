/* =============================================================================
 * 阅读页 —— 服务端外壳 + 客户端阅读器
 *
 * 分工：这一层负责「能不能读」——校验话号格式、取数、不存在就 404；
 * 真正的阅读体验（懒加载、滚动、进度、顶栏收起）在 ReaderStrip 里，因为它需要
 * 浏览器能力。服务端先把 10 页的页位渲染出来，图片再按需到达，滚动过程才不会跳。
 *
 * 深色阅读域：外层容器加 data-theme="reader"，globals.css 里同一批语义令牌在这个
 * 作用域内换成深色取值，因此组件不需要写「阅读页专用样式」（design.md §9）。
 *
 * chapter 的校验规则来自 docs/contracts/routes.md：必须是 ^[1-9][0-9]*$（正整数、
 * 无前导零）；不合法或数据里没有这一话一律 notFound()，不抛未捕获异常。
 * ========================================================================== */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReaderStrip } from "@/components/ReaderStrip";
import { getChapter } from "@/lib/data/queries";

const CHAPTER_PATTERN = /^[1-9][0-9]*$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}): Promise<Metadata> {
  const { slug, chapter } = await params;
  const detail = CHAPTER_PATTERN.test(chapter) ? getChapter(slug, Number(chapter)) : null;
  if (!detail) {
    return { title: "内容不存在" };
  }
  return { title: `${detail.comic.title} 第 ${detail.number} 话` };
}

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter } = await params;

  // 先校验格式再看数据：`/comics/xinghai/01` 这种前导零要按「不存在」处理
  if (!CHAPTER_PATTERN.test(chapter)) {
    notFound();
  }
  const detail = getChapter(slug, Number(chapter));
  if (!detail) {
    notFound();
  }

  return (
    <div
      data-theme="reader"
      // 底部预留底栏高度：1px 分隔线 + 3px 进度轨道 + 52px 文字行 = 56px
      // （ui.md §3.5 的 --foot-h 只算文字行，轨道与分隔线要另加），再加安全区。
      // 实测按 55px 预留时最后一页会被压住 1px，所以这里必须用 56px。
      className="min-h-dvh bg-base pb-[calc(56px+env(safe-area-inset-bottom,0px))] text-ink"
    >
      <ReaderStrip
        comicSlug={detail.comic.slug}
        comicTitle={detail.comic.title}
        chapter={detail.number}
        chapterTitle={detail.title}
        pages={detail.pages}
        hasNextChapter={detail.next !== null}
      />
    </div>
  );
}
