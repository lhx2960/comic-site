/* =============================================================================
 * 全局要求 G1 ～ G10（跨页面）
 *
 * G1 内容规模 / G2 空状态 / G3 内容不存在 / G4 加载失败与重试 / G5 视口适配 /
 * G6 键盘可达 / G7 导航与站点标识 / G8 数据一致性 / G9 文案语言 / G10 视觉基调
 *
 * 需求依据：docs/specs/prd.md v1.1；视觉依据：docs/specs/ui.md v1.0
 * ========================================================================== */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  COMICS,
  PAGES_PER_CHAPTER,
  cardLinks,
  chapterRows,
  horizontalOverflow,
  interactiveBoxes,
  pageBlocks,
  scrollToPageBlock,
} from "./fixtures";

async function computedBackground(page: Page, selector: string): Promise<string> {
  return await page
    .locator(selector)
    .first()
    .evaluate((element) => window.getComputedStyle(element).backgroundColor);
}

test.describe("G1 内容规模", () => {
  test("G1 3 部漫画 × 每部 5 话 × 每话 10 页 @webkit", async ({ page }) => {
    await page.goto("/");
    await expect(cardLinks(page)).toHaveCount(3);

    for (const comic of COMICS) {
      await page.goto(`/comics/${comic.slug}`);
      await expect(chapterRows(page)).toHaveCount(5);
      await page.goto(`/comics/${comic.slug}/1`);
      await expect(pageBlocks(page)).toHaveCount(PAGES_PER_CHAPTER);
    }
  });

  test("G1 Route Handler 契约：正常 200 / 非法或不存在的 chapter → 404", async ({ request }) => {
    const ok = await request.get("/api/comics/xinghai/chapters/2");
    expect(ok.status()).toBe(200);
    const body = (await ok.json()) as {
      number: number;
      pages: unknown[];
      prev: number | null;
      next: number | null;
    };
    expect(body.number).toBe(2);
    expect(body.pages).toHaveLength(PAGES_PER_CHAPTER);
    expect(body.prev).toBe(1);
    expect(body.next).toBe(3);

    const last = await request.get("/api/comics/xinghai/chapters/5");
    expect(((await last.json()) as { next: number | null }).next).toBeNull();

    for (const bad of ["9", "01", "abc"]) {
      const response = await request.get(`/api/comics/xinghai/chapters/${bad}`);
      expect(response.status(), `chapter=${bad}`).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
    }
  });
});

