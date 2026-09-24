// @vitest-environment jsdom
/* =============================================================================
 * ReaderStrip 测试：懒加载、当前页口径、进度写入、沉浸顶栏、落点恢复
 *
 * jsdom 没有布局引擎，所以这里做了两件事让行为可断言：
 *   - 用可手动触发的 IntersectionObserver 桩件替代浏览器实现；
 *   - 按 data-page-index 与 window.scrollY 伪造 getBoundingClientRect，
 *     从而能精确验证 storage.md 的「视口顶部往下第一张可见页」口径。
 * 这两者都是「替身」，断言的对象仍然是契约规则。
 * ========================================================================== */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReaderProgressBar, progressPercent } from "@/components/ReaderProgressBar";
import { ReaderStrip, findCurrentPageIndex } from "@/components/ReaderStrip";
import { PROGRESS_STORAGE_KEY, createProgressRecord, readProgress, writeProgress } from "@/lib/progress";
import type { ChapterDetail, ImageRef } from "@/types/comic";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    loading,
    onError,
  }: {
    src: string;
    alt: string;
    loading?: string;
    onError?: () => void;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-loading={loading} onError={onError} />
  ),
}));

/** 每页高度（测试里固定，便于按 scrollY 推算可见页） */
const PAGE_HEIGHT = 400;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly elements = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  takeRecords() {
    return [];
  }

  /** 模拟「第 index 页进入视口」 */
  trigger(index: number) {
    const target = [...this.elements].find(
      (element) => (element as HTMLElement).dataset.pageIndex === String(index),
    );
    if (!target) {
      throw new Error(`没有观察到第 ${index} 页`);
    }
    this.callback(
      [{ target, isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  static latest(): MockIntersectionObserver {
    const instance = MockIntersectionObserver.instances.at(-1);
    if (!instance) {
      throw new Error("IntersectionObserver 还没被创建");
    }
    return instance;
  }
}

const pages: ImageRef[] = Array.from({ length: 10 }, (_, index) => ({
  src: `/comics/xinghai/3/${String(index + 1).padStart(3, "0")}.svg`,
  width: 600,
  height: 800,
  alt: `第 3 话 第 ${index + 1} 页`,
}));

const PROPS = {
  comicSlug: "xinghai",
  comicTitle: "星海拾遗",
  chapter: 3,
  chapterTitle: "无人值守的中继站",
  pages,
  hasNextChapter: true,
};

/** 第 4 话的数据（模拟预取接口的返回体） */
const chapter4: ChapterDetail = {
  comic: { slug: "xinghai", title: "星海拾遗" },
  number: 4,
  title: "日志第七页",
  pages: Array.from({ length: 10 }, (_, index) => ({
    src: `/comics/xinghai/4/${String(index + 1).padStart(3, "0")}.svg`,
    width: 600,
    height: 800,
    alt: `第 4 话 第 ${index + 1} 页`,
  })),
  prev: 3,
  next: 5,
};

beforeEach(() => {
  window.localStorage.clear();
  MockIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  // 预取会调用 fetch；这里给一个永不 resolve 的桩，避免测试里出现真实网络与多余状态更新
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
  // 伪造布局：第 n 页的顶边 = n * 页高 - 已滚动距离
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const index = Number(this.dataset.pageIndex ?? 0);
    const top = index * PAGE_HEIGHT - window.scrollY;
    return {
      top,
      bottom: top + PAGE_HEIGHT,
      height: PAGE_HEIGHT,
      width: 390,
      left: 0,
      right: 390,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect;
  });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("findCurrentPageIndex —— storage.md 的当前页口径", () => {
  it("取第一张「底边仍在视口顶部之下」的页", () => {
    expect(findCurrentPageIndex([{ bottom: -100 }, { bottom: 300 }, { bottom: 700 }])).toBe(1);
  });

  it("全部已滚过（没有任何页满足）时取最后一页", () => {
    expect(findCurrentPageIndex([{ bottom: -300 }, { bottom: -10 }])).toBe(1);
  });

  it("空列表返回 0，不抛错", () => {
    expect(findCurrentPageIndex([])).toBe(0);
  });
});

describe("progressPercent —— 底部进度条百分比", () => {
  it("按当前页 / 总页数四舍五入", () => {
    expect(progressPercent(1, 10)).toBe(10);
    expect(progressPercent(6, 10)).toBe(60);
    expect(progressPercent(10, 10)).toBe(100);
  });

  it("边界安全：没有页面时返回 0，越界值被夹在 0～100", () => {
    expect(progressPercent(1, 0)).toBe(0);
    expect(progressPercent(0, 10)).toBe(0);
    expect(progressPercent(20, 10)).toBe(100);
  });
});

describe("ReaderProgressBar", () => {
  it("用 progressbar 语义暴露当前页，并显示「第 x 话 · 第 y 页 / 共 n 页」", () => {
    render(<ReaderProgressBar chapter={3} page={6} totalPages={10} />);

    const bar = screen.getByRole("progressbar", { name: "本话阅读进度" });
    expect(bar).toHaveAttribute("aria-valuenow", "6");
    expect(bar).toHaveAttribute("aria-valuemax", "10");
    expect(screen.getByText(/第 3 话/)).toBeInTheDocument();
    expect(screen.getByText(/共 10 页/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "回到顶部" })).toBeInTheDocument();
  });
});

describe("ReaderStrip —— 懒加载与页位", () => {
  it("首帧渲染 10 个 3:4 页位，但一张图都还没请求", () => {
    const { container } = render(<ReaderStrip {...PROPS} />);

    expect(container.querySelectorAll("[data-page-index]")).toHaveLength(10);
    expect(container.querySelector('[data-page-index="0"]')?.className).toContain("aspect-[3/4]");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("只有进入视口附近的页才渲染图片（F5-10）", () => {
    render(<ReaderStrip {...PROPS} />);
    const observer = MockIntersectionObserver.latest();

    act(() => observer.trigger(0));
    act(() => observer.trigger(1));

    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("src"))).toEqual([
      "/comics/xinghai/3/001.svg",
      "/comics/xinghai/3/002.svg",
    ]);
  });
});

describe("ReaderStrip —— 滚动后的进度写入（F6-1、F6-6）", () => {
  it("滚动停止 500ms 后写入「视口顶部往下第一张可见页」，之前不写", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });
    render(<ReaderStrip {...PROPS} />);

    // 滚到 900px：第 1、2 页已经滚过，第 3 页是「顶边之上、底边仍在视口顶部之下」的第一张
    window.scrollY = 900;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    act(() => {
      vi.advanceTimersByTime(32); // 让 rAF 节流回调跑起来
    });
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(readProgress("xinghai")).toMatchObject({ chapter: 3, page: 3, finished: false });
  });

  it("读到最后一话最后一页时标记 finished，且之后回滚不会取消（F6-7）", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });
    render(<ReaderStrip {...PROPS} hasNextChapter={false} />);

    // 滚过所有页：没有任何页满足「底边 > 0」→ 取最后一页（第 10 页）
    window.scrollY = PAGE_HEIGHT * 20;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(32);
      vi.advanceTimersByTime(500);
    });
    expect(readProgress("xinghai")).toMatchObject({ chapter: 3, page: 10, finished: true });

    // 再滚回中间：进度页码更新，但 finished 保持
    window.scrollY = PAGE_HEIGHT * 2;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(32);
      vi.advanceTimersByTime(500);
    });
    expect(readProgress("xinghai")).toMatchObject({ chapter: 3, page: 3, finished: true });
  });

  it("卸载时清掉待写的定时器（契约：切页/卸载前不额外写）", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });
    const { unmount } = render(<ReaderStrip {...PROPS} />);

    window.scrollY = 400;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(32);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });
});

