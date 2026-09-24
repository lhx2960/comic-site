/* =============================================================================
 * E2E 公共夹具与常量
 *
 * 这里的常量全部来自「示例数据 + 已冻结契约」，不引用 src/ 的实现细节：
 *   - 漫画/标签取自 data/comics.ts（G1 的 3 部 × 5 话 × 10 页）；
 *   - 进度键名取自 docs/contracts/storage.md；
 *   - 选择器只用「契约里承诺的语义」（角色、链接路径、data-* 属性），
 *     不依赖 Tailwind 类名——实现重构样式不应该让验收用例失效。
 * ========================================================================== */

import type { Page } from "@playwright/test";

/** 契约 storage.md：进度键名 */
export const PROGRESS_KEY = "comicsite:progress:v1";

/** G1：内容规模 */
export const PAGES_PER_CHAPTER = 10;
export const CHAPTERS_PER_COMIC = 5;

export interface ProgressRecord {
  chapter: number;
  page: number;
  finished: boolean;
  updatedAt: string;
}

export type ProgressMap = Record<string, ProgressRecord>;

/** 示例数据的期望值（F1-1、F1-4、F2-3、F3-2 等用例的「按数据核对」） */
export const COMICS = [
  {
    slug: "xinghai",
    title: "星海拾遗",
    author: "林岸",
    tags: ["科幻", "冒险"],
    order: 1,
  },
  {
    slug: "neon-midnight-express",
    title: "NEON 午夜快车",
    author: "Kai Mori",
    tags: ["科幻", "悬疑"],
    order: 2,
  },
  {
    slug: "slow-cooking",
    title: "慢煮时光",
    author: "陈小满",
    tags: ["日常", "恋爱"],
    order: 3,
  },
] as const;

/** 标签条：顺序 = data/comics.ts 的数组顺序（ui.md §5.1 的展示顺序） */
export const TAGS = [
  { slug: "scifi", name: "科幻", count: 2 },
  { slug: "mystery", name: "悬疑", count: 1 },
  { slug: "adventure", name: "冒险", count: 1 },
  { slug: "slice-of-life", name: "日常", count: 1 },
  { slug: "romance", name: "恋爱", count: 1 },
] as const;

export function progressRecord(
  chapter: number,
  page: number,
  finished = false,
): ProgressRecord {
  return { chapter, page, finished, updatedAt: new Date().toISOString() };
}

/**
 * 在页面脚本执行前写入进度：用于「本机已有进度」类前置条件
 * （F4-6、F4-7、F4-8、F6-2、F6-3 的「已有记录」场景）。
 */
export async function seedProgress(page: Page, map: ProgressMap): Promise<void> {
  await page.addInitScript(
    (payload: { key: string; value: string }) => {
      window.localStorage.setItem(payload.key, payload.value);
    },
    { key: PROGRESS_KEY, value: JSON.stringify(map) },
  );
}

/** 读回整张进度表；没有键时返回空对象 */
export async function readProgressMap(page: Page): Promise<ProgressMap> {
  const raw = await page.evaluate(
    (key: string) => window.localStorage.getItem(key),
    PROGRESS_KEY,
  );
  return raw ? (JSON.parse(raw) as ProgressMap) : {};
}

export async function clearProgressStorage(page: Page): Promise<void> {
  await page.evaluate((key: string) => {
    window.localStorage.removeItem(key);
  }, PROGRESS_KEY);
}

/** 首页卡片 / 详情页话列表条目：都是 <ul> 里的站内链接（ui.md §7.4 原生 <a>） */
export function cardLinks(page: Page) {
  return page.locator('main ul a[href^="/comics/"]');
}

export function chapterRows(page: Page) {
  return page.locator('main ul a[href^="/comics/"]');
}

export function tagChips(page: Page) {
  return page.locator('nav[aria-label="按标签浏览"] a');
}

export function searchInput(page: Page) {
  return page.getByPlaceholder("搜索漫画名或作者");
}

export function pageBlocks(page: Page) {
  return page.locator("[data-page-index]");
}

export function sectionBlocks(page: Page, chapter: number) {
  return page.locator(`[data-section="${chapter}"] [data-page-index]`);
}

/** 阅读页顶栏的「第 x 话 · 标题」一行 */
export function readerHeader(page: Page) {
  return page.locator("header").first();
}

/**
 * 把某个页块滚到视口顶部（block: "start"）。
 * 口径同 storage.md：视口顶部第一张可见页即当前页，所以滚到第 N 页后
 * 记录的当前页应当是 N（允许 ±1 页误差，见 F6-2）。
 */