test.describe("G3 内容不存在", () => {
  test("G3 未定义路由 → 全局 404 文案 + 返回首页（按 D-017 只断言 UI）", async ({ page }) => {
    await page.goto("/whatever");

    await expect(page.getByRole("heading", { name: "内容不存在" })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回首页" })).toBeVisible();
    await expect(page.getByText(/Error|Unhandled|at \w+\./)).toHaveCount(0);
  });

  test("G3 内容不存在的页面都有下一级出路（漫画 / 话）", async ({ page }) => {
    await page.goto("/comics/nope");
    await expect(page.getByRole("heading", { name: "这部漫画不存在" })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回首页" })).toBeVisible();

    await page.goto("/comics/xinghai/9");
    await expect(page.getByRole("heading", { name: "这一话不存在" })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回详情" })).toBeVisible();
  });
});

test.describe("G4 加载失败与重试", () => {
  test("G4 单张图片失败只影响该页，其余页仍可读，且可就地重试 @webkit", async ({ page }) => {
    const pageSixImage = /\/comics\/xinghai\/3\/006\.svg/;
    let failPageSix = true;
    await page.route(pageSixImage, async (route) => {
      if (failPageSix) {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page.goto("/comics/xinghai/3");
    await scrollToPageBlock(page, 5);

    // 失败页就地降级，给出「重试这一页」
    await expect(page.getByText("第 3 话 · 第 6 页加载失败")).toBeVisible();
    await expect(page.getByRole("button", { name: "重试这一页" })).toBeVisible();

    // 该页其余内容与后续页仍可读
    await scrollToPageBlock(page, 0);
    await expect(page.locator('img[alt="第 3 话 第 1 页"]')).toBeVisible();
    await scrollToPageBlock(page, 9);
    await expect(page.locator('img[alt="第 3 话 第 10 页"]')).toBeVisible();

    // 恢复后点重试 → 内容成功加载
    failPageSix = false;
    await scrollToPageBlock(page, 5);
    await page.getByRole("button", { name: "重试这一页" }).click();
    await expect(page.locator('img[alt="第 3 话 第 6 页"]')).toBeVisible();
  });

  /**
   * G4 的「整页加载失败 → 错误态 + 重试」在浏览器层无法被可控地制造：
   * 数据来自仓库里的文件，没有可断网的外部依赖；而拦截客户端软导航的 RSC 响应后，
   * Next 会退回整页导航（MPA fallback），用户仍然到达目标页 —— 错误边界（error.tsx）
   * 反而不会被触发。这条用例因此断言「确实发生了回退、页面仍然可达」，
   * error.tsx 的渲染与重试行为由单测 tests/components/error-and-not-found.test.tsx 覆盖，
   * 人工步骤见 docs/reports/T-009-验证.md 的「未自动化条目」。
   */
  test("G4 客户端软导航失败时回退为整页导航，用户仍能到达目标页", async ({ page }) => {
    await page.goto("/");

    await page.route(/\/comics\/slow-cooking(\?|$)/, async (route) => {
      const request = route.request();
      const isRscNavigation =
        request.headers()["rsc"] === "1" || Boolean(request.headers()["next-router-state-tree"]);
      if (isRscNavigation) {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await cardLinks(page).filter({ hasText: "慢煮时光" }).click();

    await expect(page).toHaveURL(/\/comics\/slow-cooking$/);
    await expect(page.getByRole("heading", { level: 1, name: "慢煮时光" })).toBeVisible();
    await expect(page.getByText(/Error|Unhandled|at \w+\./)).toHaveCount(0);
  });
});

test.describe("G5 视口适配与可点区域", () => {
  const pages = ["/", "/comics/xinghai", "/comics/xinghai/3"] as const;

  test("G5a 360×640：三个页面均无横向滚动条 @webkit", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    for (const path of pages) {
      await page.goto(path);
      expect(await horizontalOverflow(page), `${path} 无横向溢出`).toBeLessThanOrEqual(1);
    }
  });

  test("G5b 1280×800：三个页面均无横向滚动条", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const path of pages) {
      await page.goto(path);
      expect(await horizontalOverflow(page), `${path} 无横向溢出`).toBeLessThanOrEqual(1);
    }
  });

  test("G5c 360×640：可点区域全部 ≥44×44 @webkit", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    for (const path of pages) {
      await page.goto(path);
      const boxes = await interactiveBoxes(page);
      const tooSmall = boxes.filter((box) => box.width < 44 || box.height < 44);
      expect(tooSmall, `${path} 的可点元素不得小于 44×44`).toEqual([]);
    }
  });

  test("G5d 1280×800：可点区域全部 ≥44×44", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const path of pages) {
      await page.goto(path);
      const boxes = await interactiveBoxes(page);
      const tooSmall = boxes.filter((box) => box.width < 44 || box.height < 44);
      expect(tooSmall, `${path} 的可点元素不得小于 44×44`).toEqual([]);
    }
  });
});

test.describe("G6 键盘可达性", () => {
  /** 从当前位置继续 Tab，直到聚焦元素的 href/标签满足条件；返回命中时的描述 */
  async function tabUntil(
    page: Page,
    matches: (info: { tag: string; href: string; label: string }) => boolean,
    maxTabs = 20,
  ): Promise<{ tag: string; href: string; label: string } | null> {
    for (let index = 0; index < maxTabs; index += 1) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        return {
          tag: element?.tagName.toLowerCase() ?? "none",
          href: element?.getAttribute("href") ?? "",
          label: (element?.getAttribute("aria-label") ?? element?.textContent ?? "").trim(),
        };
      });
      if (matches(info)) {
        return info;
      }
    }
    return null;
  }

  // 只在 Chromium 跑：Safari/WebKit 默认「按下 Tab 键高亮网页上的每个项目」是关闭的，
  // Tab 只走表单控件、会跳过链接 —— 这是浏览器偏好，不是站点缺陷（站点用的是原生
  // <a href>，符合 ui.md §7.4）。WebKit 侧的可聚焦性由下面那条通用用例覆盖。
  test("G6 首页 Tab 顺序：站点名 → 搜索框 → 搜索按钮 → 标签 → 卡片", async ({ page }) => {
    await page.goto("/");

    const siteName = await tabUntil(page, (info) => info.tag === "a" && info.label === "漫画站");
    expect(siteName, "第一个 Tab 应到站点名").not.toBeNull();

    const input = await tabUntil(page, (info) => info.tag === "input");
    expect(input).not.toBeNull();

    const searchButton = await tabUntil(
      page,
      (info) => info.tag === "button" && info.label === "搜索",
    );
    expect(searchButton).not.toBeNull();

    const tag = await tabUntil(page, (info) => info.href.startsWith("/?tag="));
    expect(tag, "标签 chip 可达").not.toBeNull();
    expect(tag?.label).toContain("科幻");

    const card = await tabUntil(page, (info) => info.href.startsWith("/comics/"));
    expect(card, "卡片可达").not.toBeNull();
  });

  test("G6 可点元素都是原生 <a>/<button>，可聚焦且 Enter 可激活 @webkit", async ({ page }) => {
    await page.goto("/");

    const nonNative = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[role=button], [role=link]")).length,
    );
    expect(nonNative, "不应把 div 当按钮/链接用").toBe(0);

    const card = cardLinks(page).first();
    await card.focus();
    const focusedIsCard = await page.evaluate(() => {
      const element = document.activeElement;
      return element instanceof HTMLAnchorElement && element.getAttribute("href")?.startsWith("/comics/");
    });
    expect(focusedIsCard, "卡片链接可获得焦点").toBe(true);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/comics\//);

    const chapterLink = chapterRows(page).first();
    await chapterLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/comics\/[^/]+\/1$/);
  });

  test("G6 只用键盘可进入标签筛选与详情页", async ({ page }) => {
    await page.goto("/");

    const tag = await tabUntil(page, (info) => info.href.startsWith("/?tag="));
    expect(tag).not.toBeNull();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/tag=/);

    await page.goto("/");
    const card = await tabUntil(page, (info) => info.href.startsWith("/comics/"));
    expect(card).not.toBeNull();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/comics\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("G6 页面图片都有文字替代说明", async ({ page }) => {
    const paths = ["/", "/comics/xinghai", "/comics/xinghai/3"] as const;
    for (const path of paths) {
      await page.goto(path);
      const missingAlt = await page.evaluate(() =>
        Array.from(document.querySelectorAll("img")).filter(
          (image) => (image.getAttribute("alt") ?? "").trim() === "",
        ).length,
      );
      expect(missingAlt, `${path} 的图片 alt 不得为空`).toBe(0);
    }
  });
});

