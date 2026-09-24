/* =============================================================================
 * 示例数据与磁盘占位图的一致性测试
 *
 * 访问层的页面清单是从目录约定推导出来的（见 queries.ts 的 buildPages），
 * 这里逐张核对磁盘，让「脚本产物」与「访问层推导」不会脱节：
 *   - 页图 150 张（3 部 × 5 话 × 10 页），600×800（3:4），图面写页码；
 *   - 封面 3 张（每部 1 张），600×900（2:3），与卡片容器同比例、无需裁切；
 *   - 数据里引用的每一个路径都真实存在，尺寸与 ImageRef 一致。
 * ========================================================================== */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { comics, pagesPerChapter } from "@data/comics";
import { getChapter } from "@/lib/data/queries";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const COMICS_DIR = path.join(PUBLIC_DIR, "comics");

/** 递归收集 public/comics 下的 SVG 绝对路径 */
function collectSvgs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSvgs(fullPath);
    }
    return entry.name.endsWith(".svg") ? [fullPath] : [];
  });
}

/** 数据里的站点内路径（/comics/...）→ 磁盘路径 */
function toDiskPath(sitePath: string): string {
  return path.join(PUBLIC_DIR, sitePath.replace(/^\//, ""));
}

const svgs = collectSvgs(COMICS_DIR);
const coverSvgs = svgs.filter((file) => path.basename(file) === "cover.svg");
const pageSvgs = svgs.filter((file) => path.basename(file) !== "cover.svg");

describe("占位图产物：页图 150 张 3:4 + 封面 3 张 2:3", () => {
  it(`页图恰好 ${3 * 5 * pagesPerChapter} 张（3 部 × 5 话 × 10 页）`, () => {
    expect(pageSvgs).toHaveLength(150);
    expect(pageSvgs.length).toBe(comics.length * 5 * pagesPerChapter);
  });

  it("每部漫画各 1 张封面，共 3 张，且放在漫画根目录", () => {
    expect(coverSvgs).toHaveLength(comics.length);
    for (const comic of comics) {
      expect(coverSvgs).toContain(toDiskPath(`/comics/${comic.slug}/cover.svg`));
    }
  });

  it("每张页图都是 600×800，且图面写着对应页码", () => {
    for (const file of pageSvgs) {
      const content = readFileSync(file, "utf8");
      expect(content).toContain('width="600"');
      expect(content).toContain('height="800"');
      // 文件名末三位就是页码，例如 .../010.svg → 「第 10 页」
      const page = Number(path.basename(file, ".svg"));
      expect(page).toBeGreaterThan(0);
      expect(content).toContain(`第 ${page} 页`);
    }
  });

  it("每张封面都是 600×900（2:3），且图面写着书名与作者", () => {
    for (const comic of comics) {
      const content = readFileSync(toDiskPath(`/comics/${comic.slug}/cover.svg`), "utf8");
      expect(content).toContain('width="600"');
      expect(content).toContain('height="900"');
      expect(content).toContain("封面 2:3");
      expect(content).toContain(comic.title);
      expect(content).toContain(comic.author);
    }
  });
});

describe("数据与产物的对应关系", () => {
  it("每部漫画的封面路径存在，且宽高比是 2:3（600×900）", () => {
    for (const comic of comics) {
      expect(() => readFileSync(toDiskPath(comic.cover.src), "utf8")).not.toThrow();
      expect(comic.cover.src).toBe(`/comics/${comic.slug}/cover.svg`);
      expect(comic.cover.width).toBe(600);
      expect(comic.cover.height).toBe(900);
      expect(comic.cover.height / comic.cover.width).toBeCloseTo(3 / 2, 5);
    }
  });

  it("每话的每一页都能在磁盘上找到，且尺寸与契约一致", () => {
    for (const comic of comics) {
      expect(comic.chapters).toHaveLength(5);
      for (const chapter of comic.chapters) {
        const detail = getChapter(comic.slug, chapter.number);
        expect(detail?.pages).toHaveLength(pagesPerChapter);
        for (const page of detail?.pages ?? []) {
          expect(() => readFileSync(toDiskPath(page.src), "utf8")).not.toThrow();
          expect(page.width).toBe(600);
          expect(page.height).toBe(800);
        }
      }
    }
  });

  it("至少有一部漫画的标题含 ASCII 字母（用于验证大小写不敏感匹配）", () => {
    expect(comics.some((comic) => /[A-Za-z]/.test(comic.title))).toBe(true);
  });
});