export async function scrollToPageBlock(page: Page, index: number): Promise<void> {
  await page.locator(`[data-page-index="${index}"]`).evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
}

/**
 * 逐步向下滚动（每次半屏），模拟真实阅读时的连续滚动。
 *
 * 为什么不用「直接滚到文档底部」：实测发现接下一话的判定只在 scroll 事件里跑，
 * 而「一步跳到底」之后再没有位移、也就没有新的 scroll 事件，第 4 话不会接上。
 * 这属于被测实现的已知缺陷（见 T-009 验证报告的 F-01），主路径用例仍按用户
 * 真实的下滑行为来跑；缺陷单独有一条用例钉住。
 */
export async function scrollDownSteps(
  page: Page,
  steps: number,
  fraction = 0.5,
  waitMs = 120,
): Promise<void> {
  for (let step = 0; step < steps; step += 1) {
    await page.evaluate((ratio: number) => {
      window.scrollBy(0, Math.round(window.innerHeight * ratio));
    }, fraction);
    await page.waitForTimeout(waitMs);
  }
}

/**
 * 逐步向下滚动，直到目标话的区块被追加进同一条滚动流（F5-4）。
 */
export async function scrollUntilSection(
  page: Page,
  chapter: number,
  maxSteps = 80,
): Promise<void> {
  const section = page.locator(`[data-section="${chapter}"]`);
  for (let step = 0; step < maxSteps; step += 1) {
    if ((await section.count()) > 0) {
      return;
    }
    await scrollDownSteps(page, 1);
  }
}

/**
 * 等客户端组件水合完成。
 *
 * 为什么需要它：这些用例要「点/滚」的是客户端组件（SearchBox、ReaderStrip）。
 * 在 dev 模式下首屏 HTML 先到、水合约 1.4s 后才完成，若在水合前就交互，
 * 事件没人接（搜索提交不生效、滚动不写进度）——这是测试时序问题，不是产品行为。
 *
 * 判定方式：React 接管 DOM 节点后会挂上 `__reactFiber$*` / `__reactProps$*` 这类
 * 内部属性，出现即说明该节点已被水合。
 */
export async function waitForHydration(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(
    (scope: string) => {
      const node = document.querySelector(scope);
      if (!node) {
        return false;
      }
      return Object.keys(node).some(
        (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactProps$"),
      );
    },
    selector,
    { timeout: 30_000 },
  );
}

/** 首页搜索框所在客户端组件已水合 */
export async function waitForSearchHydration(page: Page): Promise<void> {
  await waitForHydration(page, 'input[name="q"]');
}

/** 首页搜索：填词并提交（F1-3、F2-7、F3-* 共用） */
export async function submitSearch(page: Page, keyword: string): Promise<void> {
  await waitForSearchHydration(page);
  await searchInput(page).fill(keyword);
  await page.getByRole("button", { name: "搜索" }).click();
}

/** 等阅读页客户端组件挂载完成：出现第一张页图即说明 ReaderStrip 已经水合 */
export async function waitForReaderHydration(page: Page): Promise<void> {
  await page.locator("[data-page-index] img").first().waitFor({ state: "attached" });
}

/** 滚到文档底部（最后一话收尾、F5-5、F6-7 用） */
export async function scrollToDocumentBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
}

/** 文档坐标下的页块位置：用于 F5-12「加载前后不位移」的对比 */
export async function pageBlockPositions(
  page: Page,
  selector = "[data-page-index]",
): Promise<{ index: number; top: number; height: number }[]> {
  return await page.evaluate((scope: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(scope)).map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        index: Number(node.dataset.pageIndex),
        top: Math.round((rect.top + window.scrollY) * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      };
    }),
    selector,
  );
}

/** 收集「页面里可见的可点元素（a / button / input）的包围盒」——G5 的 44px 硬指标 */
export async function interactiveBoxes(
  page: Page,
): Promise<{ tag: string; label: string; width: number; height: number }[]> {
  return await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden])"),
    );
    return nodes
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        // 只统计「真的能被点到」的元素：有面积、可见、未被 display:none 干掉
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
      })
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(),
          label:
            node.getAttribute("aria-label") ??
            (node.textContent ?? "").trim().slice(0, 24) ??
            "",
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        };
      });
  });
}

/** 横向滚动宽度（判定「无横向滚动条」：scrollWidth ≤ 视口宽 + 1） */
export async function horizontalOverflow(page: Page): Promise<number> {
  return await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
