// @vitest-environment jsdom
/* =============================================================================
 * RetryableImage 测试：正常渲染 / 失败降级 / 重试恢复（Q12、F5 错误①）
 *
 * next/image 被换成朴素 <img>，这样可以直接 fireEvent.error 触发失败分支，
 * 断言的是「我们怎么用它」：alt 规则、eager/lazy、以及重试时会换一个 URL。
 * ========================================================================== */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RetryableImage } from "@/components/RetryableImage";
import type { ImageRef } from "@/types/comic";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    loading,
    onError,
    className,
  }: {
    src: string;
    alt: string;
    loading?: string;
    onError?: () => void;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-loading={loading} onError={onError} className={className} />
  ),
}));

afterEach(cleanup);

const page: ImageRef = {
  src: "/comics/xinghai/3/006.svg",
  width: 600,
  height: 800,
  alt: "第 3 话 第 6 页",
};

const renderPage = (eager = false) =>
  render(
    <RetryableImage
      page={page}
      chapter={3}
      pageNumber={6}
      sizes="(min-width: 768px) 720px, 100vw"
      eager={eager}
    />,
  );

describe("RetryableImage", () => {
  it("正常时渲染页图，alt 用契约里的「第 x 话 第 y 页」", () => {
    renderPage();

    const image = screen.getByRole("img", { name: "第 3 话 第 6 页" });
    expect(image).toHaveAttribute("src", "/comics/xinghai/3/006.svg");
    expect(image).toHaveAttribute("data-loading", "lazy");
  });

  it("首屏前两页用 eager 加载（ui.md §10.3）", () => {
    renderPage(true);

    expect(screen.getByRole("img")).toHaveAttribute("data-loading", "eager");
  });

  it("加载失败时就地降级：该页显示失败说明与重试入口，不影响其它页", () => {
    renderPage();

    fireEvent.error(screen.getByRole("img"));

    expect(screen.getByText("第 3 话 · 第 6 页加载失败")).toBeInTheDocument();
    expect(screen.getByText("这一页暂时取不到，可以先往下读。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试这一页" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("点「重试这一页」会换一个 URL 重新请求，并回到正常渲染", () => {
    renderPage();
    fireEvent.error(screen.getByRole("img"));

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "重试这一页" }));
    });

    const retried = screen.getByRole("img");
    // 同一个 URL 失败后可能命中缓存，所以重试必须换一个 URL
    expect(retried).toHaveAttribute("src", "/comics/xinghai/3/006.svg?retry=1");
    expect(screen.queryByText(/加载失败/)).not.toBeInTheDocument();
  });
});
