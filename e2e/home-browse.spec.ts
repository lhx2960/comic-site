/* =============================================================================
 * F1 首页浏览 / F2 列表与标签筛选
 *
 * 需求依据：docs/specs/prd.md v1.1 的 F1-1 ～ F1-6、F2-1 ～ F2-9
 * 行为契约：docs/contracts/routes.md（URL 即状态：?q=&tag=，未知参数按「无此条件」）
 * ========================================================================== */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  COMICS,
  TAGS,
  cardLinks,
  searchInput,
  submitSearch,
  tagChips,
} from "./fixtures";

/** 卡片链接的 href → slug，顺序即页面展示顺序（F2-1 的排序断言） */
async function visibleSlugs(page: Page): Promise<string[]> {
  const hrefs = await cardLinks(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("href") ?? ""),
  );
  return hrefs.map((href) => href.replace("/comics/", ""));
}

async function visibleCardsText(page: Page): Promise<string[]> {
  return await cardLinks(page).allInnerTexts();
}

/**
 * 断言当前展示的漫画集合（按顺序）。
 * 必须用 expect.poll：点标签/提交搜索走的是客户端软导航，click() 返回时 URL 可能
 * 已经变了，但新结果还在流式渲染 —— 一次性读 DOM 会读到上一版列表。
 */
async function expectVisibleSlugs(page: Page, expected: string[]): Promise<void> {
  await expect.poll(async () => await visibleSlugs(page)).toEqual(expected);
}

test.describe("F1 首页浏览", () => {
  test("F1-1 第一屏有 3 张卡片，每张都有封面/标题/作者/标签，且不显示阅读进度标记 @webkit", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(cardLinks(page)).toHaveCount(COMICS.length);

    for (const comic of COMICS) {
      const card = cardLinks(page).filter({ hasText: comic.title });
      await expect(card, `${comic.title} 卡片存在`).toHaveCount(1);
      await expect(card).toContainText(comic.author);

      // 封面：有 alt 且指向该漫画的占位图（F1-1 的「封面图」+ G6 的文字替代）
      const cover = card.locator("img");
      await expect(cover).toHaveAttribute("alt", new RegExp(comic.title));

      // 至少 1 个标签
      const cardText = await card.innerText();
      expect(
        comic.tags.some((tag) => cardText.includes(tag)),
        `${comic.title} 至少展示 1 个标签`,
      ).toBeTruthy();
    }

    // Q14：卡片上不出现阅读进度标记
    await expect(page.getByText("读到此")).toHaveCount(0);
    for (const card of await cardLinks(page).all()) {
      await expect(card).not.toContainText("继续阅读");
      await expect(card).not.toContainText("已读完");
    }
  });

  test("F1-2 点卡片进入详情页，详情页标题与作者和卡片一致 @webkit", async ({ page }) => {
    await page.goto("/");

    const card = cardLinks(page).filter({ hasText: "星海拾遗" });
    const authorLine = (await card.innerText()).split("\n").find((line) => line.includes("作者"));
    await card.click();

    await expect(page).toHaveURL(/\/comics\/xinghai$/);
    await expect(page.getByRole("heading", { level: 1, name: "星海拾遗" })).toBeVisible();
    expect(authorLine).toContain("林岸");
    await expect(page.getByText("作者：林岸")).toBeVisible();
  });

  test("F1-3 首页有搜索输入框，可输入并提交", async ({ page }) => {
    await page.goto("/");

    const input = searchInput(page);
    await expect(input).toBeVisible();
    await expect(input).toBeEditable();

    await expect(input).toBeEditable();
    await submitSearch(page, "星海");

    await expect(page).toHaveURL(/\/\?q=%E6%98%9F%E6%B5%B7$/);
    await expectVisibleSlugs(page, ["xinghai"]);
  });

  test("F1-4 标签区 = 示例数据里全部去重标签，每个至少命中 1 部", async ({ page }) => {
    await page.goto("/");

    await expect(tagChips(page)).toHaveCount(TAGS.length);
    for (const tag of TAGS) {
      const chip = tagChips(page).filter({ hasText: tag.name });
      await expect(chip, `标签 ${tag.name} 存在`).toHaveCount(1);
      // chip 上的计数 = 该标签命中的漫画数（F1-4「每个标签至少命中 1 部」）
      await expect(chip).toContainText(String(tag.count));
      expect(tag.count).toBeGreaterThanOrEqual(1);
    }
  });

  test("F1-5 点首页标签就地筛选（仍是首页），并显示生效条件 @webkit", async ({ page }) => {
    await page.goto("/");

    await tagChips(page).filter({ hasText: "科幻" }).click();

    await expect(page).toHaveURL(/\/\?tag=scifi$/);
    // Q1：首页即列表视图，点标签不发生路由跳转
    expect(new URL(page.url()).pathname).toBe("/");
    await expectVisibleSlugs(page, ["xinghai", "neon-midnight-express"]);
    await expect(page.getByText("已选条件")).toBeVisible();
    await expect(page.getByText("标签「科幻」")).toBeVisible();
    await expect(page.getByRole("link", { name: "清除筛选" })).toBeVisible();
  });

  test("F1-6 页头显示站点名，首页显示副标题", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "漫画站" })).toBeVisible();
    await expect(page.getByText("示例数据练手的漫画阅读站")).toBeVisible();
  });
});

