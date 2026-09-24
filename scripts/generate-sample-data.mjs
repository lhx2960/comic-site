#!/usr/bin/env node
/* =============================================================================
 * 示例数据生成器 —— 仓库里所有「示例数据」的唯一来源
 *
 * 这个脚本在开发开始前手动跑一次（`pnpm generate:sample-data`），产出两样东西，
 * 两者都会提交进仓库：
 *
 *   1. public/comics/<slug>/<话号>/<页号>.svg
 *      3 部 × 5 话 × 10 页 = 150 张 600×800 占位图，图面写明话号与页码；
 *   2. data/comics.ts
 *      与 docs/contracts/types.ts 对齐的示例数据（漫画 + 话 + 标签）。
 *
 * 为什么用脚本而不是手写：150 张图和对应的类型化数据必须永远一致，「图少了一张」
 * 这类手工错误不该出现在项目里。脚本是幂等的：每次先清空 public/comics 再重建，
 * 且输出里不含时间戳，所以重复执行不会产生多余的 git 变更。
 *
 * 注意：页面清单（每话那 10 页）不写进 data/comics.ts，而是由「目录约定」推导，
 * 见 src/lib/data/queries.ts 的 buildPages()；tests/data/sample-assets.test.ts
 * 会逐页核对磁盘上真有这些文件，保证推导与产物不会脱节。
 * ========================================================================== */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 仓库根目录（本文件位于 scripts/ 下）；path.resolve 会去掉末尾分隔符，便于做前缀校验 */
const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_COMICS_DIR = path.join(REPO_ROOT, "public", "comics");
const DATA_FILE_PATH = path.join(REPO_ROOT, "data", "comics.ts");

/** 占位图尺寸 3:4，与契约 ImageRef 的显式宽高一致（阅读页不跳动的前提） */
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
/** 每话页数：3 部 × 5 话 × 10 页 = 150 张 */
const PAGES_PER_CHAPTER = 10;
/** 每部话数：与任务单 T-003 的「3 部 × 5 话 × 10 页」一致 */
const CHAPTERS_PER_COMIC = 5;

/** 标签表：数组顺序即首页筛选条的展示顺序；每个标签至少命中 1 部漫画 */
const TAGS = [
  { slug: "scifi", name: "科幻" },
  { slug: "mystery", name: "悬疑" },
  { slug: "adventure", name: "冒险" },
  { slug: "slice-of-life", name: "日常" },
  { slug: "romance", name: "恋爱" },
];

/**
 * 3 部示例漫画。刻意让数据覆盖后面的测试分支：
 * - `neon-midnight-express` 的标题含 ASCII 字母，用来验证「大小写不敏感」；
 * - 作者有中文也有拉丁字母，用来验证关键词同时匹配 title 与 author；
 * - 简介里出现「中继星」这类只存在于简介的词，用来验证关键词不匹配简介。
 */
const COMICS = [
  {
    slug: "xinghai",
    title: "星海拾遗",
    author: "林岸",
    summary:
      "拾荒船在废弃中继星的残骸里捞出一段旧历元年的航行日志，日志的主人似乎还在等一封回信。",
    tags: ["scifi", "adventure"],
    order: 1,
    palette: { bg: "#0E1116", ink: "#E8EAF0", accent: "#C2410C" },
    chapters: ["冷启动", "残骸里的回声", "无人值守的中继站", "日志第七页", "回信"],
  },
  {
    slug: "neon-midnight-express",
    title: "NEON 午夜快车",
    author: "Kai Mori",
    summary:
      "末班列车只在雨夜出现，车票是一段被删掉的记忆。侦探必须在终点站之前找出是谁在售票。",
    tags: ["scifi", "mystery"],
    order: 2,
    palette: { bg: "#12121C", ink: "#EFF0F6", accent: "#7C3AED" },
    chapters: ["雨夜末班", "被删掉的票根", "车厢里的第三人", "终点站之前", "售票的人"],
  },
  {
    slug: "slow-cooking",
    title: "慢煮时光",
    author: "陈小满",
    summary:
      "巷口的小店只做三道菜，每一道都要等。等菜的人，也顺便等到了自己的答案。",
    tags: ["slice-of-life", "romance"],
    order: 3,
    palette: { bg: "#F7F1E8", ink: "#2A241C", accent: "#B45309" },
    chapters: ["第一道：汤", "第二道：面", "第三道：甜", "打烊之后", "加一份"],
  },
];

