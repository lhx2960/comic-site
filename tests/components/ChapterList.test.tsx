// @vitest-environment jsdom
/* =============================================================================
 * ChapterList 测试（含 T-015 的 F-06 回归断言）
 *
 * next/link 的 prefetch 不会落到 DOM 上，所以这里把 next/link 换成朴素 <a>，
 * 并把 prefetch 映射成 data-prefetch，从而能直接断言「话条目的预取被关掉了」——
 * 这条断言就是 F-06 的护栏：谁把 prefetch={false} 去掉，这里立刻红。
 * ========================================================================== */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChapterList } from "@/components/ChapterList";
import type { ChapterSummary } from "@/types/comic";

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: {
    href: string;
    prefetch?: boolean;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a
      href={href}
      data-prefetch={prefetch === undefined ? "default" : String(prefetch)}
      {...rest}
    >
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const chapters: ChapterSummary[] = [
  { number: 1, title: "冷启动" },
  { number: 2, title: "残骸里的回声" },
  { number: 3, title: "无人值守的中继站" },
  { number: 4, title: "日志第七页" },
  { number: 5, title: "回信" },
];

describe("ChapterList", () => {
  it("列出全部话，链接指向对应阅读页，并显示「共 N 话」", () => {
    render(<ChapterList slug="xinghai" chapters={chapters} />);

    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /第 3 话/ })).toHaveAttribute(
      "href",
      "/comics/xinghai/3",
    );
    expect(screen.getByText("共 5 话")).toBeInTheDocument();
  });

  it("F-06 护栏：话条目必须关闭预取（prefetch={false}），避免与点击竞争导致路由不提交", () => {
    render(<ChapterList slug="xinghai" chapters={chapters} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });
});
