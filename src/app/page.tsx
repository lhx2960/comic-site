/* =============================================================================
 * 首页 = 漫画列表 + 搜索 + 标签筛选（服务端组件）
 *
 * 它是「URL 即状态」的落点：searchParams 决定取数条件，页面把结果直接渲染成
 * HTML。刷新、分享、前进后退都不需要额外的客户端状态管理（D-005）。
 *
 * 为什么 searchParams 是 Promise：Next.js 15 起页面 props 里的 searchParams 改
 * 成异步 —— 页面可以只 await 自己真正需要的那部分，参数没解析完就不往下渲染，
 * 这样服务端可以尽早开始流式输出，也避免「先渲染一版再补参数」的水合抖动。
 *
 * 布局按 ui.md §5.1/§5.2：吸顶头（站点名 + 搜索框）→ 首屏文案 → 标签条 →
 * 已选条件摘要 → 分节标题 → 卡片网格。ui.md 里的 SiteHeader / HeroTitle /
 * SectionHeading / FilterSummary / ComicGrid 在本页以标记形式就地渲染：
 * T-004 的可改目录只列了 4 个组件文件，新增公共组件需要先经架构师同意
 * （如实现在 T-004 回报里记录，可留给 T-008 全局收尾时提取）。
 * ========================================================================== */

import Link from "next/link";

import { ComicCard } from "@/components/ComicCard";
import { EmptyState } from "@/components/EmptyState";
import { SearchBox } from "@/components/SearchBox";
import { TagFilter } from "@/components/TagFilter";
import { listComics, listTags } from "@/lib/data/queries";
import { hasActiveQuery, parseComicQuery, toSearchString } from "@/lib/search-params";
import type { RawSearchParams } from "@/lib/search-params";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseComicQuery(await searchParams);
  const tags = listTags();
  const comics = listComics(query);
  const hasFilters = hasActiveQuery(query);
  const selectedTag = tags.find((tag) => tag.slug === query.tag);

  // 每个标签的总命中数（不叠加当前筛选），用于标签条上的「科幻 2」计数
  const counts = Object.fromEntries(
    tags.map((tag) => [tag.slug, listComics({ tag: tag.slug }).length]),
  );
  const tagNamesOf = (slugs: string[]) =>
    slugs.map((slug) => tags.find((tag) => tag.slug === slug)?.name ?? slug);

  return (
    <>
      {/* 吸顶头：手机只有一行，滚动时搜索框始终可用（ui.md §5.1） */}
      <header className="sticky top-0 z-20 border-b border-line bg-base/[0.96] backdrop-blur-sm">
        <div className="mx-auto flex min-h-14 max-w-[1120px] items-center gap-3 px-4 md:px-6">
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 text-base font-bold text-ink"
          >
            <span aria-hidden="true" className="size-[18px] rounded-xs bg-accent" />
            漫画站
          </Link>
          <div className="min-w-0 flex-1 md:ml-auto md:max-w-[420px]">
            <SearchBox initialKeyword={query.q ?? ""} activeTag={query.tag} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-4 pb-12 md:px-6">
        <section className="pt-4 md:pt-12">
          <h1 className="text-display font-bold text-ink">漫画站</h1>
          <p className="mt-2 text-sm-site text-ink-2">示例数据练手的漫画阅读站</p>
        </section>

        <TagFilter tags={tags} counts={counts} query={query} />

        {/* 生效条件摘要：只在真的带着条件时出现（F2-3、F2-4） */}
        {hasFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-label tracking-[0.06em] text-ink-3">已选条件</p>
            {query.q ? (
              <span className="inline-flex h-8 items-center rounded-pill bg-accent-soft px-3 text-caption text-accent">
                关键词「{query.q}」
              </span>
            ) : null}
            {selectedTag ? (
              <span className="inline-flex h-8 items-center rounded-pill bg-accent-soft px-3 text-caption text-accent">
                标签「{selectedTag.name}」
              </span>
            ) : null}
            <Link
              // toSearchString({}) 返回空串，必须自己补上根路径 —— 否则 href=""
              // 会被浏览器当成「当前地址」，点了等于原地刷新，F2-4 就失效了。
              href={`/${toSearchString({})}`}
              className="inline-flex min-h-11 items-center rounded-sm border border-line-control px-3 text-sm-site font-semibold text-ink"
            >
              清除筛选
            </Link>
          </div>
        ) : null}

        <div className="mt-6 mb-3 flex flex-wrap items-baseline gap-2">
          <h2 className="text-h2 font-semibold text-ink">
            {hasFilters ? "筛选结果" : "全部漫画"}
          </h2>
          <p className="text-sm-site text-ink-3">共 {comics.length} 部</p>
        </div>

        {comics.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:gap-6">
            {comics.map((comic, index) => (
              <li key={comic.slug}>
                <ComicCard
                  comic={comic}
                  tagNames={tagNamesOf(comic.tags)}
                  priority={index < 2}
                />
              </li>
            ))}
          </ul>
        ) : hasFilters ? (
          // F2-9：关键词与标签的交集为空。保留条件摘要，让用户看得见是哪个条件导致的
          <EmptyState
            title="没有找到匹配的漫画"
            description={
              selectedTag
                ? `试试换个关键词，或点掉「${selectedTag.name}」标签看看全部作品。`
                : "试试换个关键词，或清空关键词看看全部作品。"
            }
            actions={[
              ...(query.q
                ? [{ label: "清除关键词", href: `/${toSearchString({ tag: query.tag })}` }]
                : []),
              { label: "清除筛选", href: "/" },
            ]}
          />
        ) : (
          // 一部漫画都没有（示例数据为空）：与上面的空状态区别只在文案与出路
          <EmptyState
            title="还没有可看的漫画"
            description="示例数据还没准备好，稍后回来看看。"
            actions={[{ label: "刷新页面", href: "/" }]}
          />
        )}
      </main>
    </>
  );
}