/** 页文件名固定三位补零（001.svg），保证字典序 = 页码序 */
function pageFileName(page) {
  return `${String(page).padStart(3, "0")}.svg`;
}

/** 站点内绝对路径，与契约 ImageRef.src 的写法一致 */
function pageSrc(comic, chapter, page) {
  return `/comics/${comic.slug}/${chapter}/${pageFileName(page)}`;
}

/** SVG 是 XML，文本节点里的 & < > 必须转义，否则文件本身就不是合法 XML */
function escapeXml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** 单张占位图：图面写漫画名、话号、大号页码 —— 阅读页滚动时一眼能认出进度 */
function renderPageSvg(comic, chapterNumber, chapterTitle, page) {
  const { bg, ink, accent } = comic.palette;
  const label = `第 ${chapterNumber} 话 第 ${page} 页`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}" role="img" aria-label="${escapeXml(comic.title)} ${escapeXml(label)}">
  <title>${escapeXml(comic.title)} · ${escapeXml(label)}</title>
  <rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="${bg}" />
  <rect x="24" y="24" width="${PAGE_WIDTH - 48}" height="${PAGE_HEIGHT - 48}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.55" />
  <text x="300" y="118" text-anchor="middle" font-family="sans-serif" font-size="26" fill="${ink}" opacity="0.78">${escapeXml(comic.title)}</text>
  <text x="300" y="166" text-anchor="middle" font-family="sans-serif" font-size="22" fill="${accent}">第 ${chapterNumber} 话</text>
  <text x="300" y="470" text-anchor="middle" font-family="sans-serif" font-size="200" font-weight="700" fill="${ink}">${page}</text>
  <text x="300" y="556" text-anchor="middle" font-family="sans-serif" font-size="30" fill="${ink}" opacity="0.85">第 ${page} 页</text>
  <text x="300" y="726" text-anchor="middle" font-family="sans-serif" font-size="24" fill="${ink}" opacity="0.6">${escapeXml(chapterTitle)}</text>
</svg>
`;
}

/** 生成 data/comics.ts 的完整文本（格式固定，保证重复执行输出一致） */
function renderDataFile() {
  const tagLines = TAGS.map((tag) => `  { slug: "${tag.slug}", name: "${tag.name}" },`).join("\n");

  const comicBlocks = COMICS.map((comic) => {
    const chapterLines = comic.chapters
      .map((title, index) => `      { number: ${index + 1}, title: "${title}" },`)
      .join("\n");
    const tagList = comic.tags.map((tag) => `"${tag}"`).join(", ");
    return `  {
    slug: "${comic.slug}",
    title: "${comic.title}",
    author: "${comic.author}",
    summary:
      "${comic.summary}",
    tags: [${tagList}],
    order: ${comic.order},
    // 封面复用第 1 话第 1 页（见任务单 T-003 的「恰好 150 张 SVG」约束），
    // 卡片端用 2:3 容器裁切显示，因此这里不需要第 151 张专属封面图。
    cover: {
      src: "${pageSrc(comic, 1, 1)}",
      width: ${PAGE_WIDTH},
      height: ${PAGE_HEIGHT},
      alt: "《${comic.title}》封面",
    },
    chapters: [
${chapterLines}
    ],
  },`;
  }).join("\n");

  return `// 本文件由 scripts/generate-sample-data.mjs 自动生成 —— 请勿手改。
