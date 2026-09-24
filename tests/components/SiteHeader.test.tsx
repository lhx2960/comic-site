// @vitest-environment jsdom
/* =============================================================================
 * SiteHeader 测试（T-008b 第 3/4 条）
 *
 * 两个变体各自要满足：首页变体是「站点名 + 插槽（搜索框）」且标出当前页；
 * 详情变体是「‹ 站点名 + / + 当前作品名」并真的指向首页。
 * 所有链接都必须达到 44px 触控底线（ui.md §7.1）。
 * ========================================================================== */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/SiteHeader";

afterEach(cleanup);

describe("SiteHeader —— 首页变体", () => {
  it("显示站点名、指向首页并标注 aria-current，右侧渲染插槽内容", () => {
    render(
      <SiteHeader>
        <input aria-label="搜索漫画名或作者" />
      </SiteHeader>,
    );

    const home = screen.getByRole("link", { name: /漫画站/ });
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveAttribute("aria-current", "page");
    expect(home.className).toContain("min-h-11");
    expect(screen.getByRole("textbox", { name: "搜索漫画名或作者" })).toBeInTheDocument();
  });
});

describe("SiteHeader —— 详情变体", () => {
  it("显示「‹ 漫画站」返回入口与当前作品名，且不标注当前页", () => {
    render(<SiteHeader backHref="/" current="星海拾遗" />);

    const back = screen.getByRole("link", { name: /漫画站/ });
    expect(back).toHaveAttribute("href", "/");
    expect(back).not.toHaveAttribute("aria-current");
    expect(back.className).toContain("min-h-11");
    expect(screen.getByText("星海拾遗")).toBeInTheDocument();
  });

  it("当前作品名过长时用省略号而不是撑破顶部条（truncate）", () => {
    render(<SiteHeader backHref="/" current={"很长的作品名".repeat(8)} />);

    expect(screen.getByText(/很长的作品名/).className).toContain("truncate");
  });
});
