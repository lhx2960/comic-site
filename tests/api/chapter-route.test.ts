/* =============================================================================
 * Route Handler 单测：GET /api/comics/[slug]/chapters/[chapter]
 *
 * 断言对象是 docs/contracts/routes.md 的状态码与响应体约定：
 *   正常 200 + ChapterDetail；话号非法或不存在 404 {error:"not_found"}；
 *   未预期异常 500 {error:"internal_error"}。
 * 直接调用导出的 GET（传一个 Promise 的 params，与 Next.js 15 的调用方式一致），
 * 不需要起 HTTP 服务。
 * ========================================================================== */

import { afterEach, describe, expect, it, vi } from "vitest";

const accessLayer = vi.hoisted(() => ({ shouldThrow: false }));

// 只为制造「未预期异常 → 500」这条分支，其余情况走真实访问层
vi.mock("@/lib/data/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/queries")>();
  return {
    ...actual,
    getChapter: (slug: string, chapter: number) => {
      if (accessLayer.shouldThrow) {
        throw new Error("模拟数据层异常");
      }
      return actual.getChapter(slug, chapter);
    },
  };
});

import { GET } from "@/app/api/comics/[slug]/chapters/[chapter]/route";

const callRoute = (slug: string, chapter: string) =>
  GET(new Request(`http://localhost/api/comics/${slug}/chapters/${chapter}`), {
    params: Promise.resolve({ slug, chapter }),
  });

afterEach(() => {
  accessLayer.shouldThrow = false;
});

describe("GET /api/comics/[slug]/chapters/[chapter]", () => {
  it("正常返回 200 与 ChapterDetail（页清单 + 前后话序号）", async () => {
    const response = await callRoute("xinghai", "3");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      comic: { slug: "xinghai", title: "星海拾遗" },
      number: 3,
      prev: 2,
      next: 4,
    });
    expect(body.pages).toHaveLength(10);
    expect(body.pages[0]).toMatchObject({ src: "/comics/xinghai/3/001.svg", width: 600, height: 800 });
  });

  it("最后一话的 next 为 null（阅读页据此显示收尾）", async () => {
    const body = await (await callRoute("xinghai", "5")).json();
    expect(body.next).toBeNull();
  });

  it.each(["0", "01", "abc", "-1", "1.5"])(
    "话号格式不合法（%s）→ 404 not_found",
    async (chapter) => {
      const response = await callRoute("xinghai", chapter);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "not_found" });
    },
  );

  it("数据里没有这一话 → 404 not_found", async () => {
    const response = await callRoute("xinghai", "99");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("漫画不存在 → 404 not_found", async () => {
    const response = await callRoute("no-such-comic", "1");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("数据层抛异常 → 500 internal_error，且不回堆栈", async () => {
    accessLayer.shouldThrow = true;

    const response = await callRoute("xinghai", "1");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "internal_error" });
  });
});