test.describe("G7 导航与站点标识", () => {
  test("G7 首页与详情页页头可见站点名；详情页可回首页", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "漫画站" })).toBeVisible();

    await page.goto("/comics/xinghai");
    const back = page.getByRole("link", { name: /漫画站/ });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/");
  });

  // 备注（报告里作为待裁决项）：PRD G7 第一句「站点名在页头可见」在阅读页未落实 ——
  // ui.md §5.4 把阅读页顶栏定为「‹ 返回详情 + 漫画名 + 详情」，既没有站点名，
  // 也没有直达首页的入口。这里如实断言现状，由架构师裁决是改文案（PRD）还是改实现。
  test("G7 阅读页有返回详情入口（回首页需经详情页两跳）", async ({ page }) => {
    await page.goto("/comics/xinghai/3");
    const backToDetail = page.getByRole("link", { name: "返回详情" });
    await expect(backToDetail).toHaveAttribute("href", "/comics/xinghai");

    await backToDetail.click();
    await expect(page).toHaveURL(/\/comics\/xinghai$/);
    await page.getByRole("link", { name: /漫画站/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("G8 数据一致性", () => {
  test("G8 同一部漫画在首页/搜索/详情页的标题、作者、标签一致", async ({ page }) => {
    await page.goto("/");
    const homeCard = await cardLinks(page).filter({ hasText: "星海拾遗" }).innerText();
    expect(homeCard).toContain("林岸");
    expect(homeCard).toContain("科幻");
    expect(homeCard).toContain("冒险");

    await page.goto("/?q=星海拾遗");
    const searchCard = await cardLinks(page).filter({ hasText: "星海拾遗" }).innerText();
    expect(searchCard).toBe(homeCard);

    await page.goto("/comics/xinghai");
    await expect(page.getByRole("heading", { level: 1, name: "星海拾遗" })).toBeVisible();
    await expect(page.getByText("作者：林岸")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "科幻" }).first()).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "冒险" }).first()).toBeVisible();
  });
});

