// @vitest-environment jsdom
/* =============================================================================
 * 全局状态页的渲染测试（PRD G2/G3/G4、ui.md §6）
 *
 * 覆盖三个「非正常页面」：loading 骨架、错误边界、404。它们都必须在任何情况下
 * 给出下一步动作（重试 / 返回首页），并且骨架不能给屏幕阅读器制造噪音。
 * ========================================================================== */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";
import Loading from "@/app/loading";
import NotFound from "@/app/not-found";

afterEach(cleanup);

describe("error.tsx —— 错误边界（G4）", () => {
  it("显示「失败」文案与两条出路，不出现错误堆栈", () => {
    render(<ErrorPage error={new Error("boom")} reset={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "内容加载失败" })).toBeInTheDocument();
    expect(screen.getByText("网络或数据服务暂时不可用，请稍后重试。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });

  it("点「重试」调用 reset 重新渲染这一段", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("有 digest 时显示错误编号，便于和服务端日志对上", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<ErrorPage error={error} reset={vi.fn()} />);

    expect(screen.getByText("错误编号：abc123")).toBeInTheDocument();
  });
});

describe("not-found.tsx —— 内容不存在（G3）", () => {
  it("显示「内容不存在」与返回首页入口", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "内容不存在" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
  });

  it("装饰块不进无障碍树", () => {
    const { container } = render(<NotFound />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("loading.tsx —— 骨架（ui.md §6：只替换内容区、尺寸与真实结构一致）", () => {
  it("标记忙碌状态，并用一行隐藏文案给屏幕阅读器播报", () => {
    const { container } = render(<Loading />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("正在加载内容");
  });

  it("骨架对屏幕阅读器隐藏，且按真实结构给出 4 张 2:3 卡片骨架", () => {
    const { container } = render(<Loading />);

    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelectorAll(".aspect-\\[2\\/3\\]")).toHaveLength(4);
  });
});
