/* =============================================================================
 * URL 查询参数 <-> 查询条件
 *
 * 首页的筛选状态全部放在 URL 里（?q=&tag=），刷新、分享、前进后退天然可用，
 * 服务端也能直接按参数取数，不需要客户端状态库（D-005）。这一层是纯函数：
 * 页面把 searchParams 交给它，它给出 listComics() 需要的 ComicQuery，
 * 组件要生成链接时再把它转回查询串。
 *
 * 契约要点（docs/contracts/routes.md）：q 前后空格忽略；tag 单选；未知 tag
 * 视为「无筛选条件」而不是报错，保证链接永远能打开。
 * ========================================================================== */

import { listTags } from "@/lib/data/queries";
import type { ComicQuery, TagSlug } from "@/types/comic";

/** Next.js 页面收到的 searchParams 形状：同名参数出现多次时值是数组 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** 同名参数重复时取第一个，其余忽略（契约：无效参数按「无此条件」处理） */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * 标签是否真实存在。判断依据是数据源里的标签表，而不是正则 ——
 * 这样新增标签时不需要同时改两处，「未知 tag」的判定永远跟着数据走。
 */
function isKnownTag(value: string): boolean {
  return listTags().some((tag) => tag.slug === value);
}

/** 解析 URL 查询参数：只有「有效」的条件才会出现在结果里，未知 tag 被丢弃 */
export function parseComicQuery(raw: RawSearchParams | undefined): ComicQuery {
  const query: ComicQuery = {};

  const keyword = firstValue(raw?.q)?.trim();
  if (keyword) {
    query.q = keyword;
  }

  const tag = firstValue(raw?.tag)?.trim();
  if (tag && isKnownTag(tag)) {
    query.tag = tag;
  }

  return query;
}

/**
 * 生成站内链接用的查询串：`?q=%E6%98%9F%E6%B5%B7&tag=scifi`。
 * 无有效条件时返回空串，便于直接拼到 pathname 后面；URLSearchParams 会负责
 * 中文与特殊字符的百分号编码（不能用模板串手拼，否则中文会直接进 URL）。
 */
export function toSearchString(query: ComicQuery): string {
  const params = new URLSearchParams();

  const keyword = query.q?.trim();
  if (keyword) {
    params.set("q", keyword);
  }

  const tag = query.tag?.trim();
  if (tag && isKnownTag(tag)) {
    params.set("tag", tag);
  }

  const serialized = params.toString();
  return serialized === "" ? "" : `?${serialized}`;
}

/** 是否真的带着筛选条件 —— 页面据此显示「清除筛选」入口（F2-3、F2-4） */
export function hasActiveQuery(query: ComicQuery): boolean {
  const keyword = query.q?.trim();
  const tag = query.tag?.trim();
  return Boolean(keyword) || Boolean(tag && isKnownTag(tag));
}

/** 便于组件判断某个标签当前是否被选中（用于高亮与「再次点击取消」） */
export function isTagSelected(query: ComicQuery, tag: TagSlug): boolean {
  return query.tag === tag;
}
