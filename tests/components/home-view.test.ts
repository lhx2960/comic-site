/* =============================================================================
 * 首页视图的纯逻辑链路：URL 参数 → 查询条件 → 结果集合
 *
 * 这一层不渲染 JSX，只把「用户看到的结果数量」钉在契约上：页面拿到
 * searchParams 之后做的每一步（解析 → 取数 → 排序）都在这里可验证。
 * 每条用例标注它对应的 PRD 验收编号，方便逐条核对。
 * ========================================================================== */

import { describe, expect, it } from "vitest";

import { listComics, listTags } from "@/lib/data/queries";
import { hasActiveQuery, parseComicQuery } from "@/lib/search-params";
import type { RawSearchParams } from "@/lib/search-params";

/** 模拟「浏览器地址栏参数 → 页面结果」，页面里就是这两步串起来的 */
function viewOf(params: RawSearchParams) {
  const query = parseComicQuery(params);
  const comics = listComics(query);
  return { query, comics, slugs: comics.map((comic) => comic.slug) };
}

describe("首页 = 列表视图（F1-1、F2-1、F1-4）", () => {
  it("无参数时展示全部 3 部，且顺序按 order 升序", () => {
    const { comics, slugs } = viewOf({});
    expect(comics).toHaveLength(3);
    expect(slugs).toEqual(["xinghai", "neon-midnight-express", "slow-cooking"]);
    expect(comics.map((comic) => comic.order)).toEqual([1, 2, 3]);
  });

  it("每张卡片要展示的数据都齐备：封面、标题、作者、至少 1 个标签", () => {
    for (const comic of viewOf({}).comics) {
      expect(comic.cover.src).toMatch(/^\/comics\//);
      expect(comic.cover.width).toBeGreaterThan(0);
      expect(comic.title.length).toBeGreaterThan(0);
      expect(comic.author.length).toBeGreaterThan(0);
      expect(comic.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("标签条列出的就是数据里全部去重标签，每个至少命中 1 部", () => {
    const tags = listTags();
    expect(tags).toHaveLength(5);
    for (const tag of tags) {
      expect(viewOf({ tag: tag.slug }).comics.length).toBeGreaterThan(0);
    }
  });
});

describe("标签筛选（F2-3、F2-4、F2-5、F2-6、F2-8）", () => {
  it("?tag=scifi 只剩带该标签的 2 部", () => {
    expect(viewOf({ tag: "scifi" }).slugs).toEqual(["xinghai", "neon-midnight-express"]);
  });

  it("点标签后页面能拿到生效条件（用于渲染「已选条件」与「清除筛选」）", () => {
    expect(hasActiveQuery(viewOf({ tag: "scifi" }).query)).toBe(true);
  });

  it("清除筛选后回到全部 3 部，且不再有生效条件", () => {
    const cleared = viewOf({});
    expect(cleared.comics).toHaveLength(3);
    expect(hasActiveQuery(cleared.query)).toBe(false);
  });

  it("未知标签按「无筛选」处理，链接永远打得开", () => {
    const { comics, query } = viewOf({ tag: "no-such-tag" });
    expect(comics).toHaveLength(3);
    expect(query.tag).toBeUndefined();
  });

  it("同一个地址解析两次结果一致（刷新不丢状态、分享后一致）", () => {
    const url: RawSearchParams = { q: "午夜", tag: "mystery" };
    expect(viewOf(url).slugs).toEqual(viewOf(url).slugs);
    expect(viewOf(url).slugs).toEqual(["neon-midnight-express"]);
  });
});

describe("关键词 + 标签取交集（F2-7、F2-9）", () => {
  it("?q=K&tag=scifi：Kai Mori 的作品且带 scifi，只剩 1 部", () => {
    expect(viewOf({ q: "K", tag: "scifi" }).slugs).toEqual(["neon-midnight-express"]);
  });

  it("关键词与标签不匹配时结果为空（走空状态，不抛错）", () => {
    expect(viewOf({ q: "zzzz", tag: "scifi" }).comics).toEqual([]);
  });

  it("空结果时仍然保留生效条件，用户能看出是哪个条件导致的", () => {
    const { query } = viewOf({ q: "zzzz", tag: "scifi" });
    expect(query).toEqual({ q: "zzzz", tag: "scifi" });
  });
});

describe("搜索语义（F3-2、F3-3、F3-4、F3-6、F3-7、F3-8）", () => {
  it("按作者搜索命中该作者的全部作品", () => {
    expect(viewOf({ q: "陈小满" }).slugs).toEqual(["slow-cooking"]);
  });

  it("标题中间片段即可命中", () => {
    expect(viewOf({ q: "夜快" }).slugs).toEqual(["neon-midnight-express"]);
  });

  it("全大写与全小写的同一个词结果一致", () => {
    expect(viewOf({ q: "NEON" }).slugs).toEqual(viewOf({ q: "neon" }).slugs);
  });

  it("清空关键词后保留标签筛选（F3-6）", () => {
    expect(viewOf({ q: "", tag: "scifi" }).slugs).toEqual([
      "xinghai",
      "neon-midnight-express",
    ]);
  });

  it("关键词首尾空格不影响结果（F3-7）", () => {
    expect(viewOf({ q: "  星海  " }).slugs).toEqual(viewOf({ q: "星海" }).slugs);
  });

  it("只出现在标签名里的词不匹配（F3-8）", () => {
    expect(viewOf({ q: "科幻" }).comics).toEqual([]);
  });
});
