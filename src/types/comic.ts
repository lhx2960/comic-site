// 漫画站 · 领域类型契约（v1.0）
//
// 这份文件是「数据长什么样」的唯一事实来源。实现时把内容复制到
// `src/types/comic.ts`，两边必须保持一致；任何字段增删都要先由架构师改这里，
// 再改实现与契约文档（见 AGENTS.md 硬规则 1「契约先行」）。
//
// 冻结后：实现角色不得擅自修改本文件。

/** 漫画的 URL 标识（小写字母、数字、连字符），如 `xinghai` */
export type ComicSlug = string;

/** 标签的 URL 标识，如 `scifi` */
export type TagSlug = string;

export interface Tag {
  slug: TagSlug;
  /** 中文展示名，如「科幻」 */
  name: string;
}

/** 图片引用：阅读页与封面共用。宽高必须给定，用于占位与避免布局跳动 */
export interface ImageRef {
  /** 站点内绝对路径，如 `/comics/xinghai/1/003.svg` */
  src: string;
  width: number;
  height: number;
  /** 无障碍替代文本（阅读页为「第 x 话 第 y 页」） */
  alt: string;
}

export interface Comic {
  slug: ComicSlug;
  title: string;
  author: string;
  /** 简介，详情页展示 */
  summary: string;
  /** 标签标识列表；标签本身在 Tag 表里 */
  tags: TagSlug[];
  /** 列表默认排序用（Q7）：升序 */
  order: number;
  cover: ImageRef;
}

/** 详情页话列表用的轻量条目（不含页面清单） */
export interface ChapterSummary {
  /** 话序号，从 1 开始，连续递增 */
  number: number;
  title: string;
}

export interface ComicDetail extends Comic {
  chapters: ChapterSummary[];
}

/** 阅读页需要的一话完整数据 */
export interface ChapterDetail {
  comic: { slug: ComicSlug; title: string };
  number: number;
  title: string;
  /** 有序页列表：序号即数组下标 + 1 */
  pages: ImageRef[];
  /** 上一话序号；第一话为 null */
  prev: number | null;
  /** 下一话序号；最后一话为 null */
  next: number | null;
}

/** 首页/列表的查询条件（来自 URL 查询参数） */
export interface ComicQuery {
  /** 关键词：对 title 与 author 做大小写不敏感的包含匹配（D-005、Q4） */
  q?: string;
  /** 标签筛选：单选（Q3） */
  tag?: TagSlug;
}

/** 单部漫画的本机阅读进度（存浏览器，见 storage.md） */
export interface ProgressRecord {
  chapter: number;
  /** 1 起算；口径 = 视口顶部起第一张可见页（Q6） */
  page: number;
  /** 读到最后一话最后一页后置为 true */
  finished: boolean;
  /** ISO 8601 字符串，写入时刻 */
  updatedAt: string;
}

/** key = ComicSlug */
export type ProgressMap = Record<ComicSlug, ProgressRecord>;

