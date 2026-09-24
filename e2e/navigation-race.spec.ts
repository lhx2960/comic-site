/* =============================================================================
 * F-06 正式回归用例：详情页「点一次就跳」
 *
 * 背景（T-013 报告 §5.1，D-020 裁决，T-015 修复）：
 *   生产构建下，详情页首屏的 5 条话列表 `<Link>` 会并发发起
 *   `Next-Router-Prefetch` 预取请求。在这个窗口内点某个话条目，`<Link>` 的处理函数
 *   会正常执行（事件被 preventDefault），导航用的 RSC 甚至已经 200 返回、目标路由的
 *   chunk 也加载完成，**但路由不提交**：地址栏与页面都不变、没有任何报错，用户必须再点一次。
 *   实测：基线 1/20 命中；把预取请求全部 abort 后 0/20。
 *
 * 修复方式（D-020）：话列表的每个 `<Link>` 加 `prefetch={false}`，让点击总是走一次
 * 真实导航；主 CTA 只有一条链接且是最高频动作，保留默认预取。
 *
 * 本文件的两条用例分别钉住「行为」与「机制」：
 *   1) 行为：详情页刚加载完就点话条目，**一次点击**必须进入阅读页（地址与内容都换）。
 *      这里刻意不在点击前加任何等待 —— 竞态窗口正是「首屏未完全稳定」的那一瞬间，
 *      加了等待就等于把缺陷藏起来。任何形式的重复点击 / 重试都算失败。
 *   2) 机制：详情页首屏**不得发任何指向 `/comics/{slug}/{话号}` 的预取请求** —— 谁把
 *      `prefetch={false}` 改回去（或升级 Next 后行为变化），这条会立刻红。
 *      （D-021 修订了 D-020 第 2 条：T-015 对照实测证明「保留主 CTA 预取」仍会复现竞态，
 *      因此详情页上话列表、主 CTA、次要入口一律关闭预取。）
 *   3) 同机理观察：首页卡片链接仍保留默认预取（D-021 的「待观察」项），
 *      这里用同样的「只点一次」纪律盯着这条路径。
 * ========================================================================== */

import { expect, test } from "@playwright/test";

/** 覆盖三部作品、各挑一话；话与标题都按示例数据核对 */
const CASES = [
  { slug: "xinghai", chapter: 1, title: "冷启动" },
  { slug: "neon-midnight-express", chapter: 3, title: "车厢里的第三人" },
  { slug: "slow-cooking", chapter: 5, title: "加一份" },
] as const;

for (const item of CASES) {
  test(`F-06 回归：详情页首屏未稳定时点「第 ${item.chapter} 话」，一次点击即进入阅读页`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => consoleErrors.push(`pageerror:${error.message}`));

    await page.goto(`/comics/${item.slug}`);

    // 只点一次。这条用例的全部价值就在「一次点击就成立」：
    // 失败时不要补点、不要重试，让红灯照出问题（T-013 的 F-06 就是这么暴露的）。
    await page.locator(`main ul a[href="/comics/${item.slug}/${item.chapter}"]`).click();

    // 地址要变
    await expect(page).toHaveURL(new RegExp(`/comics/${item.slug}/${item.chapter}$`));
    // 页面内容也要真的换成该话（地址变了但内容没换 = 同一类缺陷）
    await expect(page.locator(`[data-section="${item.chapter}"]`)).toBeAttached();
    await expect(page.locator("[data-page-index]")).toHaveCount(10);
    await expect(page.locator("header").first()).toContainText(`第 ${item.chapter} 话`);
    await expect(page.locator("header").first()).toContainText(item.title);

    expect(consoleErrors, "跳转过程不应产生控制台错误").toEqual([]);
  });
}

test("F-06 回归（机制 / D-021）：详情页首屏不发任何指向某一话的预取请求", async ({ page }) => {
  const prefetched: string[] = [];
  page.on("request", (request) => {
    if (request.headers()["next-router-prefetch"]) {
      prefetched.push(new URL(request.url()).pathname);
    }
  });

  await page.goto("/comics/xinghai");
  // 给预取留出足够时间（首屏链接进入视口后才会触发）
  await page.waitForTimeout(1500);

  const chapterPrefetches = prefetched.filter((path) => /^\/comics\/xinghai\/\d+$/.test(path));
  expect(
    chapterPrefetches,
    "详情页所有指向某一话的链接都必须是 prefetch={false}（D-021）；出现预取说明有人改回去了",
  ).toEqual([]);
});

test("F-06 同机理观察（首页卡片仍保留预取）：一次点击即进入详情页", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror:${error.message}`));

  await page.goto("/");

  // 同样只点一次：首页卡片按 D-021 仍保留预取，若同一机理也会吞掉点击，这里就会红
  await page.locator('main ul a[href="/comics/xinghai"]').click();

  await expect(page).toHaveURL(/\/comics\/xinghai$/);
  await expect(page.getByRole("heading", { level: 1, name: "星海拾遗" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "话列表" })).toBeVisible();
  expect(consoleErrors, "跳转过程不应产生控制台错误").toEqual([]);
});
