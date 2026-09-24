/* =============================================================================
 * F5 阅读页（纵向长条滚动 + 接下一话）+ D-016 地址同步的三条必测
 *
 * 需求依据：docs/specs/prd.md v1.1 的 F5-1 ～ F5-9
 * 裁决依据：D-004（滚到底接下一话）、D-016（history.replaceState 同步地址）、
 *           D-017（notFound 页面按 UI 断言，不断言状态码）
 * ========================================================================== */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  chapterRows,
  horizontalOverflow,
  pageBlocks,
  scrollToDocumentBottom,
  scrollToPageBlock,
  scrollUntilSection,
  sectionBlocks,
  waitForReaderHydration,
} from "./fixtures";

declare global {
  interface Window {
    /** F5-4 用例用来记录「下一话区块是否真的出现过」（它可能一闪就被第 4 话内容顶掉） */
    __sawNextBlock?: boolean;
  }
}

/** 阅读页顶栏（第一条 header）：含漫画名与「第 x 话 · 标题」 */
function readerHeader(page: Page) {
  return page.locator("header").first();
}

/**
 * 从详情页进入第 3 话，并一直读到第 4 话内容（地址栏已同步为第 4 话）。
 * D-016 的三条必测都以这个状态为起点。
 */
async function readIntoChapter4(page: Page): Promise<void> {
  await page.goto("/comics/xinghai");
  await chapterRows(page).filter({ hasText: "第 3 话" }).click();
  await expect(page).toHaveURL(/\/comics\/xinghai\/3$/);
  await waitForReaderHydration(page);

  await scrollUntilSection(page, 4);
  await expect(page.locator('[data-section="4"]')).toBeAttached();

  // 滚进第 4 话的正文（第 1 页对齐视口顶部）→ 顶栏与地址栏同步为第 4 话
  await sectionBlocks(page, 4).first().evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
  await expect.poll(() => page.url()).toMatch(/\/comics\/xinghai\/4$/);
}

