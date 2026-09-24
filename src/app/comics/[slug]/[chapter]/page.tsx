/* =============================================================================
 * 阅读页 —— 服务端外壳 + 客户端阅读器
 *
 * 分工：这一层负责「能不能读」——校验话号格式、取数、把三种结局分别渲染出来；
 * 真正的阅读体验（懒加载、滚动、进度、顶栏收起）在 ReaderStrip 里，因为它需要
 * 浏览器能力。服务端先把 10 页的页位渲染出来，图片再按需到达，滚动过程才不会跳。
 *
 * 深色阅读域：外层容器加 data-theme="reader"，globals.css 里同一批语义令牌在这个
 * 作用域内换成深色取值，因此组件不需要写「阅读页专用样式」（design.md §9）。
 *
 * chapter 的校验规则来自 docs/contracts/routes.md：必须是 ^[1-9][0-9]*$（正整数、
 * 无前导零）。三种结局（`classifyReaderRoute`）都在本页直接渲染空状态/正常内容，
 * **不再调用 notFound()**：dev 与 prod 对 not-found 边界的选择不一致（T-012 缺陷），
 * 直接渲染才能保证两端文案一致；URL 与状态码维持现状（D-017：流式响应为 200）。
 * 未定义路由（`/whatever`）仍由根级 not-found 处理，依旧是真正的 404。
 * ========================================================================== */

import type { Metadata } from "next";

import { ReaderStrip } from "@/components/ReaderStrip";
import { getChapter, getComic } from "@/lib/data/queries";

import ComicNotFound from "../not-found";
import ChapterNotFound, { classifyReaderRoute } from "./not-found";

const CHAPTER_PATTERN = /^[1-9][0-9]*$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}): Promise<Metadata> {
  const { slug, chapter } = await params;
  const comic = getComic(slug);
  const detail = comic !== null && CHAPTER_PATTERN.test(chapter) ? getChapter(slug, Number(chapter)) : null;

  switch (
    classifyReaderRoute({
      chapterParam: chapter,
      comicExists: comic !== null,
      chapterExists: detail !== null,
    })
  ) {
    case "comic-missing":
      return { title: "这部漫画不存在" };
    case "chapter-missing":
      return { title: "这一话不存在" };
    default:
      // detail 在 ok 分支必然存在，这里的兜底只为让类型收窄
      return detail ? { title: `${detail.comic.title} 第 ${detail.number} 话` } : {};
  }
}

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter } = await params;

  const comic = getComic(slug);
  // 先校验格式再看数据：`/comics/xinghai/01` 这种前导零要按「不存在」处理
  const detail = comic !== null && CHAPTER_PATTERN.test(chapter) ? getChapter(slug, Number(chapter)) : null;
  const outcome = classifyReaderRoute({
    chapterParam: chapter,
    comicExists: comic !== null,
    chapterExists: detail !== null,
  });

  if (outcome === "comic-missing") {
    /*
     * 漫画本身不存在：直接渲染作品级空状态（「这部漫画不存在」+ 去漫画库/返回首页）。
     *
     * 为什么也不走 notFound()：dev 与 prod 对这一层 notFound() 的**边界选择**并不一致
     * （T-012 实测：同一份代码在 dev 落 slug 级边界、prod 落章节级边界，文案因此不同）。
     * 直接渲染两端一致，不再依赖 Next 内部的边界挑选规则。
     */
    return <ComicNotFound />;
  }

  if (outcome === "chapter-missing" || detail === null) {
    /*
     * 话号格式非法（`01`）或数据里没有这一话：**直接渲染话级空状态**，不再调用 notFound()。
     *
     * 为什么不用 notFound()：生产构建下 Next 会把这一层的 notFound() 交给上一层
     * （`[slug]`）的 not-found 边界，于是漫画明明存在却渲染「这部漫画不存在」——
     * 这就是 T-012 记录的「dev 正确、prod 文案错」的缺陷。直接渲染既与 dev 一致，
     * 也不再依赖边界选择规则。URL 与状态码维持现状（D-017：流式响应为 200）。
     */
    return <ChapterNotFound slug={slug} />;
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
