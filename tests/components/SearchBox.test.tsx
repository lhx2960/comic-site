// @vitest-environment jsdom
/* =============================================================================
 * SearchBox 测试：受控输入 + 提交后写 URL
 *
 * 覆盖 F3-6（清空关键词即移除参数）与 F2-7（提交关键词时保留当前标签）。
 * useRouter 被替换成假的 push，因此断言的是「组件会导航到哪里」，
 * 不涉及真实路由。
 * ========================================================================== */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchBox, buildHomeHref } from "@/components/SearchBox";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
});

afterEach(cleanup);

describe("buildHomeHref —— 关键词与标签如何落进 URL", () => {
  it("没有条件时回到根路径", () => {
    expect(buildHomeHref("", undefined)).toBe("/");
    expect(buildHomeHref("   ", undefined)).toBe("/");
  });

  it("关键词做百分号编码，去掉首尾空格", () => {
    expect(buildHomeHref("  星海 ", undefined)).toBe("/?q=%E6%98%9F%E6%B5%B7");
  });

  it("只有标签时保留标签", () => {
    expect(buildHomeHref("", "scifi")).toBe("/?tag=scifi");
  });

  it("关键词与标签同时存在时两个都在", () => {
    const href = buildHomeHref("午夜", "mystery");
    const params = new URLSearchParams(href.replace("/?", ""));
    expect(params.get("q")).toBe("午夜");
    expect(params.get("tag")).toBe("mystery");
  });
});

describe("SearchBox 组件", () => {
  it("回填当前关键词，并提供可访问的搜索按钮（F1-3）", () => {
    render(<SearchBox initialKeyword="海" activeTag="scifi" />);

    expect(screen.getByRole("searchbox", { name: "搜索漫画名或作者" })).toHaveValue("海");
    expect(screen.getByRole("button", { name: "搜索" })).toBeInTheDocument();
  });

  it("提交关键词后写入 URL，并保留当前标签（F2-7）", async () => {
    render(<SearchBox initialKeyword="" activeTag="scifi" />);

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "午夜" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    const href = pushMock.mock.calls[0]?.[0] as string;
    expect(new URLSearchParams(href.replace("/?", "")).get("q")).toBe("午夜");
    expect(new URLSearchParams(href.replace("/?", "")).get("tag")).toBe("scifi");
  });

  it("清空关键词后提交会移除 q，只留下标签（F3-6）", async () => {
    render(<SearchBox initialKeyword="星海" activeTag="scifi" />);

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(pushMock).toHaveBeenCalledWith("/?tag=scifi");
  });
});
