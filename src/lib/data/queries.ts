/* =============================================================================
 * 数据访问层 —— 页面与 Route Handler 唯一允许的取数入口
 *
 * 在 Next.js 里这一层属于「服务端数据层」：它只被 Server Component 与 Route
 * Handler 调用，不进入客户端 bundle。页面不得直接 import data/comics.ts，
 * 一律走这里的四个函数；将来把数据源换成 Postgres 时，只替换本文件的实现，
 * 页面与测试都不用动（docs/contracts/data-access.md）。
 *
 * 语义全部来自契约，逐条落在下面：关键词 trim + 大小写不敏感 + 只比对
 * title/author 的片段包含、标签命中取并集内匹配、q 与 tag 取交集、按 order
 * 升序、空结果返回空数组、找不到返回 null、函数无副作用。
 * ========================================================================== */

import * as React from "react";

import { comics, pageHeight, pageWidth, pagesPerChapter, tags } from "@data/comics";
import type {
  ChapterDetail,
  Comic,
  ComicDetail,
  ComicQuery,
  ComicSlug,
  ImageRef,
  Tag,
  TagSlug,
} from "@/types/comic";

/**
 * React 的 cache() 只在服务端渲染的「请求作用域」内生效：同一次请求里多个
 * Server Component 调用同一个取数函数时，真正的计算只发生一次。
 *
 * 在纯 Node 环境（单元测试、脚本）里 React.cache 可能不存在，此时退化成原函数。
 * 语义完全不变 —— 下面的函数本来就没有副作用，缓存只是性能优化。
 */
function cached<Args extends unknown[], Result>(fetch: (...args: Args) => Result) {
  if (typeof React.cache === "function") {
    return React.cache(fetch);
  }
  return fetch;
}

/** 契约：关键词先 trim，空串等于「没有关键词」；比较时统一转小写 */
function normalizeKeyword(raw: string | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed.toLowerCase();
}

/** 契约：标签单选，空串 / undefined 视为无筛选 */
function normalizeTag(raw: TagSlug | undefined): TagSlug | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 契约：命中条件 = title 或 author 包含关键词；不匹配标签名、不匹配简介。
 * 注意这里把漫画标题/作者转小写后再比，因此「neon」能命中「NEON 午夜快车」。
 */
function matchesKeyword(comic: Comic, keyword: string): boolean {
  return (
    comic.title.toLowerCase().includes(keyword) ||
    comic.author.toLowerCase().includes(keyword)
  );
}

/** 契约：tag 命中 comic.tags 中任意一项即算命中；未指定标签时不筛选 */
function matchesTag(comic: Comic, tag: TagSlug | null): boolean {
  return tag === null || comic.tags.includes(tag);
}

/**
 * 返回浅拷贝，保证调用方改动结果不会污染共享的示例数据（契约「无副作用」）。
 * 数据量只有 3 部，这点拷贝成本可以忽略。
 */
function cloneComic(comic: ComicDetail): ComicDetail {
  return {
    ...comic,
    tags: [...comic.tags],
    chapters: comic.chapters.map((chapter) => ({ ...chapter })),
  };
}

/**
 * 页面清单由「生成脚本定下的目录约定」推导，而不是塞进数据文件：
 * 占位图路径固定为 /comics/<slug>/<话号>/<三位页号>.svg，每话恒为 pagesPerChapter 页。
 * tests/data/sample-assets.test.ts 会逐页核对磁盘上确实存在这些文件，
 * 所以这份推导不会和实际产物脱节。
 */
function buildPages(slug: ComicSlug, chapter: number): ImageRef[] {
  return Array.from({ length: pagesPerChapter }, (_, index) => {
    const page = index + 1;
    return {
      src: `/comics/${slug}/${chapter}/${String(page).padStart(3, "0")}.svg`,
      width: pageWidth,
      height: pageHeight,
      // 无障碍替代文本按契约要求写成「第 x 话 第 y 页」
      alt: `第 ${chapter} 话 第 ${page} 页`,
    };
  });
}

/**
 * 首页/列表：按关键词与标签过滤，按 Comic.order 升序返回。
 * q 与 tag 同时存在时取交集 —— 两个 filter 条件用 && 串起来就是这个语义。
 */
export const listComics = cached((query: ComicQuery = {}): Comic[] => {
  const keyword = normalizeKeyword(query.q);
  const tag = normalizeTag(query.tag);

  return comics
    .filter(
      (comic) =>
        (keyword === null || matchesKeyword(comic, keyword)) && matchesTag(comic, tag),
    )
    .map(cloneComic)
    .sort((left, right) => left.order - right.order);
});

/**
 * 全部标签：去重与顺序由数据源保证（数组顺序即展示顺序），这里只返回副本。
 * 注意「未知标签」不在这里过滤 —— 那是 URL 层的职责，见 src/lib/search-params.ts。
 */
export const listTags = cached((): Tag[] => tags.map((tag) => ({ ...tag })));

/** 详情页：一部漫画 + 话列表；slug 不存在返回 null（页面据此转 404） */
export const getComic = cached((slug: ComicSlug): ComicDetail | null => {
  const found = comics.find((comic) => comic.slug === slug);
  return found ? cloneComic(found) : null;
});

/**
 * 阅读页：某话的页清单与前后话序号；漫画或话不存在返回 null。
 * prev / next 用话列表下标推导，因此「第一话 prev 为 null、最后一话 next 为 null」
 * 是数据驱动的，不依赖写死的数字。
 */
export const getChapter = cached(
  (slug: ComicSlug, chapter: number): ChapterDetail | null => {
    const comic = comics.find((item) => item.slug === slug);
    if (!comic) {
      return null;
    }

    const index = comic.chapters.findIndex((item) => item.number === chapter);
    const current = comic.chapters[index];
    if (index === -1 || current === undefined) {
      return null;
    }

    const previous = index > 0 ? comic.chapters[index - 1] : undefined;
    const following = comic.chapters[index + 1];

    return {
      comic: { slug: comic.slug, title: comic.title },
      number: current.number,
      title: current.title,
      pages: buildPages(comic.slug, current.number),
      prev: previous ? previous.number : null,
      next: following ? following.number : null,
    };
  },
);
