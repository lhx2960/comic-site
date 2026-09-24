/* =============================================================================
 * 首页 —— 服务端组件（Server Component）
 *
 * 页面在服务端执行：await searchParams → 解析成查询条件 → 调访问层取数 →
 * 直接吐出 HTML。浏览器只收到结果，不会收到取数逻辑，也不需要客户端状态库。
 *
 * 本文件是 T-003 的「最小可用版本」：只打通「URL 参数 → 取数 → 渲染」这条链路，
 * 用来验证访问层与数据是通的；完整视觉（hero、卡片网格、空状态）由 T-004 落地。
 * ========================================================================== */

import Link from "next/link";

import { listComics, listTags } from "@/lib/data/queries";
import { hasActiveQuery, parseComicQuery, toSearchString } from "@/lib/search-params";
import type { RawSearchParams } from "@/lib/search-params";

export default async function HomePage({
  searchParams,
}: {
  // Next.js 15 起 searchParams 是 Promise：页面可以只 await 自己需要的部分，
  // 参数解析完才继续渲染，因此这里必须在取数之前 await。
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseComicQuery(await searchParams);
  const comics = listComics(query);
  const tags = listTags();
  const tagNameOf = (slug: string) => tags.find((tag) => tag.slug === slug)?.name ?? slug;

  return (
    <main className="mx-auto max-w-[1120px] px-4 py-6 md:px-6">
      <h1 className="text-h1 font-bold">漫画站</h1>
      <p className="mt-2 text-sm-site text-ink-2">
        浏览、搜索、阅读，筛选状态全部放在 URL 里。
      </p>

      <nav aria-label="标签筛选" className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => {
          const selected = query.tag === tag.slug;
          const nextQuery = { ...query, tag: selected ? undefined : tag.slug };
          return (
            <Link
              key={tag.slug}
              href={`/${toSearchString(nextQuery)}`}
              className={`inline-flex min-h-11 items-center rounded-pill border px-4 text-sm-site ${
                selected
                  ? "border-accent-soft-line bg-accent-soft text-accent"
                  : "border-line text-ink-2"
              }`}
            >
              {tag.name}
            </Link>
          );
        })}
      </nav>

      <p className="mt-4 text-caption text-ink-3">
        共 {comics.length} 部
        {hasActiveQuery(query) ? (
          <>
            {" · "}
            <Link href="/" className="text-accent underline">
              清除筛选
            </Link>
          </>
        ) : null}
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {comics.map((comic) => (
          <li key={comic.slug} className="rounded-md border border-line bg-surface p-4">
            <Link href={`/comics/${comic.slug}`} className="text-h3 font-semibold">
              {comic.title}
            </Link>
            <p className="mt-1 text-sm-site text-ink-2">
              {comic.author} · {comic.tags.map(tagNameOf).join(" / ")}
            </p>
            <p className="mt-1 text-caption text-ink-3">{comic.summary}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