test.describe("F2 列表与标签筛选", () => {
  test("F2-1 首页即列表：按数据顺序列出 3 部，信息齐备且无进度标记", async ({ page }) => {
    await page.goto("/");

    expect(await visibleSlugs(page)).toEqual(COMICS.map((comic) => comic.slug));
    await expect(page.getByRole("heading", { name: "全部漫画" })).toBeVisible();
    await expect(page.getByText("共 3 部")).toBeVisible();

    const texts = await visibleCardsText(page);
    for (const comic of COMICS) {
      const text = texts.find((item) => item.includes(comic.title)) ?? "";
      expect(text, `${comic.title} 卡片内容`).toContain(comic.author);
      expect(comic.tags.some((tag) => text.includes(tag))).toBeTruthy();
    }
    await expect(page.getByText("读到此")).toHaveCount(0);
  });

  test("F2-2 点列表里的卡片进入该漫画详情页", async ({ page }) => {
    await page.goto("/");

    await cardLinks(page).filter({ hasText: "慢煮时光" }).click();

    await expect(page).toHaveURL(/\/comics\/slow-cooking$/);
    await expect(page.getByRole("heading", { level: 1, name: "慢煮时光" })).toBeVisible();
  });

  test("F2-3 点选标签：只剩命中的漫画 + 显示生效条件与清除入口 @webkit", async ({ page }) => {
    await page.goto("/");

    await tagChips(page).filter({ hasText: "科幻" }).click();

    await expectVisibleSlugs(page, ["xinghai", "neon-midnight-express"]);
    await expect(page.getByRole("heading", { name: "筛选结果" })).toBeVisible();
    await expect(page.getByText("共 2 部")).toBeVisible();
    await expect(page.getByText("已选条件")).toBeVisible();
    await expect(page.getByText("标签「科幻」")).toBeVisible();
    await expect(page.getByRole("link", { name: "清除筛选" })).toBeVisible();
  });

  test("F2-4 点清除筛选恢复全部 3 部，条件标识消失", async ({ page }) => {
    await page.goto("/?tag=scifi");

    await page.getByRole("link", { name: "清除筛选" }).first().click();

    await expect(page).toHaveURL(/\/$/);
    await expectVisibleSlugs(page, COMICS.map((comic) => comic.slug));
    await expect(page.getByText("已选条件")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "全部漫画" })).toBeVisible();
  });

  test("F2-5 选中标签后刷新，筛选状态与结果保持一致", async ({ page }) => {
    await page.goto("/?tag=mystery");
    await expectVisibleSlugs(page, ["neon-midnight-express"]);

    await page.reload();

    await expectVisibleSlugs(page, ["neon-midnight-express"]);
    await expect(page.getByText("标签「悬疑」")).toBeVisible();
    await expect(tagChips(page).filter({ hasText: "悬疑" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("F2-6 把地址在另一个窗口打开，结果与筛选状态一致", async ({ page, context }) => {
    await page.goto("/?tag=scifi&q=K");
    const shared = page.url();
    await expectVisibleSlugs(page, ["neon-midnight-express"]);

    const otherWindow = await context.newPage();
    await otherWindow.goto(shared);

    await expectVisibleSlugs(otherWindow, ["neon-midnight-express"]);
    await expect(otherWindow.getByText("标签「科幻」")).toBeVisible();
    await expect(otherWindow.getByText("关键词「K」")).toBeVisible();
    await otherWindow.close();
  });

  test("F2-7 关键词 + 标签同时生效（取交集）", async ({ page }) => {
    await page.goto("/?tag=scifi");
    await expectVisibleSlugs(page, ["xinghai", "neon-midnight-express"]);

    await submitSearch(page, "K");

    await expect(page).toHaveURL(/q=K/);
    await expect(page).toHaveURL(/tag=scifi/);
    await expectVisibleSlugs(page, ["neon-midnight-express"]);
    await expect(page.getByText("关键词「K」")).toBeVisible();
    await expect(page.getByText("标签「科幻」")).toBeVisible();
  });

  test("F2-8 再次点击已选中的标签 = 取消筛选", async ({ page }) => {
    await page.goto("/");

    await tagChips(page).filter({ hasText: "日常" }).click();
    await expectVisibleSlugs(page, ["slow-cooking"]);

    await tagChips(page).filter({ hasText: "日常" }).click();

    await expectVisibleSlugs(page, COMICS.map((comic) => comic.slug));
    await expect(page.getByText("已选条件")).toHaveCount(0);
  });

  test("F2-9 关键词与标签交集为空 → 空状态提示（保留条件与出路）", async ({ page }) => {
    await page.goto("/?q=zzzz&tag=scifi");

    await expect(cardLinks(page)).toHaveCount(0);
    await expect(page.getByText("没有找到匹配的漫画")).toBeVisible();
    // G2：0 条结果必须给出下一步动作
    await expect(page.getByRole("link", { name: "清除关键词" })).toBeVisible();
    // 详情：条件摘要里「清除筛选」与空状态里的「清除筛选」是两个元素，取第一个
    await expect(page.getByRole("link", { name: "清除筛选" }).first()).toBeVisible();
    // 用户要能看出是哪个条件导致的 0 条
    await expect(page.getByText("关键词「zzzz」")).toBeVisible();
    await expect(page.getByText("标签「科幻」")).toBeVisible();
    await expect(searchInput(page)).toHaveValue("zzzz");
  });
});