describe("ReaderStrip —— 缺陷 F-01：预取数据后到也要接续", () => {
  it("停在文档底部、数据在滚动停止之后才 ready，也必须自动接上下一话（不再产生 scroll 事件）", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });

    // 让 fetch 挂起：模拟「预取请求已发出，但数据还没回来」
    let resolveFetch: ((response: unknown) => void) | null = null;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ReaderStrip {...PROPS} />);

    // 一步滚到文档底部并停住：此后不再派发任何 scroll 事件
    window.scrollY = PAGE_HEIGHT * 20;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(32); // 让 rAF 节流回调跑起来（预取在这里发起）
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-section="4"]')).toBeNull();

    // 数据后到（模拟 fetch 在滚动停止之后才返回）
    await act(async () => {
      resolveFetch?.({
        ok: true,
        json: async () => chapter4,
      });
      await Promise.resolve();
    });

    // 关键断言：没有新的 scroll 事件，第 4 话仍然接上了
    expect(container.querySelector('[data-section="4"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-section="4"] [data-page-index]')).toHaveLength(10);
  });
});

describe("ReaderStrip —— 接续后地址同步不变（D-016）", () => {
  it("接上第 4 话之后读进第 4 话，地址栏按 replaceState 同步到 /comics/xinghai/4", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });

    let resolveFetch: ((response: unknown) => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    const { container } = render(<ReaderStrip {...PROPS} />);

    window.scrollY = PAGE_HEIGHT * 20;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(32);
    });
    await act(async () => {
      resolveFetch?.({ ok: true, json: async () => chapter4 });
      await Promise.resolve();
    });
    expect(container.querySelector('[data-section="4"]')).not.toBeNull();

    // 真正读进第 4 话的第 1 页（此时当前页落在第 4 话）
    window.scrollY = PAGE_HEIGHT * 10;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(32);
    });

    expect(replaceSpy).toHaveBeenCalledWith(null, "", "/comics/xinghai/4");
  });
});

