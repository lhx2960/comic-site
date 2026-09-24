// @vitest-environment jsdom
/* =============================================================================
 * ProgressCTA 的三种状态渲染（F4-4 / F4-6 / F4-7 / F4-8 / F6-7）
 *
 * 这些用例模拟「本机已有记录」的方式就是在渲染前直接写 localStorage ——
 * 组件挂载后的 effect 会把它读出来，正是线上的真实路径。
 * ========================================================================== */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProgressCTA } from "@/components/ProgressCTA";
import { createProgressRecord, readProgress, writeProgress } from "@/lib/progress";

const PROPS = { slug: "xinghai", chapterCount: 5, pagesPerChapter: 10 };

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe("ProgressCTA", () => {
  it("无进度：主按钮是「开始阅读」，指向第 1 话，记录卡整卡隐藏（F4-4）", () => {
    render(<ProgressCTA {...PROPS} />);

    expect(screen.getByRole("link", { name: "开始阅读" })).toHaveAttribute(
      "href",
      "/comics/xinghai/1",
    );
    expect(screen.queryByText("本机阅读记录")).not.toBeInTheDocument();
  });

  it("有进度：主按钮显示「继续阅读：第 3 话 第 6 页」并指向该话（F4-6、F6-3）", () => {
    writeProgress("xinghai", createProgressRecord(3, 6));

    render(<ProgressCTA {...PROPS} />);

    expect(
      screen.getByRole("link", { name: "继续阅读：第 3 话 第 6 页" }),
    ).toHaveAttribute("href", "/comics/xinghai/3");
    expect(screen.getByText("本机阅读记录")).toBeInTheDocument();
    expect(screen.getByText("第 3 话 · 第 6 页")).toBeInTheDocument();
    // 次要入口只换落点，不改记录（F4-7）
    expect(screen.getByRole("link", { name: "从第 1 话重读" })).toHaveAttribute(
      "href",
      "/comics/xinghai/1",
    );
    expect(readProgress("xinghai")).toMatchObject({ chapter: 3, page: 6 });
  });

  it("已读完：主按钮显示「已读完，从头再读」并回到第 1 话（F6-7）", () => {
    writeProgress("xinghai", createProgressRecord(5, 10, true));

    render(<ProgressCTA {...PROPS} />);

    expect(screen.getByRole("link", { name: "已读完，从头再读" })).toHaveAttribute(
      "href",
      "/comics/xinghai/1",
    );
    expect(screen.getByText("已读完")).toBeInTheDocument();
  });

  it("点「清除本机阅读记录」后记录消失、主按钮回到「开始阅读」（F4-8）", () => {
    writeProgress("xinghai", createProgressRecord(3, 6));

    render(<ProgressCTA {...PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: "清除本机阅读记录" }));

    expect(readProgress("xinghai")).toBeNull();
    expect(screen.getByRole("link", { name: "开始阅读" })).toBeInTheDocument();
    expect(screen.queryByText("本机阅读记录")).not.toBeInTheDocument();
  });

  it("记录指向不存在的话或页时视为无进度（storage.md 的边界规则）", () => {
    writeProgress("xinghai", createProgressRecord(9, 1)); // 只有 5 话
    render(<ProgressCTA {...PROPS} />);

    expect(screen.getByRole("link", { name: "开始阅读" })).toBeInTheDocument();
  });

  it("主按钮满足 56px 高度（ui.md §7.1 的「大目标」）", () => {
    render(<ProgressCTA {...PROPS} />);

    expect(screen.getByRole("link", { name: "开始阅读" }).className).toContain("h-14");
  });
});
