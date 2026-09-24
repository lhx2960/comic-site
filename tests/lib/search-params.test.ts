/* =============================================================================
 * URL 查询参数解析与构造的单测
 *
 * 依据 docs/contracts/routes.md 的「查询参数」一节：q 忽略前后空格、tag 单选、
 * 未知 tag 视为无筛选且不报错、参数顺序不影响结果。
 * 注意这里与数据层的分工：宽容处理发生在 URL 层，listComics({tag}) 本身不做宽容。
 * ========================================================================== */

import { describe, expect, it } from "vitest";

import {
  hasActiveQuery,
  isTagSelected,
  parseComicQuery,
  toSearchString,
} from "@/lib/search-params";
import type { RawSearchParams } from "@/lib/search-params";

describe("parseComicQuery —— 从 searchParams 得到查询条件", () => {
  it("没有参数时返回空条件对象", () => {
    expect(parseComicQuery(undefined)).toEqual({});
    expect(parseComicQuery({})).toEqual({});
  });

  it("忽略关键词前后空格；纯空白等于没有关键词", () => {
    expect(parseComicQuery({ q: "  星海  " })).toEqual({ q: "星海" });
    expect(parseComicQuery({ q: "   " })).toEqual({});
    expect(parseComicQuery({ q: "" })).toEqual({});
  });

  it("未知 tag 视为无筛选条件（不报错、不产生 400）", () => {
    expect(parseComicQuery({ tag: "no-such-tag" })).toEqual({});
    // 大小写不同也算未知：契约规定 tag 取值是小写字母数字连字符
    expect(parseComicQuery({ tag: "SCIFI" })).toEqual({});
  });

  it("已知 tag 原样保留", () => {
    expect(parseComicQuery({ tag: "scifi" })).toEqual({ tag: "scifi" });
    expect(parseComicQuery({ tag: "  scifi  " })).toEqual({ tag: "scifi" });
  });

  it("q 与 tag 同时存在时都保留", () => {
    expect(parseComicQuery({ q: "午夜", tag: "mystery" })).toEqual({
      q: "午夜",
      tag: "mystery",
    });
  });

  it("同名参数出现多次时取第一个", () => {
    expect(parseComicQuery({ q: ["星海", "午夜"] } as RawSearchParams)).toEqual({ q: "星海" });
    expect(parseComicQuery({ tag: ["mystery", "scifi"] } as RawSearchParams)).toEqual({
      tag: "mystery",
    });
  });

  it("未知键被忽略", () => {
    expect(parseComicQuery({ page: "2", q: "星海" })).toEqual({ q: "星海" });
  });
});

describe("toSearchString —— 从查询条件生成 URL 查询串", () => {
  it("没有有效条件时返回空串，便于直接拼到 pathname 后面", () => {
    expect(toSearchString({})).toBe("");
    expect(toSearchString({ q: "   " })).toBe("");
    expect(toSearchString({ tag: "no-such-tag" })).toBe("");
  });

  it("中文与特殊字符走百分号编码，不会以裸字符进 URL", () => {
    expect(toSearchString({ q: "星海" })).toBe("?q=%E6%98%9F%E6%B5%B7");
  });

  it("同时带 q 与 tag 时两个键都在，且重新解析后完全等价（参数顺序无关）", () => {
    const query = { q: "午夜", tag: "mystery" } as const;
    const search = toSearchString(query);
    const parsed = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    expect(parsed.get("q")).toBe("午夜");
    expect(parsed.get("tag")).toBe("mystery");
    expect(parseComicQuery({ q: parsed.get("q") ?? undefined, tag: parsed.get("tag") ?? undefined })).toEqual({
      q: "午夜",
      tag: "mystery",
    });
  });

  it("与解析互为逆运算：解析 → 构造 → 再解析结果不变", () => {
    const raw: RawSearchParams = { q: "  星海 ", tag: "scifi" };
    const firstPass = parseComicQuery(raw);
    const search = toSearchString(firstPass);
    const reparsed = new URLSearchParams(search.slice(1));
    const secondPass = parseComicQuery({
      q: reparsed.get("q") ?? undefined,
      tag: reparsed.get("tag") ?? undefined,
    });
    expect(secondPass).toEqual(firstPass);
  });
});

describe("hasActiveQuery / isTagSelected —— 页面判断用的小工具", () => {
  it("只有有效条件才算「带着筛选」", () => {
    expect(hasActiveQuery({})).toBe(false);
    expect(hasActiveQuery({ q: "  " })).toBe(false);
    expect(hasActiveQuery({ tag: "no-such-tag" })).toBe(false);
    expect(hasActiveQuery({ q: "星海" })).toBe(true);
    expect(hasActiveQuery({ tag: "scifi" })).toBe(true);
  });

  it("标签选中判断只看当前单选标签", () => {
    expect(isTagSelected({ tag: "scifi" }, "scifi")).toBe(true);
    expect(isTagSelected({ tag: "scifi" }, "mystery")).toBe(false);
    expect(isTagSelected({}, "scifi")).toBe(false);
  });
});
