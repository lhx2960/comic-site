/* =============================================================================
 * 访问层单测 —— 断言的对象是「契约规则」，不是实现细节
 *
 * 每条用例都能在 docs/contracts/data-access.md 的语义表里找到出处（注释里标了
 * 是哪一条）。因此将来把数据源从文件换成 Postgres，只要语义不变，这些用例
 * 就应该原样跑绿。
 * ========================================================================== */

import { describe, expect, it } from "vitest";

import type { ComicQuery } from "@/types/comic";
import { getChapter, getComic, listComics, listTags } from "@/lib/data/queries";

/** 示例数据的固定事实（由 scripts/generate-sample-data.mjs 决定） */
const ALL_SLUGS = ["xinghai", "neon-midnight-express", "slow-cooking"];

const slugsOf = (query: ComicQuery = {}) => listComics(query).map((comic) => comic.slug);

describe("listComics —— 关键词匹配（契约：trim、大小写不敏感、title/author 片段包含）", () => {
  it("无参数时返回全部漫画，并按 order 升序", () => {
    expect(slugsOf()).toEqual(ALL_SLUGS);
    expect(listComics({}).map((comic) => comic.order)).toEqual([1, 2, 3]);
  });

  it("大小写不敏感：q=\"neon\" 命中标题「NEON 午夜快车」", () => {
    expect(slugsOf({ q: "neon" })).toEqual(["neon-midnight-express"]);
    expect(slugsOf({ q: "NEON" })).toEqual(["neon-midnight-express"]);
    expect(slugsOf({ q: "nEoN" })).toEqual(["neon-midnight-express"]);
  });

  it("片段包含即可命中：q=\"午夜\" 命中标题中间的字", () => {
    expect(slugsOf({ q: "午夜" })).toEqual(["neon-midnight-express"]);
  });

  it("关键词先 trim：前后空格不影响结果", () => {
    expect(slugsOf({ q: "  星海  " })).toEqual(["xinghai"]);
  });

  it("空字符串与纯空白等于没有关键词（返回全部）", () => {
    expect(slugsOf({ q: "" })).toEqual(ALL_SLUGS);
    expect(slugsOf({ q: "   " })).toEqual(ALL_SLUGS);
  });

  it("也能匹配作者：中文作者与拉丁字母作者都行", () => {
    expect(slugsOf({ q: "林岸" })).toEqual(["xinghai"]);
    expect(slugsOf({ q: "kai" })).toEqual(["neon-midnight-express"]);
    expect(slugsOf({ q: "MORI" })).toEqual(["neon-midnight-express"]);
  });

  it("不匹配标签名：q=\"科幻\" 是标签名而非标题/作者，结果为 0", () => {
    expect(slugsOf({ q: "科幻" })).toEqual([]);
  });

  it("不匹配简介：只在 summary 里出现的词不命中", () => {
    // 「中继星」只出现在《星海拾遗》的简介里
    expect(slugsOf({ q: "中继星" })).toEqual([]);
  });

  it("空结果返回空数组且不抛错", () => {
    expect(() => listComics({ q: "不存在的关键词" })).not.toThrow();
    expect(slugsOf({ q: "不存在的关键词" })).toEqual([]);
  });
});

describe("listComics —— 标签筛选与交集（契约：单选、命任意一项、q∩tag）", () => {
  it("tag 命中 comic.tags 任意一项即算命中", () => {
    expect(slugsOf({ tag: "scifi" })).toEqual(["xinghai", "neon-midnight-express"]);
    expect(slugsOf({ tag: "mystery" })).toEqual(["neon-midnight-express"]);
    expect(slugsOf({ tag: "adventure" })).toEqual(["xinghai"]);
    expect(slugsOf({ tag: "slice-of-life" })).toEqual(["slow-cooking"]);
    expect(slugsOf({ tag: "romance" })).toEqual(["slow-cooking"]);
  });

  it("数据层不做「未知标签」的宽容处理：不存在的 tag 命中 0 部（宽容是 URL 层的职责）", () => {
    expect(slugsOf({ tag: "no-such-tag" })).toEqual([]);
  });

  it("q 与 tag 同时存在时取交集", () => {
    expect(slugsOf({ q: "星", tag: "scifi" })).toEqual(["xinghai"]);
    expect(slugsOf({ q: "neon", tag: "adventure" })).toEqual([]);
  });

  it("标签与关键词的组合不影响排序（仍是 order 升序）", () => {
    expect(listComics({ q: "", tag: "scifi" }).map((comic) => comic.order)).toEqual([1, 2]);
  });
});

