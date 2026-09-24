// @vitest-environment jsdom
/* =============================================================================
 * 逐路由 404 的文案与出路（PRD F4-5、F5-9）
 *
 * 「这部漫画不存在」在 comics/[slug]、「这一话不存在」在 comics/[slug]/[chapter]，
 * 两者都要给出下一步动作。阅读页的那一个用 useParams 读 slug，因此这里给桩件。
 * ========================================================================== */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ChapterNotFound from "@/app/comics/[slug]/[chapter]/not-found";
import ComicNotFound from "@/app/comics/[slug]/not-found";

afterEach(cleanup);

describe("comics/[slug]/not-found.tsx", () => {
  it("显示「这部漫画不存在」并给出「去漫画库」与「返回首页」两个入口", () => {
    render(<ComicNotFound />);

    expect(screen.getByRole("heading", { name: "这部漫画不存在" })).toBeInTheDocument();
    expect(screen.getByText(/链接可能被改过/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去漫画库" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
  });
});

describe("comics/[slug]/[chapter]/not-found.tsx", () => {
  it("显示「这一话不存在」，并带上返回详情与返回首页两个出口", () => {
    const { container } = render(<ChapterNotFound slug="xinghai" />);

    expect(screen.getByRole("heading", { name: "这一话不存在" })).toBeInTheDocument();
    expect(screen.getByText(/地址里的话序号可能被改过/)).toBeInTheDocument();
    // 与 slug 级文案的区别：这里不能说「这部漫画不存在」（漫画其实是存在的，T-012）
    expect(screen.queryByText(/这部漫画不存在/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回详情" })).toHaveAttribute(
      "href",
      "/comics/xinghai",
    );
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
    // G10：这个状态出现在阅读页路由上，必须走深色阅读域（data-theme="reader"）
    expect(container.querySelector('[data-theme="reader"]')).not.toBeNull();
    expect(container.querySelector('[data-theme="reader"]')?.className).toContain("bg-base");
  });

  it("读不到 slug 时退回「返回首页」", () => {
    render(<ChapterNotFound />);

    expect(screen.queryByRole("link", { name: "返回详情" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回首页" })).toBeInTheDocument();
  });
});
