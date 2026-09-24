// @vitest-environment jsdom
/* =============================================================================
 * TagFilter 渲染测试
 *
 * 关注三件事：每个标签都能点（≥44px、链接指向正确的 URL）、选中态可被辅助
 * 技术识别（aria-current）、再次点击同一标签会取消筛选（F2-8）。
 * ========================================================================== */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TagFilter } from "@/components/TagFilter";
import { listTags } from "@/lib/data/queries";

afterEach(cleanup);

const counts = { scifi: 2, mystery: 1, adventure: 1, "slice-of-life": 1, romance: 1 };

describe("TagFilter", () => {
  it("列出全部标签并带上命中数量（F1-4）", () => {
    render(<TagFilter tags={listTags()} counts={counts} query={{}} />);

    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /科幻/ })).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: /悬疑/ })).toHaveTextContent("1");
  });

  it("未选中标签的链接指向 ?tag=…，并保留当前关键词（F2-3、F2-7）", () => {
    render(<TagFilter tags={listTags()} counts={counts} query={{ q: "午夜" }} />);

    const href = screen.getByRole("link", { name: /科幻/ }).getAttribute("href") ?? "";
    const params = new URLSearchParams(href.replace(/^\/?\?/, ""));
    expect(params.get("q")).toBe("午夜");
    expect(params.get("tag")).toBe("scifi");
  });

  it("选中态用 aria-current 表达，而不是只靠颜色（ui.md §7.5）", () => {
    render(<TagFilter tags={listTags()} counts={counts} query={{ tag: "scifi" }} />);

    expect(screen.getByRole("link", { name: /科幻/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: /悬疑/ })).not.toHaveAttribute("aria-current");
  });

  it("再次点击已选中的标签会取消筛选（F2-8）", () => {
    render(
      <TagFilter tags={listTags()} counts={counts} query={{ q: "午夜", tag: "scifi" }} />,
    );

    const href = screen.getByRole("link", { name: /科幻/ }).getAttribute("href") ?? "";
    const params = new URLSearchParams(href.replace(/^\/?\?/, ""));
    expect(params.get("tag")).toBeNull();
    expect(params.get("q")).toBe("午夜");
  });

  it("每个 chip 都达到 44px 触控底线（ui.md §7.1）", () => {
    render(<TagFilter tags={listTags()} counts={counts} query={{}} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-11");
    }
  });
});