describe("listComics —— 纯净性（契约：无副作用）", () => {
  it("改动返回的数组不会污染数据源", () => {
    const first = listComics({});
    first.pop();
    expect(listComics({})).toHaveLength(3);
  });

  it("改动返回对象的字段不会污染数据源", () => {
    const [first] = listComics({});
    expect(first).toBeDefined();
    first!.title = "被改坏的标题";
    expect(listComics({})[0]?.title).not.toBe("被改坏的标题");
  });
});

describe("listTags —— 标签表（契约：按数据给定顺序）", () => {
  it("返回 5 个标签，顺序与数据一致", () => {
    expect(listTags().map((tag) => tag.slug)).toEqual([
      "scifi",
      "mystery",
      "adventure",
      "slice-of-life",
      "romance",
    ]);
  });

  it("每个标签至少命中 1 部漫画（任务单要求）", () => {
    for (const tag of listTags()) {
      expect(listComics({ tag: tag.slug }).length).toBeGreaterThan(0);
    }
  });

  it("返回的是副本，调用方改动不会影响下一次调用", () => {
    listTags().pop();
    expect(listTags()).toHaveLength(5);
  });
});

describe("getComic —— 详情（契约：不存在返回 null）", () => {
  it("存在的 slug 返回漫画与连续递增的话列表", () => {
    const comic = getComic("xinghai");
    expect(comic?.title).toBe("星海拾遗");
    expect(comic?.chapters.map((chapter) => chapter.number)).toEqual([1, 2, 3, 4, 5]);
    expect(comic?.chapters.every((chapter) => chapter.title.length > 0)).toBe(true);
  });

  it("不存在的 slug 返回 null（页面据此 notFound()）", () => {
    expect(getComic("no-such-comic")).toBeNull();
  });

  it("返回的是副本，改动 chapters 不影响下一次调用", () => {
    getComic("xinghai")?.chapters.pop();
    expect(getComic("xinghai")?.chapters).toHaveLength(5);
  });
});

describe("getChapter —— 阅读页（契约：首话 prev 为 null、末话 next 为 null）", () => {
  it("第一话：prev = null，next = 2", () => {
    const chapter = getChapter("xinghai", 1);
    expect(chapter?.prev).toBeNull();
    expect(chapter?.next).toBe(2);
    expect(chapter?.comic).toEqual({ slug: "xinghai", title: "星海拾遗" });
  });

  it("中间话：prev 与 next 都指向相邻话", () => {
    const chapter = getChapter("neon-midnight-express", 3);
    expect(chapter?.prev).toBe(2);
    expect(chapter?.next).toBe(4);
  });

  it("最后一话：next = null", () => {
    expect(getChapter("slow-cooking", 5)?.next).toBeNull();
    expect(getChapter("slow-cooking", 5)?.prev).toBe(4);
  });

  it("页面清单是 10 页有序列表，路径、尺寸与替代文本符合契约", () => {
    const chapter = getChapter("xinghai", 2);
    expect(chapter?.pages).toHaveLength(10);
    expect(chapter?.pages[0]).toEqual({
      src: "/comics/xinghai/2/001.svg",
      width: 600,
      height: 800,
      alt: "第 2 话 第 1 页",
    });
    expect(chapter?.pages[9]?.src).toBe("/comics/xinghai/2/010.svg");
    expect(chapter?.pages.map((page) => page.alt)).toContain("第 2 话 第 10 页");
  });

  it("话号不合法或不存在时返回 null，不抛错", () => {
    expect(getChapter("xinghai", 0)).toBeNull();
    expect(getChapter("xinghai", 6)).toBeNull();
    expect(getChapter("xinghai", 1.5)).toBeNull();
    expect(getChapter("xinghai", Number.NaN)).toBeNull();
  });

  it("漫画不存在时返回 null", () => {
    expect(getChapter("no-such-comic", 1)).toBeNull();
  });
});
