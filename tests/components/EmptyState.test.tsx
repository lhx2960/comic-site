// @vitest-environment jsdom
/* =============================================================================
 * EmptyState 测试：每个空状态都必须给出下一步动作（PRD G2、ui.md §6）
 * ========================================================================== */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "@/components/EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("展示标题、说明与两个出路（F2-9）", () => {
    render(
      <EmptyState
        title="没有找到匹配的漫画"
        description="试试换个关键词，或点掉「科幻」标签看看全部作品。"
        actions={[
          { label: "清除关键词", href: "/?tag=scifi" },
          { label: "清除筛选", href: "/" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "没有找到匹配的漫画" })).toBeInTheDocument();
    expect(screen.getByText(/点掉「科幻」标签/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "清除关键词" })).toHaveAttribute(
      "href",
      "/?tag=scifi",
    );
    expect(screen.getByRole("link", { name: "清除筛选" })).toHaveAttribute("href", "/");
  });

  it("只有一个出路时也能渲染（首页无数据场景）", () => {
    render(
      <EmptyState
        title="还没有可看的漫画"
        description="示例数据还没准备好，稍后回来看看。"
        actions={[{ label: "刷新页面", href: "/" }]}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "刷新页面" })).toBeInTheDocument();
  });

  it("装饰块不进无障碍树，按钮满足 44px 触控底线", () => {
    const { container } = render(
      <EmptyState title="空" description="说明" actions={[{ label: "清除筛选", href: "/" }]} />,
    );

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: "清除筛选" }).className).toContain("min-h-11");
  });
});
