// 本文件由 scripts/generate-sample-data.mjs 自动生成 —— 请勿手改。
// 要改示例数据：编辑脚本顶部的 TAGS / COMICS，然后执行 pnpm generate:sample-data。
// 字段必须与 docs/contracts/types.ts 一致（契约先行，AGENTS.md 硬规则 1）。

import type { ComicDetail, Tag } from "@/types/comic";

/** 占位图统一宽高：契约 ImageRef 要求显式尺寸，页面据此预留空间避免布局跳动 */
export const pageWidth = 600;
export const pageHeight = 800;

/** 每话页数：占位图按此生成，访问层据此推导每话的页面清单 */
export const pagesPerChapter = 10;

/** 标签表：数组顺序即首页筛选条的展示顺序（契约 listTags() 的返回顺序） */
export const tags: Tag[] = [
  { slug: "scifi", name: "科幻" },
  { slug: "mystery", name: "悬疑" },
  { slug: "adventure", name: "冒险" },
  { slug: "slice-of-life", name: "日常" },
  { slug: "romance", name: "恋爱" },
];

/** 漫画数据：chapters 已按话号升序排列；order 唯一，升序即默认排序 */
export const comics: ComicDetail[] = [
  {
    slug: "xinghai",
    title: "星海拾遗",
    author: "林岸",
    summary:
      "拾荒船在废弃中继星的残骸里捞出一段旧历元年的航行日志，日志的主人似乎还在等一封回信。",
    tags: ["scifi", "adventure"],
    order: 1,
    // 封面是独立的 2:3（600×900）占位图，与卡片容器同比例，展示时不裁切（ui.md §3.6）
    cover: {
      src: "/comics/xinghai/cover.svg",
      width: 600,
      height: 900,
      alt: "封面：星海拾遗",
    },
    chapters: [
      { number: 1, title: "冷启动" },
      { number: 2, title: "残骸里的回声" },
      { number: 3, title: "无人值守的中继站" },
      { number: 4, title: "日志第七页" },
      { number: 5, title: "回信" },
    ],
  },
  {
    slug: "neon-midnight-express",
    title: "NEON 午夜快车",
    author: "Kai Mori",
    summary:
      "末班列车只在雨夜出现，车票是一段被删掉的记忆。侦探必须在终点站之前找出是谁在售票。",
    tags: ["scifi", "mystery"],
    order: 2,
    // 封面是独立的 2:3（600×900）占位图，与卡片容器同比例，展示时不裁切（ui.md §3.6）
    cover: {
      src: "/comics/neon-midnight-express/cover.svg",
      width: 600,
      height: 900,
      alt: "封面：NEON 午夜快车",
    },
    chapters: [
      { number: 1, title: "雨夜末班" },
      { number: 2, title: "被删掉的票根" },
      { number: 3, title: "车厢里的第三人" },
      { number: 4, title: "终点站之前" },
      { number: 5, title: "售票的人" },
    ],
  },
  {
    slug: "slow-cooking",
    title: "慢煮时光",
    author: "陈小满",
    summary:
      "巷口的小店只做三道菜，每一道都要等。等菜的人，也顺便等到了自己的答案。",
    tags: ["slice-of-life", "romance"],
    order: 3,
    // 封面是独立的 2:3（600×900）占位图，与卡片容器同比例，展示时不裁切（ui.md §3.6）
    cover: {
      src: "/comics/slow-cooking/cover.svg",
      width: 600,
      height: 900,
      alt: "封面：慢煮时光",
    },
    chapters: [
      { number: 1, title: "第一道：汤" },
      { number: 2, title: "第二道：面" },
      { number: 3, title: "第三道：甜" },
      { number: 4, title: "打烊之后" },
      { number: 5, title: "加一份" },
    ],
  },
];