test.describe("G9 文案语言与出路", () => {
  test("G9 空状态与错误状态都是中文，并给出下一步动作，不出现错误堆栈", async ({ page }) => {
    await page.goto("/?q=zzzz&tag=scifi");
    const emptyState = page.locator("body");
    await expect(emptyState).toContainText("没有找到匹配的漫画");
    await expect(page.getByRole("link", { name: "清除关键词" })).toBeVisible();
    await expect(emptyState).not.toContainText("Error");
    await expect(emptyState).not.toContainText("Something went wrong");

    await page.goto("/whatever");
    await expect(emptyState).toContainText("内容不存在");
    await expect(emptyState).not.toContainText("Error");
  });
});

test.describe("G10 视觉基调", () => {
  test("G10 站点浅色底、阅读页深色底，阅读页内无浅色区块 @webkit", async ({ page }) => {
    await page.goto("/");
    expect(await computedBackground(page, "body")).toBe("rgb(255, 255, 255)");

    await page.goto("/comics/xinghai");
    expect(await computedBackground(page, "body")).toBe("rgb(255, 255, 255)");

    await page.goto("/comics/xinghai/3");
    expect(await computedBackground(page, '[data-theme="reader"]')).toBe("rgb(11, 13, 16)");

    const lightBlocks = await page.evaluate(() => {
      const reader = document.querySelector('[data-theme="reader"]');
      if (!reader) {
        return ["缺少阅读页深色容器"];
      }
      const toRgb = (value: string): number[] => {
        const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
        return numbers;
      };
      return Array.from(reader.querySelectorAll<HTMLElement>("*"))
        .filter((node) => {
          const [r = 0, g = 0, b = 0, a = 1] = toRgb(
            window.getComputedStyle(node).backgroundColor,
          );
          if (a === 0) {
            return false;
          }
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          // 只拦「接近纯白」的底色（浅色站点域的 #FFFFFF/#F5F6F8 一类）。
          // 不能用更低阈值：深色阅读域的主色进度条填充是 #FF9E7A（亮度约 0.69），
          // 它是阅读页的强调色，不是「浅色底区块」。
          return luminance > 0.9;
        })
        .map((node) => node.tagName.toLowerCase())
        .slice(0, 5);
    });
    expect(lightBlocks, "阅读页内不应出现浅色底区块").toEqual([]);
  });
});
