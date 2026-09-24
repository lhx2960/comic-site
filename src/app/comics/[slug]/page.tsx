/* =============================================================================
 * 漫画详情页 —— 服务端组件
 *
 * 这一页只回答两个问题：「这部是不是我要看的」与「从哪一话开始」。
 * 服务端用 getComic(slug) 取数（访问层是唯一取数入口），slug 不存在直接
 * notFound() 转 404 页面，不抛未捕获异常（routes.md 的约定）。
 *
 * 涉及本机进度的部分（阅读记录卡、主按钮文案、话列表角标）不能在这一层读 ——
 * localStorage 只存在于浏览器。它们交给两个客户端组件，各自在挂载后自己读。
 *
 * 布局按 ui.md §5.3：顶部简化面包屑 → 手机竖排 / 桌面两列（240px 封面 + 1fr 信息）
 * → 话列表。ui.md 里的 ComicDetailHeader / ProgressCard / PrimaryCta 在本页以标记
 * 或客户端组件的形式就地实现（组件提取留给 T-008，D-014）。
 * ========================================================================== */

import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { ChapterList } from "@/components/ChapterList";
import { ProgressCTA } from "@/components/ProgressCTA";
import { SiteHeader } from "@/components/SiteHeader";
import { getChapter, getComic, listTags } from "@/lib/data/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const comic = getComic(slug);
  return { title: comic ? comic.title : "内容不存在" };
}

export default async function ComicDetailPage({
  params,
}: {
  // Next.js 15 起 params 也是 Promise：动态段在服务端解析完才渲染
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const comic = getComic(slug);
  if (!comic) {
    notFound();
  }

  const tags = listTags();
  const tagNames = comic.tags.map(
    (tagSlug) => tags.find((tag) => tag.slug === tagSlug)?.name ?? tagSlug,
  );
  // 每话页数从访问层拿（第 1 话的页面清单长度），页面不直接 import 数据文件
  const pagesPerChapter = getChapter(comic.slug, 1)?.pages.length ?? 0;

  return (
    <>
      {/* 顶部条：手机上的简化面包屑，同时满足 G7「非首页都有回首页入口」 */}
      <SiteHeader backHref="/" current={comic.title} />

      <main className="mx-auto w-full max-w-[1120px] px-4 pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:px-6 md:pb-12">
        <div className="md:grid md:grid-cols-[240px_1fr] md:gap-8">
          <div className="pt-6 md:pt-10">
            <div className="mx-auto aspect-[2/3] w-[min(58vw,220px)] overflow-hidden rounded-md bg-subtle shadow-md md:mx-0 md:w-full">
              <Image
                src={comic.cover.src}
                alt={`封面：${comic.title}`}
                width={comic.cover.width}
                height={comic.cover.height}
                sizes="(min-width: 768px) 240px, 58vw"
                priority
                // 占位图是 SVG，Next 不对 SVG 做位图优化，直接引用即可
                unoptimized
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="pt-5 md:pt-10">
            <h1 className="text-center text-h1 font-bold text-ink md:text-left md:text-[30px]">
              {comic.title}
            </h1>
            <p className="mt-2 text-center text-sm-site text-ink-2 md:text-left">
              作者：{comic.author}
            </p>
            <ul className="mt-3 flex flex-wrap justify-center gap-1 md:justify-start">
              {tagNames.map((name) => (
                <li key={name} className="rounded-xs bg-subtle px-2 py-1 text-label text-ink-3">
                  {name}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm-site text-ink-2">{comic.summary}</p>

            <ProgressCTA
              slug={comic.slug}
              chapterCount={comic.chapters.length}
              pagesPerChapter={pagesPerChapter}
            />
          </div>

          {/* 桌面：话列表挂在右列下方（grid-row 2），与标题同一条视线 */}
          <div className="md:col-start-2">
            <ChapterList slug={comic.slug} chapters={comic.chapters} />
          </div>
        </div>
      </main>
    </>
  );
}
