/* =============================================================================
 * F4 漫画详情（含进度入口 P1）
 *
 * 需求依据：docs/specs/prd.md v1.1 的 F4-1 ～ F4-9
 * 契约依据：Q5（落点规则：有记录从记录页继续，否则第 1 话第 1 页）、
 *           Q8（详情页不显示连载状态/阅读量，话列表不显示页数）、
 *           storage.md（详情页主按钮文案随记录变化、清除记录入口在次要位置）
 * ========================================================================== */

import { expect, test } from "@playwright/test";

import {
  PROGRESS_KEY,
  chapterRows,
  progressRecord,
  readProgressMap,
  seedProgress,
} from "./fixtures";

test.describe("F4 漫画详情", () => {
  test("F4-1 详情页显示标题/作者/全部标签/简介/话列表，且不显示连载状态与阅读量 @webkit", async ({
    page,
  }) => {
    await page.goto("/comics/xinghai");

    await expect(page.getByRole("heading", { level: 1, name: "星海拾遗" })).toBeVisible();
    await expect(page.getByText("作者：林岸")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "科幻" }).first()).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "冒险" }).first()).toBeVisible();
    await expect(
      page.getByText("拾荒船在废弃中继星的残骸里捞出一段旧历元年的航行日志"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "话列表" })).toBeVisible();

    // Q8：不出现连载状态、阅读量这类元信息
    await expect(page.getByText("连载")).toHaveCount(0);
    await expect(page.getByText("阅读量")).toHaveCount(0);
    await expect(page.getByText("更新于")).toHaveCount(0);
  });

  test("F4-2 话列表共 5 条，按 1 → 5 升序，每条只有话序号与话标题（不显示页数）", async ({
    page,
  }) => {
    await page.goto("/comics/xinghai");

    await expect(page.getByText("共 5 话")).toBeVisible();
    await expect(chapterRows(page)).toHaveCount(5);

    const texts = await chapterRows(page).allInnerTexts();
    for (const [index, text] of texts.entries()) {
      const number = index + 1;
      expect(text).toContain(`第 ${number} 话`);
      // Q8：不显示页数。注意不能直接禁「页」字——第 4 话的标题就叫《日志第七页》，
      // 这里禁的是「数字 + 页」这种页数写法。
      expect(text).not.toMatch(/\d+\s*页/);
    }
    // 升序：DOM 顺序里第 1 话在第 2 话之前（用 href 判定，避免文案干扰）
    const hrefs = await chapterRows(page).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href") ?? ""),
    );
    expect(hrefs).toEqual([
      "/comics/xinghai/1",
      "/comics/xinghai/2",
      "/comics/xinghai/3",
      "/comics/xinghai/4",
      "/comics/xinghai/5",
    ]);
  });

  test("F4-3 无进度时点第 3 话 → 进入第 3 话第 1 页 @webkit", async ({ page }) => {
    await page.goto("/comics/xinghai");

    await chapterRows(page).filter({ hasText: "第 3 话" }).click();

    await expect(page).toHaveURL(/\/comics\/xinghai\/3$/);
    await expect(page.locator("header").first()).toContainText("第 3 话");
    // 无记录 → 不出现「当前阅读位置」标记，且停在文档顶部（第 1 页）
    await expect(page.getByText(/当前阅读位置/)).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBeLessThan(10);
  });

  test("F4-4 无进度时主按钮为「开始阅读」，点击进入第 1 话第 1 页 @webkit", async ({
    page,
  }) => {
    await page.goto("/comics/slow-cooking");

    const cta = page.getByRole("link", { name: "开始阅读" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/comics/slow-cooking/1");
    await cta.click();

    await expect(page).toHaveURL(/\/comics\/slow-cooking\/1$/);
    await expect(page.locator("header").first()).toContainText("第 1 话");
  });

  test("F4-5 打开不存在的漫画 → 「这部漫画不存在」+ 返回入口，无错误堆栈 @webkit", async ({
    page,
  }) => {
    await page.goto("/comics/nope");

    await expect(page.getByRole("heading", { name: "这部漫画不存在" })).toBeVisible();
    await expect(page.getByText("链接可能被改过")).toBeVisible();
    await expect(page.getByRole("link", { name: "返回首页" })).toBeVisible();
    // G3 / G9：不出现空白页与错误堆栈
    await expect(page.getByText(/Error|Unhandled|at \w+\./)).toHaveCount(0);
    expect((await page.locator("body").innerText()).trim().length).toBeGreaterThan(0);
  });

  test("F4-6 有进度时主按钮显示「继续阅读：第 x 话 第 y 页」，点击进入该话该页", async ({
    page,
  }) => {
    await seedProgress(page, { xinghai: progressRecord(3, 6) });
    await page.goto("/comics/xinghai");

    const cta = page.getByRole("link", { name: "继续阅读：第 3 话 第 6 页" });
    await expect(cta).toBeVisible();
    await expect(page.getByText("第 3 话 · 第 6 页")).toBeVisible();

    await cta.click();

    await expect(page).toHaveURL(/\/comics\/xinghai\/3$/);
    // 落点 = 记录页（storage.md 的 ±1 页宽容：第 5/6/7 页都算通过）
    await expect(page.getByText(/当前阅读位置 · 第 [567] 页/)).toBeVisible();
  });

  test("F4-7 点「从第 1 话重读」进入第 1 话，且不改动已有记录", async ({ page }) => {
    await seedProgress(page, { xinghai: progressRecord(3, 6) });
    await page.goto("/comics/xinghai");

    await page.getByRole("link", { name: "从第 1 话重读" }).click();
    await expect(page).toHaveURL(/\/comics\/xinghai\/1$/);

    const stored = (await readProgressMap(page)).xinghai;
    expect(stored?.chapter).toBe(3);
    expect(stored?.page).toBe(6);

    await page.goBack();
    await expect(page.getByRole("link", { name: "继续阅读：第 3 话 第 6 页" })).toBeVisible();
  });

  test("F4-8 点「清除本机阅读记录」→ 记录消失、主按钮回到「开始阅读」，再进从第 1 页开始", async ({
    page,
  }) => {
    await seedProgress(page, { xinghai: progressRecord(3, 6) });
    await page.goto("/comics/xinghai");

    await expect(page.getByText("本机阅读记录", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "清除本机阅读记录" }).click();

    await expect(page.getByText("本机阅读记录", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "开始阅读" })).toBeVisible();
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), PROGRESS_KEY);
    expect(raw === null || !raw.includes("xinghai")).toBeTruthy();

    await page.getByRole("link", { name: "开始阅读" }).click();
    await expect(page).toHaveURL(/\/comics\/xinghai\/1$/);
    await expect(page.getByText(/当前阅读位置/)).toHaveCount(0);
  });

  test("F4-9 详情页可见站点名「漫画站」，并有回首页入口", async ({ page }) => {
    await page.goto("/comics/slow-cooking");

    const back = page.getByRole("link", { name: /漫画站/ });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/");
  });
});