// 要改示例数据：编辑脚本顶部的 TAGS / COMICS，然后执行 pnpm generate:sample-data。
// 字段必须与 docs/contracts/types.ts 一致（契约先行，AGENTS.md 硬规则 1）。

import type { ComicDetail, Tag } from "@/types/comic";

/** 占位图统一宽高：契约 ImageRef 要求显式尺寸，页面据此预留空间避免布局跳动 */
export const pageWidth = ${PAGE_WIDTH};
export const pageHeight = ${PAGE_HEIGHT};

/** 每话页数：占位图按此生成，访问层据此推导每话的页面清单 */
export const pagesPerChapter = ${PAGES_PER_CHAPTER};

/** 标签表：数组顺序即首页筛选条的展示顺序（契约 listTags() 的返回顺序） */
export const tags: Tag[] = [
${tagLines}
];

/** 漫画数据：chapters 已按话号升序排列；order 唯一，升序即默认排序 */
export const comics: ComicDetail[] = [
${comicBlocks}
];
`;
}

/** 数据自检：把契约里「每个标签至少命中 1 部」等约束在生成期就拦下来 */
function assertDataIsConsistent() {
  for (const comic of COMICS) {
    if (comic.chapters.length !== CHAPTERS_PER_COMIC) {
      throw new Error(`漫画 ${comic.slug} 的话数应为 ${CHAPTERS_PER_COMIC}，实际 ${comic.chapters.length}`);
    }
    for (const tag of comic.tags) {
      if (!TAGS.some((item) => item.slug === tag)) {
        throw new Error(`漫画 ${comic.slug} 引用了未定义的标签 ${tag}`);
      }
    }
  }
  const orders = new Set(COMICS.map((comic) => comic.order));
  if (orders.size !== COMICS.length) {
    throw new Error("漫画 order 必须唯一（契约：order 升序即默认排序）");
  }
  for (const tag of TAGS) {
    if (!COMICS.some((comic) => comic.tags.includes(tag.slug))) {
      throw new Error(`标签 ${tag.slug} 没有任何漫画命中（任务单要求每个标签至少命中 1 部）`);
    }
  }
}

async function main() {
  assertDataIsConsistent();

  // 清空前先确认目标确实在仓库内，避免路径被改坏时误删仓库外的目录。
  if (!PUBLIC_COMICS_DIR.startsWith(REPO_ROOT + path.sep)) {
    throw new Error(`拒绝清理仓库外的路径：${PUBLIC_COMICS_DIR}`);
  }
  await rm(PUBLIC_COMICS_DIR, { recursive: true, force: true });

  let pageCount = 0;
  for (const comic of COMICS) {
    for (const [index, chapterTitle] of comic.chapters.entries()) {
      const chapterNumber = index + 1;
      const chapterDir = path.join(PUBLIC_COMICS_DIR, comic.slug, String(chapterNumber));
      await mkdir(chapterDir, { recursive: true });
      for (let page = 1; page <= PAGES_PER_CHAPTER; page += 1) {
        await writeFile(
          path.join(chapterDir, pageFileName(page)),
          renderPageSvg(comic, chapterNumber, chapterTitle, page),
          "utf8",
        );
        pageCount += 1;
      }
    }
  }

  await mkdir(path.dirname(DATA_FILE_PATH), { recursive: true });
  await writeFile(DATA_FILE_PATH, renderDataFile(), "utf8");

  console.log(
    `[generate-sample-data] 漫画 ${COMICS.length} 部 / 话 ${COMICS.length * CHAPTERS_PER_COMIC} / 标签 ${TAGS.length} 个 / 占位图 ${pageCount} 张`,
  );
  console.log("[generate-sample-data] 输出：public/comics/**（SVG）、data/comics.ts（类型化数据）");
}

main().catch((error) => {
  console.error("[generate-sample-data] 失败：", error);
  process.exitCode = 1;
});
