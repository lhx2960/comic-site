/* =============================================================================
 * 示例数据与磁盘占位图的一致性测试
 *
 * 访问层的页面清单是从目录约定推导出来的（见 queries.ts 的 buildPages），
 * 这里逐页核对磁盘：占位图恰好 150 张、每张都是 600×800 且写着页码、
 * 每张被数据引用的图都真的存在。这样「脚本产物」与「访问层推导」不会脱节。
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

describe("占位图产物（任务单验收：恰好 150 张 600×800 SVG）", () => {
  const svgs = collectSvgs(COMICS_DIR);

  it(`恰好 ${3 * 5 * pagesPerChapter} 张 SVG（3 部 × 5 话 × 10 页）`, () => {
    expect(svgs).toHaveLength(150);
    expect(svgs.length).toBe(comics.length * 5 * pagesPerChapter);
  });

  it("每张都是 600×800，且图面写着对应页码", () => {
    for (const file of svgs) {
      const content = readFileSync(file, "utf8");
      expect(content).toContain('width="600"');
      expect(content).toContain('height="800"');
      // 文件名末三位就是页码，例如 .../010.svg → 「第 10 页」
      const page = Number(path.basename(file, ".svg"));
      expect(page).toBeGreaterThan(0);
      expect(content).toContain(`第 ${page} 页`);
    }
  });
});

describe("数据与产物的对应关系", () => {
  it("每部漫画的封面文件都真实存在", () => {
    for (const comic of comics) {
      expect(() => readFileSync(toDiskPath(comic.cover.src), "utf8")).not.toThrow();
      expect(comic.cover.width).toBe(600);
      expect(comic.cover.height).toBe(800);
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
