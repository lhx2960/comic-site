/* =============================================================================
 * F5-10 ～ F5-12：懒加载 / 预取下一话 / 加载过程无布局跳动（P1 配套项）
 *
 * 这三条是「滚动体验」的硬指标，也是最容易被实现细节破坏的三条，所以单独成文件：
 *   - F5-10：进入阅读页不滚动时，远端页不得发起图片请求；
 *   - F5-11：接近底部时下一话数据已预取，图片不重复请求；
 *   - F5-12：图片从「加载中」到「已加载」，已渲染内容不产生上下位移。
 *
 * F5-12 的做法：用路由闸门把该话全部 SVG 请求挂住 → 记录 10 个页块的文档坐标 →
 * 放行闸门并逐页滚过 → 等 10 张图全部 complete 后再量一次 → 两次坐标必须完全一致。
 * ========================================================================== */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  pageBlockPositions,
  pageBlocks,
  scrollDownSteps,
  scrollToPageBlock,
  sectionBlocks,
  waitForReaderHydration,
} from "./fixtures";

/** 已加载完成的页图数量（complete 且有实际尺寸） */
async function loadedPageImages(
  page: Page,
  selector = "[data-page-index]",
): Promise<number> {
  return await page.evaluate(
    (scope: string) =>
      Array.from(document.querySelectorAll<HTMLImageElement>(`${scope} img`)).filter(
        (image) => image.complete && image.naturalWidth > 0,
      ).length,
    selector,
  );
}

test.describe("F5-10 图片懒加载", () => {
  test("F5-10 进入阅读页不滚动：远端页不发起请求，滚到附近才发起 @webkit", async ({ page }) => {
    const pageImageRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (/\/comics\/xinghai\/3\/\d{3}\.svg/.test(url)) {
        pageImageRequests.push(url);
      }
    });

    await page.goto("/comics/xinghai/3");
    await expect(page.locator('img[alt="第 3 话 第 1 页"]')).toBeVisible();
    await page.waitForTimeout(800);

    expect(
      pageImageRequests.some((url) => url.includes("/001.svg")),
      "首屏第 1 页已发起请求",
    ).toBe(true);
    expect(
      pageImageRequests.some((url) => url.includes("/010.svg")),
      "未滚动时第 10 页不应发起请求",
    ).toBe(false);

    await scrollToPageBlock(page, 9);
    await expect
      .poll(
        () => pageImageRequests.filter((url) => url.includes("/010.svg")).length,
        { message: "滚到第 10 页附近后才发起该页请求" },
      )
      .toBeGreaterThan(0);
  });
});

test.describe("F5-11 预取下一话", () => {
  test("F5-11 接近底部时预取第 4 话数据，进入第 4 话时该图不重新加载", async ({ page }) => {
    const apiRequests: string[] = [];
    const imageRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/api/comics/xinghai/chapters/")) {
        apiRequests.push(url);
      }
      if (url.includes("/comics/xinghai/4/001.svg")) {
        imageRequests.push(url);
      }
    });

    await page.goto("/comics/xinghai/3");
    await expect(pageBlocks(page)).toHaveCount(10);
    // 等水合完成（首屏页图挂载），否则「滚太快 → 观察器错过页面」会干扰判定
    await waitForReaderHydration(page);

    // 连续向下滚动到接近底部：这一步既触发下一话预取，也触发接下一话
    await scrollDownSteps(page, 28, 0.5, 120);

    await expect
      .poll(() => apiRequests.filter((url) => url.includes("/chapters/4")).length, {
        message: "接近底部时已预取下一话数据",
      })
      .toBe(1);

    await expect(page.locator('[data-section="4"]')).toBeAttached();
    await expect
      .poll(() => imageRequests.length, { message: "第 4 话第 1 页图片已发起请求" })
      .toBeGreaterThan(0);
    const requestsBefore = imageRequests.length;

    // 继续滚动进入第 4 话：图片应直接显示，不产生新的请求
    await sectionBlocks(page, 4).first().evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });
    await expect(page.locator('img[alt="第 4 话 第 1 页"]')).toBeVisible();
    expect(
      imageRequests.length,
      "进入第 4 话时第 1 页图片不重新加载",
    ).toBe(requestsBefore);
  });
});

test.describe("F5-12 加载完成无布局跳动", () => {
  test("F5-12a 360px：10 页图片加载完成前后，页块坐标不位移 @webkit", async ({ page }) => {
    await verifyNoLayoutShift(page, { width: 360, height: 640 });
  });

  test("F5-12b 1440px：10 页图片加载完成前后，页块坐标不位移", async ({ page }) => {
    await verifyNoLayoutShift(page, { width: 1440, height: 900 });
  });
});

/**
 * 闸门式验证：先把该话全部页图请求挂住，记录坐标，放行后再逐页滚过，
 * 等全部加载完成，比较两次坐标。
 */
async function verifyNoLayoutShift(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);

  // 本话 10 页的范围：把断言限定在第 3 话内部，避免「接下一话」把第 4 话追加进来
  // 干扰「本话页块坐标是否位移」的对比。
  const sectionScope = '[data-section="3"] [data-page-index]';

  // 同时掐掉下一话的数据预取：预取成功后话末区块会自动接续，本用例只关心本话。
  await page.route("**/api/comics/**", async (route) => {
    await route.abort("failed");
  });

  let releaseGate: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  await page.route("**/comics/xinghai/3/*.svg", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/comics/xinghai/3", { waitUntil: "domcontentloaded" });
  await expect(pageBlocks(page)).toHaveCount(10);
  // 先等水合：客户端组件挂载后才会用 IntersectionObserver 决定哪几页挂 img，
  // 如果在挂载前就把页面滚走，首屏两页会「错过」观察窗口（测试假阳性）。
  await waitForReaderHydration(page);

  const before = await pageBlockPositions(page, sectionScope);
  expect(before).toHaveLength(10);
  expect(
    await loadedPageImages(page, sectionScope),
    "闸门生效：此时还没有图片加载完成",
  ).toBe(0);

  releaseGate();

  // 按真实阅读节奏逐页往下走，让每一页都进入过观察窗口（图片尺寸由 aspect-ratio
  // 容器预留，因此位置不应变化）。
  // 注意只在本话内部滚动：一直往下滚会触发「接下一话」把第 4 话追加进来，
  // 那就不是「本话 10 页」的对比了。
  for (let index = 0; index < 10; index += 1) {
    await scrollToPageBlock(page, index);
    await page.waitForTimeout(150);
  }
  await expect
    .poll(() => loadedPageImages(page, sectionScope), { message: "10 页图片全部加载完成" })
    .toBe(10);

  const after = await pageBlockPositions(page, sectionScope);
  expect(after, "已渲染内容的文档坐标在图片加载前后必须一致").toEqual(before);
}
