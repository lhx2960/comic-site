/* =============================================================================
 * F3 搜索（标题 + 作者）
 *
 * 需求依据：docs/specs/prd.md v1.1 的 F3-1 ～ F3-8
 * 语义依据：D-005（URL 即状态、trim、大小写不敏感、包含匹配、只比 title/author）、
 *           Q4（不匹配标签文本与简介）、Q11（示例数据至少含 1 个带字母标题）
 * ========================================================================== */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { cardLinks, searchInput, submitSearch } from "./fixtures";

async function search(page: Page, keyword: string): Promise<void> {
  await submitSearch(page, keyword);
}

async function resultSlugs(page: Page): Promise<string[]> {
  const hrefs = await cardLinks(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("href") ?? ""),
  );
  return hrefs.map((href) => href.replace("/comics/", ""));
}

/**
 * 断言搜索结果集合。必须用 expect.poll：提交关键词是客户端软导航，
 * click() 返回时新结果可能还在流式渲染，一次性读 DOM 会读到上一版列表。
 */
async function expectResults(page: Page, expected: string[]): Promise<void> {
  await expect.poll(async () => await resultSlugs(page)).toEqual(expected);
}

test.describe("F3 搜索：标题与作者", () => {
  test("F3-1 完整标题命中，且同一部漫画只出现一次 @webkit", async ({ page }) => {
    await page.goto("/");

    await search(page, "星海拾遗");

    await expect(page).toHaveURL(/q=/);
    await expectResults(page, ["xinghai"]);
    await expect(cardLinks(page)).toHaveCount(1);
  });

  test("F3-2 按作者姓名命中该作者的全部作品（数量按数据核对）", async ({ page }) => {
    await page.goto("/");

    await search(page, "陈小满");
    await expectResults(page, ["slow-cooking"]);

    await search(page, "Kai Mori");
    await expectResults(page, ["neon-midnight-express"]);

    await search(page, "林岸");
    await expectResults(page, ["xinghai"]);
  });

  test("F3-3 标题中间片段即可命中（不要求从开头匹配）", async ({ page }) => {
    await page.goto("/");

    await search(page, "拾遗");
    await expectResults(page, ["xinghai"]);

    await search(page, "夜快");
    await expectResults(page, ["neon-midnight-express"]);
  });

  test("F3-4 全大写与全小写结果一致（大小写不敏感）", async ({ page }) => {
    await page.goto("/");

    await search(page, "neon");
    await expectResults(page, ["neon-midnight-express"]);

    await search(page, "NEON");
    await expectResults(page, ["neon-midnight-express"]);

    // 作者里的字母同样不区分大小写
    await search(page, "kai mori");
    await expectResults(page, ["neon-midnight-express"]);
    await search(page, "KAI MORI");
    await expectResults(page, ["neon-midnight-express"]);
  });

  test("F3-5 无匹配关键词 → 空状态，且输入框保留关键词", async ({ page }) => {
    await page.goto("/");

    await search(page, "zzzz");

    await expect(cardLinks(page)).toHaveCount(0);
    await expect(page.getByText("没有找到匹配的漫画")).toBeVisible();
    await expect(searchInput(page)).toHaveValue("zzzz");
    // 条件摘要与空状态里各有一个「清除筛选」，取第一个
    await expect(page.getByRole("link", { name: "清除筛选" }).first()).toBeVisible();
  });

  test("F3-6 清空关键词提交 → 保留当前标签筛选", async ({ page }) => {
    await page.goto("/?tag=scifi");
    await expectResults(page, ["xinghai", "neon-midnight-express"]);

    await search(page, "");

    await expect(page).toHaveURL(/tag=scifi/);
    await expectResults(page, ["xinghai", "neon-midnight-express"]);
  });

  test("F3-7 首尾空格被忽略，结果与不带空格一致", async ({ page }) => {
    await page.goto("/");

    await search(page, "  星海  ");

    await expect(page).toHaveURL(/q=%E6%98%9F%E6%B5%B7$/);
    await expectResults(page, ["xinghai"]);
  });

  test("F3-8 只出现在标签文字里的词不匹配（结果为 0 条）", async ({ page }) => {
    await page.goto("/");

    await search(page, "科幻");

    await expect(cardLinks(page)).toHaveCount(0);
    await expect(page.getByText("没有找到匹配的漫画")).toBeVisible();
  });
});
