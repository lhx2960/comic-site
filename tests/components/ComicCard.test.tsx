// @vitest-environment jsdom
/* =============================================================================
 * ComicCard 渲染测试
 *
 * 卡片是整卡一个链接（ui.md §7.4），封面必须有 alt 与显式尺寸；这里把
 * next/image 换成朴素 <img>，只验证「我们怎么用它」：传对了 src / alt /
 * sizes / priority，而不是去测 Next 内部的图片管线。
 * ========================================================================== */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComicCard } from "@/components/ComicCard";
import type { Comic } from "@/types/comic";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    sizes,
    priority,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    sizes?: string;
    priority?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      data-sizes={sizes}
      data-priority={priority ? "true" : "false"}
    />
  ),
}));

afterEach(cleanup);

const comic: Comic = {
  slug: "xinghai",
  title: "星海拾遗",
  author: "林岸",
  summary: "简介不显示在卡片上",
  tags: ["scifi", "adventure"],
  order: 1,
  cover: { src: "/comics/xinghai/1/001.svg", width: 600, height: 800, alt: "第 1 话 第 1 页" },
};

describe("ComicCard", () => {
  it("展示封面、标题、作者与标签（F1-1、F2-1）", () => {
    render(<ComicCard comic={comic} tagNames={["科幻", "冒险"]} />);

    expect(screen.getByRole("heading", { name: "星海拾遗" })).toBeInTheDocument();
    expect(screen.getByText("作者：林岸")).toBeInTheDocument();
    expect(screen.getByText("科幻")).toBeInTheDocument();
    expect(screen.getByText("冒险")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "封面：星海拾遗" })).toBeInTheDocument();
  });

  it("整张卡片就是一个链接，指向详情页（F1-2、F2-2）", () => {
    render(<ComicCard comic={comic} tagNames={["科幻"]} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/comics/xinghai");
  });

  it("封面用 ImageRef 的宽高与断点 sizes，首屏两张给 priority（ui.md §10.3）", () => {
    render(<ComicCard comic={comic} tagNames={["科幻"]} priority />);

    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("src", "/comics/xinghai/1/001.svg");
    expect(image).toHaveAttribute("width", "600");
    expect(image).toHaveAttribute("height", "800");
    expect(image.getAttribute("data-sizes")).toContain("min-width: 1024px");
    expect(image).toHaveAttribute("data-priority", "true");
  });

  it("显示简介之外的字段即可，且不出现任何阅读进度标记（Q14）", () => {
    const { container } = render(<ComicCard comic={comic} tagNames={["科幻"]} />);

    expect(container.textContent).not.toContain(comic.summary);
    expect(container.textContent).not.toMatch(/继续阅读|读到此|已读完|开始阅读/);
  });

  it("卡片容器保留 44px 触控与固定两行标题的类（ui.md §3.5）", () => {
    const { container } = render(<ComicCard comic={comic} tagNames={["科幻"]} />);

    expect(container.querySelector("h3")?.className).toContain("min-h-11");
    expect(container.querySelector("h3")?.className).toContain("line-clamp-2");
  });
});
