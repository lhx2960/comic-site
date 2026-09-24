/* =============================================================================
 * F6 阅读进度记忆（P1）
 *
 * 需求依据：docs/specs/prd.md v1.1 的 F6-1 ～ F6-7
 * 契约依据：docs/contracts/storage.md
 *   - key = comicsite:progress:v1，值 = ProgressMap 的 JSON；
 *   - 滚动停止 500ms 后写入（防抖）；当前页 = 视口顶部往下第一张可见页（±1 页宽容）；
 *   - 最后一话滚到文档底部（距底 ≤24px）→ finished: true；
 *   - 进度只在本机本浏览器，清理浏览器数据即清除。
 * ========================================================================== */

import { expect, test } from "@playwright/test";

import {
  PROGRESS_KEY,
  clearProgressStorage,
  pageBlocks,
  progressRecord,
  readProgressMap,
  scrollToDocumentBottom,
  scrollToPageBlock,
  seedProgress,
  waitForReaderHydration,
} from "./fixtures";

test.describe("F6 阅读进度记忆", () => {
  test("F6-1 / F6-6 读到第 3 话第 6 页停顿 >0.5s → 写入「第 3 话 + 页序号」，关闭无报错 @webkit", async ({
    page,
    context,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/comics/xinghai/3");
    await expect(pageBlocks(page)).toHaveCount(10);
    // 先等 ReaderStrip 水合，否则这次滚动不会有人监听（测试时序问题）
    await waitForReaderHydration(page);

    // 视口顶部对齐第 6 页（index 5）→ 按 storage.md 口径当前页 = 第 6 页
    await scrollToPageBlock(page, 5);

    await expect
      .poll(async () => (await readProgressMap(page)).xinghai?.chapter ?? 0, {
        message: "滚动停止 500ms 后写入当前话",
      })
      .toBe(3);

    const record = (await readProgressMap(page)).xinghai;
    expect(record).toBeTruthy();
    expect(record?.page, "当前页 = 第 6 页（允许 ±1 页）").toBeGreaterThanOrEqual(5);
    expect(record?.page, "当前页 = 第 6 页（允许 ±1 页）").toBeLessThanOrEqual(7);
    expect(record?.finished).toBe(false);
    expect(Number.isNaN(Date.parse(record?.updatedAt ?? ""))).toBe(false);

    // 关闭当前页面（等价「关闭浏览器」）后重新打开：记录仍在
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto("/comics/xinghai");
    await expect(reopened.getByRole("link", { name: /继续阅读：第 3 话/ })).toBeVisible();

    expect(pageErrors, "关闭过程中不应有页面报错").toEqual([]);
    await reopened.close();
  });

  test("F6-2 重新进入第 3 话从记录页继续（不回到第 1 页） @webkit", async ({ page }) => {
    await seedProgress(page, { xinghai: progressRecord(3, 6) });

    await page.goto("/comics/xinghai/3");

    await expect(page.getByText("当前阅读位置 · 第 6 页")).toBeVisible();
    const top = await page
      .locator('[data-page-index="5"]')
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(Math.abs(top), "记录页已对齐视口顶部").toBeLessThan(60);

    const now = Number(await page.getByRole("progressbar").getAttribute("aria-valuenow"));
    expect(now).toBeGreaterThanOrEqual(5);
    expect(now).toBeLessThanOrEqual(7);
  });

  test("F6-3 详情页主按钮与记录值一致 @webkit", async ({ page }) => {
    await seedProgress(page, { xinghai: progressRecord(3, 6) });

    await page.goto("/comics/xinghai");

    const stored = (await readProgressMap(page)).xinghai;
    expect(stored?.chapter).toBe(3);
    expect(stored?.page).toBe(6);
    await expect(
      page.getByRole("link", { name: `继续阅读：第 ${stored?.chapter} 话 第 ${stored?.page} 页` }),
    ).toBeVisible();
    await expect(page.getByText("本机阅读记录", { exact: true })).toBeVisible();
  });

  test("F6-4 另一个浏览器上下文不共享进度，阅读从第 1 页开始", async ({ browser }) => {
    const first = await browser.newContext();
    const firstPage = await first.newPage();
    await firstPage.goto("/comics/xinghai/3");
    await expect(firstPage.locator("[data-page-index]")).toHaveCount(10);
    await waitForReaderHydration(firstPage);
    await scrollToPageBlock(firstPage, 5);
    await expect
      .poll(async () => (await readProgressMap(firstPage)).xinghai?.chapter ?? 0)
      .toBe(3);
    await first.close();

    const second = await browser.newContext();
    const secondPage = await second.newPage();
    await secondPage.goto("/comics/xinghai");
    await expect(secondPage.getByRole("link", { name: "开始阅读" })).toBeVisible();
    await expect(secondPage.getByText("本机阅读记录", { exact: true })).toHaveCount(0);

    await secondPage.goto("/comics/xinghai/3");
    await expect(secondPage.getByText(/当前阅读位置/)).toHaveCount(0);
    await second.close();
  });

  test("F6-5 清理浏览器本地数据后，不再出现「继续阅读」，阅读从第 1 页开始", async ({ page }) => {
    // 这条用例必须走「真实产生进度 → 清理」的路径：如果用 addInitScript 预置进度，
    // 每次导航都会重新写入，清理后再刷新会被重新塞回来（测试夹具的坑，不是产品问题）。
    await page.goto("/comics/xinghai/3");
    await expect(pageBlocks(page)).toHaveCount(10);
    await waitForReaderHydration(page);
    await scrollToPageBlock(page, 5);
    await expect.poll(async () => (await readProgressMap(page)).xinghai?.chapter ?? 0).toBe(3);

    await page.goto("/comics/xinghai");
    await expect(page.getByRole("link", { name: /继续阅读：第 3 话/ })).toBeVisible();

    await clearProgressStorage(page);
    await page.reload();

    await expect(page.getByRole("link", { name: "开始阅读" })).toBeVisible();
    await expect(page.getByText("本机阅读记录", { exact: true })).toHaveCount(0);
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), PROGRESS_KEY);
    expect(raw === null || !raw.includes("xinghai")).toBeTruthy();
  });

  test("F6-7 读到第 5 话最后一页 → 标记「已读完」，详情页给出从头再读入口", async ({ page }) => {
    await page.goto("/comics/xinghai/5");
    await expect(pageBlocks(page)).toHaveCount(10);
    await waitForReaderHydration(page);

    await scrollToDocumentBottom(page);

    await expect
      .poll(async () => (await readProgressMap(page)).xinghai?.finished ?? false, {
        message: "最后一话滚到文档底部 → finished: true",
      })
      .toBe(true);

    const record = (await readProgressMap(page)).xinghai;
    expect(record?.chapter).toBe(5);
    expect(record?.page).toBeGreaterThanOrEqual(9);

    await page.goto("/comics/xinghai");
    await expect(page.getByText("已读完", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "从第 1 话重读" })).toBeVisible();

    await page.getByRole("link", { name: "已读完，从头再读" }).click();
    await expect(page).toHaveURL(/\/comics\/xinghai\/1$/);
  });
});