test.describe("F5 阅读页", () => {
  test("F5-1 该话 10 页按页序纵向排列，不缺页/不重复/不乱序 @webkit", async ({ page }) => {
    await page.goto("/comics/xinghai/3");

    await expect(pageBlocks(page)).toHaveCount(10);
    const indices = await pageBlocks(page).evaluateAll((nodes) =>
      nodes.map((node) => Number(node.dataset.pageIndex)),
    );
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    // 页图 alt 按契约是「第 x 话 第 y 页」；首屏第 1 页必须已经加载
    await expect(page.locator('img[alt="第 3 话 第 1 页"]')).toBeVisible();
    // 第 2 页在首屏之外，按 F5-10 的懒加载策略要滚到附近才挂载
    await scrollToPageBlock(page, 1);
    await expect(page.locator('img[alt="第 3 话 第 2 页"]')).toBeVisible();
  });

  test("F5-2 标题区显示漫画标题与当前话序号 @webkit", async ({ page }) => {
    await page.goto("/comics/xinghai/3");

    const header = readerHeader(page);
    await expect(header).toContainText("星海拾遗");
    await expect(header).toContainText("第 3 话");
    await expect(header).toContainText("无人值守的中继站");
    await expect(page.getByRole("link", { name: "返回详情" })).toBeVisible();
  });

  test("F5-3a 360px 宽：无横向滚动，每页完整落在视口内", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/comics/xinghai/3");
    await expect(pageBlocks(page)).toHaveCount(10);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    const widths = await pageBlocks(page).evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().width)),
    );
    expect(new Set(widths).size, "每页宽度一致").toBe(1);
    for (const width of widths) {
      expect(width).toBeLessThanOrEqual(361);
    }
  });

  test("F5-3b 1440px 宽：无横向滚动，图片列宽一致且不超出视口", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/comics/xinghai/3");
    await expect(pageBlocks(page)).toHaveCount(10);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    const widths = await pageBlocks(page).evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().width)),
    );
    expect(new Set(widths).size, "每页宽度一致").toBe(1);
    for (const width of widths) {
      expect(width).toBeLessThanOrEqual(1441);
    }
  });

  test("F5-4 第 3 话连续向下滚动 → 出现「下一话（第 4 话）」区块并接续，顶栏与地址栏更新 @webkit", async ({
    page,
  }) => {
    // 记录「下一话」区块是否真的出现在过页面上（它可能很快被第 4 话内容顶掉）
    await page.addInitScript(() => {
      window.__sawNextBlock = false;
      window.setInterval(() => {
        if (document.body?.innerText.includes("下一话 · 第 4 话")) {
          window.__sawNextBlock = true;
        }
      }, 50);
    });

    await page.goto("/comics/xinghai/3");
    await expect(pageBlocks(page)).toHaveCount(10);
    await expect(page.locator('img[alt="第 3 话 第 1 页"]')).toBeVisible();

    await scrollUntilSection(page, 4);
    await expect(page.locator('[data-section="4"]')).toBeAttached();
    await expect(sectionBlocks(page, 4)).toHaveCount(10);
    expect(await page.evaluate(() => window.__sawNextBlock === true), "出现过「下一话」区块").toBe(
      true,
    );

    await sectionBlocks(page, 4).first().evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });
    await expect(readerHeader(page)).toContainText("第 4 话");
    await expect.poll(() => page.url()).toMatch(/\/comics\/xinghai\/4$/);
  });

  test("F5-5 第 5 话滚到底 → 「已是最后一话」+ 返回详情与回到顶部入口", async ({ page }) => {
    await page.goto("/comics/xinghai/5");

    await scrollToDocumentBottom(page);

    await expect(page.getByRole("heading", { name: "已是最后一话" })).toBeVisible();
    // 顶栏与收尾卡里各有一个「返回详情」入口
    await expect(page.getByRole("link", { name: "返回详情" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "回到顶部" }).first()).toBeVisible();
    // 最后一话之后不再接续内容
    await expect(page.locator('[data-section="6"]')).toHaveCount(0);
  });

  test("F5-6 已进入第 4 话后向上滚回，第 3 话内容仍在且顺序为 3 → 4 @webkit", async ({
    page,
  }) => {
    await page.goto("/comics/xinghai/3");
    await waitForReaderHydration(page);
    await scrollUntilSection(page, 4);
    await expect(page.locator('[data-section="4"]')).toBeAttached();

    // 向上滚回第 3 话末尾
    await scrollToPageBlock(page, 9);
    await expect(page.locator('[data-page-index="9"]')).toBeInViewport();

    await expect(sectionBlocks(page, 3)).toHaveCount(10);
    const contiguous = await page.evaluate(() => {
      const third = document.querySelector('[data-section="3"]');
      const fourth = document.querySelector('[data-section="4"]');
      if (!third || !fourth) {
        return false;
      }
      // 第 4 话必须排在第 3 话之后（同一条滚动流）
      return Boolean(third.compareDocumentPosition(fourth) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(contiguous, "第 3 话在第 4 话之前").toBe(true);
  });

  test("F5-7 从详情页进入第 5 话：从第 1 页开始，之后不再接续", async ({ page }) => {
    await page.goto("/comics/xinghai");
    await chapterRows(page).filter({ hasText: "第 5 话" }).click();

    await expect(page).toHaveURL(/\/comics\/xinghai\/5$/);
    await expect(readerHeader(page)).toContainText("第 5 话");
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBeLessThan(10);

    await scrollToDocumentBottom(page);
    await expect(page.getByRole("heading", { name: "已是最后一话" })).toBeVisible();
  });

  test("F5-8 直接把地址改成第 2 话并打开：从第 1 页开始，标题区显示第 2 话", async ({
    page,
  }) => {
    await page.goto("/comics/xinghai/2");

    await expect(readerHeader(page)).toContainText("第 2 话");
    await expect(readerHeader(page)).toContainText("残骸里的回声");
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBeLessThan(10);
  });

  test("F5-9 打开不存在的话 → 「这一话不存在」+ 返回详情入口（含前导零地址）", async ({
    page,
  }) => {
    await page.goto("/comics/xinghai/9");
    await expect(page.getByRole("heading", { name: "这一话不存在" })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回详情" })).toHaveAttribute(
      "href",
      "/comics/xinghai",
    );
    await expect(page.getByText(/Error|Unhandled|at \w+\./)).toHaveCount(0);

    // routes.md：`chapter` 必须匹配 ^[1-9][0-9]*$，前导零按「不存在」处理
    await page.goto("/comics/xinghai/01");
    await expect(page.getByRole("heading", { name: "这一话不存在" })).toBeVisible();
  });
});

test.describe("D-016 接下一话的地址同步", () => {
  test("D-016-① 滚到第 4 话后点「返回详情」，导航正常 @webkit", async ({ page }) => {
    await readIntoChapter4(page);

    await page.getByRole("link", { name: "返回详情" }).first().click();

    await expect(page).toHaveURL(/\/comics\/xinghai$/);
    await expect(page.getByRole("heading", { level: 1, name: "星海拾遗" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "话列表" })).toBeVisible();
  });

  test("D-016-② 滚到第 4 话后硬刷新，仍落在第 4 话 @webkit", async ({ page }) => {
    await readIntoChapter4(page);

    await page.reload();

    await expect(page).toHaveURL(/\/comics\/xinghai\/4$/);
    await expect(readerHeader(page)).toContainText("第 4 话");
    await expect(page.locator('[data-section="4"]')).toBeAttached();
    await expect(pageBlocks(page)).toHaveCount(10);
  });

  test("D-016-③ 滚到第 4 话后按浏览器后退，回到进入阅读页之前的页面 @webkit", async ({
    page,
  }) => {
    await readIntoChapter4(page);

    await page.goBack();

    await expect(page).toHaveURL(/\/comics\/xinghai$/);
    await expect(page.getByRole("heading", { level: 1, name: "星海拾遗" })).toBeVisible();
  });

  // ── 缺陷留痕（F-01）─────────────────────────────────────────────────────
  // 这条用例断言的是 PRD F5-4 的完整语义：滚到底部后「继续向下即呈现第 4 话内容」。
  // 实测不成立：接下一话的判定只写在 scroll 事件回调里，一旦用户在数据回来之前
  // 就停在文档底部（按 End / 拖滚动条到底 / 甩到底），后面不会再有 scroll 事件，
  // 第 4 话就一直不接续；必须重新产生位移（例如向上滚一点）才会接上。
  test("F5-4b【缺陷 F-01】直接跳到底部并停住时，第 4 话应当自动接续", async ({ page }) => {
    await page.goto("/comics/xinghai/3");
    await expect(page.locator('img[alt="第 3 话 第 1 页"]')).toBeVisible();
    await page.waitForTimeout(500);

    await scrollToDocumentBottom(page);

    // 预取已经成功、话末区块已显示第 4 话标题，但内容始终没有接上
    await expect(page.getByRole("button", { name: /下一话 · 第 4 话/ })).toBeVisible();
    await expect
      .poll(() => page.locator('[data-section="4"]').count(), {
        message: "停在底部时第 4 话也应接续（当前实现不会）",
        timeout: 8000,
      })
      .toBeGreaterThan(0);
  });
});
