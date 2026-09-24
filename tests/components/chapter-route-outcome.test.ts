/* =============================================================================
 * 阅读页路由三态判定（T-012）
 *
 * F5-9 要求「不存在的话」显示「这一话不存在」，而「漫画本身不存在」要显示
 * 「这部漫画不存在」——两者是不同文案、不同出口。判定收敛在
 * `classifyReaderRoute()` 这个纯函数里，这里逐条钉住优先级与格式规则。
 * ========================================================================== */

import { describe, expect, it } from "vitest";

import { classifyReaderRoute } from "@/app/comics/[slug]/[chapter]/not-found";

const classify = (chapterParam: string, comicExists: boolean, chapterExists: boolean) =>
  classifyReaderRoute({ chapterParam, comicExists, chapterExists });

describe("classifyReaderRoute —— 漫画不存在优先", () => {
  it("漫画不存在时，无论话号是否合法都判为 comic-missing（文案「这部漫画不存在」）", () => {
    expect(classify("1", false, false)).toBe("comic-missing");
    expect(classify("9", false, false)).toBe("comic-missing");
    expect(classify("01", false, false)).toBe("comic-missing");
    expect(classify("abc", false, false)).toBe("comic-missing");
  });
});

describe("classifyReaderRoute —— 话不存在（F5-9，文案「这一话不存在」）", () => {
  it("漫画存在但数据里没有这一话 → chapter-missing", () => {
    expect(classify("9", true, false)).toBe("chapter-missing");
  });

  it.each(["0", "01", "007", "abc", "-1", "1.5", ""])(
    "话号格式非法（%s）→ chapter-missing",
    (chapterParam) => {
      expect(classify(chapterParam, true, false)).toBe("chapter-missing");
    },
  );

  it("即使数据层意外给出 detail，格式非法也仍按 chapter-missing 处理", () => {
    expect(classify("01", true, true)).toBe("chapter-missing");
  });
});

describe("classifyReaderRoute —— 正常阅读", () => {
  it("漫画与话都存在且格式合法 → ok", () => {
    expect(classify("1", true, true)).toBe("ok");
    expect(classify("10", true, true)).toBe("ok");
  });
});