describe("ReaderStrip —— 缺陷 F-02：进度写入兜底", () => {
  it("水合前就滚动过、之后没有新的 scroll 事件时，也会把当前页写进本机进度", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });

    // 模拟「用户在水合完成之前就滚到了第 3 页附近」：挂载时 scrollY 已经不是 0
    window.scrollY = PAGE_HEIGHT * 2;
    render(<ReaderStrip {...PROPS} />);

    act(() => {
      vi.advanceTimersByTime(500); // 挂载时补测的那次防抖写入
    });

    expect(readProgress("xinghai")).toMatchObject({ chapter: 3, page: 3, finished: false });
  });

  it("没有滚动过时不写记录（避免只打开一页就产生「继续阅读」）", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });

    render(<ReaderStrip {...PROPS} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });
});

describe("ReaderStrip —— 沉浸顶栏与落点恢复", () => {
  it("向下滚过 80px 收起顶栏，向上滚立刻显示", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
    });
    render(<ReaderStrip {...PROPS} />);
    const header = screen.getByRole("banner");

    act(() => {
      window.scrollY = 200;
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header.className).toContain("-translate-y-full");

    act(() => {
      window.scrollY = 150;
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header.className).toContain("translate-y-0");
  });

  it("本机记录是同一话时，进入阅读页会落到记录页并显示角标（F6-2）", async () => {
    writeProgress("xinghai", createProgressRecord(3, 6));

    render(<ReaderStrip {...PROPS} />);

    expect(screen.getByText("当前阅读位置 · 第 6 页")).toBeInTheDocument();
    // 落点滚动放在 requestAnimationFrame 里执行，等它跑完再断言
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });

  it("记录属于别的话时不跳转（换话从头读）", () => {
    writeProgress("xinghai", createProgressRecord(2, 6));

    render(<ReaderStrip {...PROPS} />);

    expect(screen.queryByText(/当前阅读位置/)).not.toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
