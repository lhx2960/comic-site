/* =============================================================================
 * ReaderStrip —— 阅读页的整条竖向长条（客户端组件）
 *
 * 它在做什么（F5）：把一话的 10 页按顺序铺成一条竖向滚动流，滚动时
 *   1) 懒加载：页面进入视口下方 200px 内才把它交给 next/image 请求图片；
 *   2) 记录当前页：口径严格按 storage.md —— 视口顶部往下第一张「底边仍在视口顶部
 *      之下」的页，没有满足的就取最后一页；
 *   3) 滚动停止 500ms 后把当前页写进 localStorage；切页/卸载前不额外写；
 *   4) 顶栏随滚动方向收起/显示，点按画面也能唤回；
 *   5) 首次进入时按本机记录滚到该页（Q5 的落点规则）；
 *   6) 接下一话（T-007）：剩余不足一屏就预取下一话的数据，滚到话末区块时把下一话
 *      追加到同一条滚动流里，同时用 router.replace 同步地址栏与顶栏。
 *
 * 为什么这些必须在客户端：IntersectionObserver、scroll 事件、localStorage、按需
 * fetch 都是浏览器行为。服务端只把当前话的数据取好传进来，于是首屏 HTML 里就有
 * 完整的页位，图片与下一话数据再按需到达 —— 这也是「无布局跳动」的前提。
 *
 * 为什么预取用客户端 fetch 而不是服务端渲染：下一话用户可能根本读不到，服务端
 * 提前渲染会白白增加首屏体积；而「读到快到底」这个时机只有客户端知道（滚动位置）。
 * 接口本身是 Route Handler（HTTP 端点），客户端 fetch 到的就是契约里的 ChapterDetail。
 * ========================================================================== */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ReaderProgressBar } from "@/components/ReaderProgressBar";
import { RetryableImage } from "@/components/RetryableImage";
import { createProgressRecord, readProgress, writeProgress } from "@/lib/progress";
import type { ChapterDetail, ImageRef } from "@/types/comic";

/** storage.md：滚动停止 500ms 后写入 */
const WRITE_DEBOUNCE_MS = 500;
/** 懒加载提前量：只往下看 200px，避免首屏就把 10 页全请求了（F5-10） */
const LAZY_ROOT_MARGIN = "0px 0px 200px 0px";
/** 图片列宽度：手机全出血、桌面 720px 居中（ui.md §5.4） */
const IMAGE_SIZES = "(min-width: 768px) 720px, 100vw";
/** 剩余不足一屏就预取下一话（F5-11） */
const PREFETCH_REMAINING_SCREENS = 1;

type StripSection = {
  number: number;
  title: string;
  pages: ImageRef[];
  /** 服务端给的下一话序号；null = 已经是最后一话 */
  nextNumber: number | null;
};

type NextStatus = "idle" | "loading" | "ready" | "error";

/**
 * 当前页判定（storage.md 的「当前页判定细则」）：
 * 依次看每张页块的底边，第一张「底边仍在视口顶部之下」（bottom > 0）的就是当前页；
 * 一张都不满足（例如已经滚过最后一页）时取最后一页。
 * 抽成纯函数，单测可以不依赖真实布局直接钉住这条契约。
 */
export function findCurrentPageIndex(rects: { bottom: number }[]): number {
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (rect && rect.bottom > 0) {
      return index;
    }
  }
  return Math.max(0, rects.length - 1);
}

/**
 * 是否已经滚到文档底部（±24px 容差）。
 *
 * 为什么需要它：`page` 严格按 storage.md 的口径算「视口顶部往下第一张可见页」，
 * 而末页下面只留了 56px（底栏）的空白，因此在常见视口高度下，滚到底时末页的
 * 上一页底边仍在视口顶部之下 —— 末页永远不会成为「当前页」，F6-7 的「已读完」
 * 也就永远触发不了（实测 390×844：滚到底记录第 9 页）。
 * 所以「读到最后一页」用这条补充条件判定：滚动位置到达文档底部即视为读完末页。
 * 报告里已把这条口径补充回报给架构师。
 */
function isAtScrollBottom(): boolean {
  const doc = document.documentElement;
  return window.scrollY + window.innerHeight >= doc.scrollHeight - 24;
}

/** 取下一话数据；失败直接抛错，由调用方转成「重试」状态 */
export async function fetchChapter(slug: string, chapter: number): Promise<ChapterDetail> {
  const response = await fetch(`/api/comics/${slug}/chapters/${chapter}`);
  if (!response.ok) {
    throw new Error(`下一话数据获取失败：${response.status}`);
  }
  return (await response.json()) as ChapterDetail;
}

export function ReaderStrip({
  comicSlug,
  comicTitle,
  chapter,
  chapterTitle,
  pages,
  hasNextChapter,
}: {
  comicSlug: string;
  comicTitle: string;
  chapter: number;
  chapterTitle: string;
  pages: ImageRef[];
  hasNextChapter: boolean;
}) {
  // 段落列表：初始只有当前话；接下一话时把新话 append 进来（同一条滚动流，F5-4）
  const [sections, setSections] = useState<StripSection[]>(() => [
    { number: chapter, title: chapterTitle, pages, nextNumber: hasNextChapter ? chapter + 1 : null },
  ]);
  const [nextStatus, setNextStatus] = useState<NextStatus>("idle");
  const [nextChapter, setNextChapter] = useState<ChapterDetail | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [restoredPage, setRestoredPage] = useState<number | null>(null);
  const [topBarHidden, setTopBarHidden] = useState(false);
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(() => new Set());

  const stripRef = useRef<HTMLDivElement | null>(null);
  const nextBlockRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedElements = useRef(new Map<string, Element>());
  const refCallbacks = useRef(new Map<string, (element: HTMLDivElement | null) => void>());
  /** 已经发起过预取的话号，保证同一话不会重复请求（F5-11 验收项） */
  const requestedChapters = useRef(new Set<number>());
  /** 最近一次同步到地址栏的 URL，避免反复 replace 同一个地址 */
  const lastSyncedUrl = useRef<string>(`/comics/${comicSlug}/${chapter}`);
  /** 待写进度的定时器。放在 ref 里而不是滚动 effect 的局部变量：
   *  effect 会因为预取状态变化而重订阅，局部变量会导致「正要写就被清掉」。 */
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deepest = sections[sections.length - 1];
  const nextNumber = deepest?.nextNumber ?? null;

  /** 把「全局页序号」映射回「哪一话的第几页」——追加了多话之后依然成立 */
  const locate = useCallback(
    (globalIndex: number) => {
      let offset = 0;
      for (let index = 0; index < sections.length; index += 1) {
        const section = sections[index];
        if (!section) {
          continue;
        }
        if (globalIndex < offset + section.pages.length) {
          return { section, pageInChapter: globalIndex - offset + 1 };
        }
        offset += section.pages.length;
      }
      const fallback: StripSection = deepest ?? {
        number: chapter,
        title: chapterTitle,
        pages,
        nextNumber: null,
      };
      return { section: fallback, pageInChapter: fallback.pages.length };
    },
    [sections, deepest, chapter, chapterTitle, pages],
  );

  /** 稳定的 ref 回调表：避免每次渲染都让 React 重新挂载观察目标 */
  const pageRef = useCallback((key: string) => {
    let callback = refCallbacks.current.get(key);
    if (!callback) {
      callback = (element) => {
        const previous = observedElements.current.get(key);
        if (previous && previous !== element) {
          observerRef.current?.unobserve(previous);
          observedElements.current.delete(key);
        }
        if (element) {
          observedElements.current.set(key, element);
          observerRef.current?.observe(element);
        }
      };
      refCallbacks.current.set(key, callback);
    }
    return callback;
  }, []);

  /** 按 storage.md 的口径量一次当前页（返回全局页序号，0 基） */
  const measureCurrentIndex = useCallback(() => {
    const nodes = stripRef.current?.querySelectorAll<HTMLElement>("[data-page-index]");
    if (!nodes || nodes.length === 0) {
      return 0;
    }
    const index = findCurrentPageIndex(Array.from(nodes, (node) => node.getBoundingClientRect()));
    setCurrentIndex(index);
    return index;
  }, []);

  const writeCurrentIndex = useCallback(
    (globalIndex: number) => {
      const { section, pageInChapter } = locate(globalIndex);
      const previous = readProgress(comicSlug);
      // 「已读完」只可能在最后一话成立：本话没有下一话，而且确实读到了末尾。
      // 末页的判定见 isAtScrollBottom 的注释（字面口径下末页无法成为当前页）。
      const reachedEnd =
        section.nextNumber === null &&
        (pageInChapter >= section.pages.length || isAtScrollBottom());
      const finished = reachedEnd || Boolean(previous?.finished);
      writeProgress(comicSlug, createProgressRecord(section.number, pageInChapter, finished));
    },
    [comicSlug, locate],
  );

  /** 重新计时：滚动停止 500ms 后写入当前页（storage.md 的防抖口径） */
  const scheduleWrite = useCallback(
    (globalIndex: number) => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
      }
      writeTimerRef.current = setTimeout(() => {
        writeTimerRef.current = null;
        writeCurrentIndex(globalIndex);
      }, WRITE_DEBOUNCE_MS);
    },
    [writeCurrentIndex],
  );

  // 卸载前不补写：契约只要求「滚动停止 500ms 后写入」，切页/卸载不该额外产生记录
  useEffect(
    () => () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
    },
    [],
  );

  /** 预取下一话：同一话只请求一次，失败后允许重试 */
  const loadNextChapter = useCallback(
    async (target: number) => {
      if (requestedChapters.current.has(target)) {
        return;
      }
      requestedChapters.current.add(target);
      setNextStatus("loading");
      try {
        const detail = await fetchChapter(comicSlug, target);
        setNextChapter(detail);
        setNextStatus("ready");
      } catch {
        requestedChapters.current.delete(target);
        setNextStatus("error");
      }
    },
    [comicSlug],
  );

  /** 把已拿到的下一话追加到同一条滚动流；顺带把地址栏与顶栏切到新话 */
  const appendNextChapter = useCallback(
    (scrollToNewChapter: boolean) => {
      if (!nextChapter) {
        return;
      }
      const appended = nextChapter;
      setSections((previous) =>
        previous.some((section) => section.number === appended.number)
          ? previous
          : [
              ...previous,
              {
                number: appended.number,
                title: appended.title,
                pages: appended.pages,
                nextNumber: appended.next,
              },
            ],
      );
      setNextChapter(null);
      setNextStatus("idle");
      if (scrollToNewChapter) {
        window.requestAnimationFrame(() => {
          stripRef.current
            ?.querySelector<HTMLElement>(`[data-section="${appended.number}"]`)
            ?.scrollIntoView({ block: "start" });
        });
      }
    },
    [nextChapter],
  );

  // 懒加载观察者：只负责把「进入过视口附近」的页标记为可加载
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setLoadedKeys((previous) => {
          let next: Set<string> | null = null;
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }
            const key = (entry.target as HTMLElement).dataset.pageKey;
            if (!key || previous.has(key)) {
              continue;
            }
            next = next ?? new Set(previous);
            next.add(key);
          }
          return next ?? previous;
        });
      },
      { rootMargin: LAZY_ROOT_MARGIN },
    );
    observerRef.current = observer;
    // ref 回调发生在 effect 之前，所以首帧挂上的元素要在这里补观察
    for (const element of observedElements.current.values()) {
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  // 滚动：量当前页 + 500ms 防抖写进度 + 顶栏收起/显示 + 预取下一话 + 话末追加
  useEffect(() => {
    let frame = 0;
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) >= 4) {
        // 向下滚且已经离开首屏 → 收起顶栏；向上滚 → 显示（ui.md §5.4）
        setTopBarHidden(delta > 0 && y > 80);
        lastY = y;
      }

      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const index = measureCurrentIndex();
        scheduleWrite(index);

        // F5-11：剩余不足一屏时提前把下一话数据取回来（只取数据，图片仍按需加载）
        const remaining =
          document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
        if (
          nextNumber !== null &&
          nextStatus === "idle" &&
          remaining < window.innerHeight * PREFETCH_REMAINING_SCREENS
        ) {
          void loadNextChapter(nextNumber);
        }

        // 滚到话末区块时把下一话接上（数据还没到就等它到；等待期间区块保持可见）
        const block = nextBlockRef.current;
        if (block && nextChapter && nextStatus === "ready") {
          if (block.getBoundingClientRect().top < window.innerHeight) {
            appendNextChapter(false);
          }
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [
    measureCurrentIndex,
    scheduleWrite,
    nextNumber,
    nextStatus,
    nextChapter,
    loadNextChapter,
    appendNextChapter,
  ]);

  // 进页时按本机记录落到该页（Q5：该话有进度就从记录页继续）
  useEffect(() => {
    const record = readProgress(comicSlug);
    if (!record || record.chapter !== chapter || record.page < 2 || record.page > pages.length) {
      return;
    }
    const node = stripRef.current?.querySelector<HTMLElement>(
      `[data-page-index="${record.page - 1}"]`,
    );
    if (!node) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      node.scrollIntoView({ block: "start" });
    });
    setRestoredPage(record.page);
    setCurrentIndex(record.page - 1);
    return () => window.cancelAnimationFrame(frame);
  }, [comicSlug, chapter, pages.length]);

  // 地址栏与顶栏跟着「当前读到的这一话」走（F5-4）
  const active = locate(currentIndex);
  useEffect(() => {
    const url = `/comics/${comicSlug}/${active.section.number}`;
    if (lastSyncedUrl.current === url) {
      return;
    }
    lastSyncedUrl.current = url;
    /*
     * 为什么用 history.replaceState 而不是 router.replace(url, { scroll: false })：
     * router.replace 会触发 Next 的软导航 —— 路由参数从 3 变成 4，本路由会重新渲染，
     * ReaderStrip 随之被**重新挂载**，它 state 里已经追加进来的第 3 话内容会全部消失。
     * 实测：3 → 4 时 [data-section="3"] 的 10 个页块数为 0、页数是 1 段，
     * 「同一条滚动流」直接被破坏（F5-4、F5-6 不成立）。
     * replaceState 同样是「替换当前历史记录、不新增条目」，但不会触发导航，
     * 因此追加的内容与滚动位置都保留。代价是 Next 内部的路由状态仍停在进入时的
     * 那一话：本页不再依赖它（数据与渲染都以 ReaderStrip 的 sections 为准），
     * 只在用户真的点链接跳转时才由 Next 接管地址栏。已把这条取舍回报架构师。
     */
    window.history.replaceState(null, "", url);
  }, [active.section.number, comicSlug]);

  const pageIndexOf = (sectionIndex: number, pageIndex: number) =>
    sections.slice(0, sectionIndex).reduce((sum, section) => sum + section.pages.length, 0) +
    pageIndex;

  const quietButtonClass =
    "inline-flex min-h-11 items-center justify-center rounded-sm border border-line-control px-4 text-sm-site font-semibold text-ink";

  return (
    <>
      <header
        // 顶栏收起时它只是「移出视野」，里面的链接仍在 Tab 顺序里 —— 加 inert 让它
        // 既不可聚焦也不进无障碍树，避免键盘用户 Tab 到一个看不见的按钮（G6）
        inert={topBarHidden || undefined}
        className={`sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur-sm transition-transform duration-200 ${
          topBarHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="mx-auto flex min-h-14 max-w-[1120px] items-center gap-2 px-4 md:px-6">
          <Link
            href={`/comics/${comicSlug}`}
            aria-label="返回详情"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm text-h3 text-ink-2 hover:bg-subtle"
          >
            <span aria-hidden="true">‹</span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm-site font-bold text-ink">{comicTitle}</p>
            <p className="truncate text-label text-ink-3">
              第 {active.section.number} 话 · {active.section.title}
            </p>
          </div>
          <Link
            href={`/comics/${comicSlug}`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-sm px-3 text-sm-site text-ink-2 hover:bg-subtle"
          >
            详情
          </Link>
        </div>
      </header>

      {/* 点按画面把顶栏唤回来（沉浸阅读的出口） */}
      <div
        ref={stripRef}
        onClick={() => setTopBarHidden(false)}
        className="mx-auto w-full md:max-w-[720px]"
      >
        {sections.map((section, sectionIndex) => (
          <section
            key={section.number}
            data-section={section.number}
            aria-label={`第 ${section.number} 话 ${section.title}`}
          >
            {sectionIndex > 0 ? (
              <div className="px-4 py-4 md:px-6">
                <p className="text-label tracking-[0.06em] text-accent">第 {section.number} 话</p>
                <h2 className="mt-1 text-h2 font-semibold text-ink">{section.title}</h2>
              </div>
            ) : null}

            {section.pages.map((page, pageIndex) => {
              const globalIndex = pageIndexOf(sectionIndex, pageIndex);
              const key = `${sectionIndex}-${pageIndex}`;
              return (
                <div
                  key={key}
                  ref={pageRef(key)}
                  data-page-key={key}
                  data-page-index={globalIndex}
                  // 固定 3:4 容器：图片没到之前高度就定好了，加载过程不会位移（F5-12）
                  className="relative aspect-[3/4] w-full border-b border-line bg-surface"
                >
                  {restoredPage === globalIndex + 1 ? (
                    <p className="absolute inset-x-0 top-0 z-10 border-y border-accent-soft-line bg-accent-soft py-1 text-center text-label tracking-[0.06em] text-accent">
                      当前阅读位置 · 第 {globalIndex + 1} 页
                    </p>
                  ) : null}

                  {loadedKeys.has(key) ? (
                    <RetryableImage
                      page={page}
                      chapter={section.number}
                      pageNumber={pageIndex + 1}
                      sizes={IMAGE_SIZES}
                      eager={sectionIndex === 0 && pageIndex < 2}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center bg-surface text-label tracking-[0.14em] text-ink-3"
                    >
                      第 {globalIndex + 1} 页
                    </div>
                  )}
                </div>
              );
            })}

            {/* 话末区块：有下一话就接上它，没有就收尾（F5-4、F5-5、F5-7） */}
            {sectionIndex === sections.length - 1 ? (
              <div ref={nextBlockRef}>
                {section.nextNumber === null ? (
                  <div className="px-4 py-8 md:px-6">
                    <div className="rounded-md border border-line bg-surface p-6 text-center">
                      <h2 className="text-h2 font-semibold text-ink">已是最后一话</h2>
                      <p className="mt-2 text-sm-site text-ink-2">
                        《{comicTitle}》到这里就读完了，可以回详情页挑别的作品。
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Link
                          href={`/comics/${comicSlug}`}
                          className="inline-flex min-h-11 items-center justify-center rounded-sm bg-accent px-4 text-sm-site font-semibold text-on-accent"
                        >
                          返回详情
                        </Link>
                        <button
                          type="button"
                          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                          className={quietButtonClass}
                        >
                          回到顶部
                        </button>
                      </div>
                    </div>
                  </div>
                ) : nextStatus === "error" ? (
                  <div className="flex flex-col items-center gap-2 border-y border-line bg-surface px-4 py-6 text-center md:px-6">
                    <p className="text-h3 font-semibold text-ink">下一话暂时取不到</p>
                    <p className="text-caption text-ink-2">
                      网络或数据服务暂时不可用，请稍后重试。
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadNextChapter(section.nextNumber ?? 0)}
                      className={quietButtonClass}
                    >
                      重试
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (nextStatus === "ready") {
                        appendNextChapter(true);
                      } else if (section.nextNumber !== null) {
                        void loadNextChapter(section.nextNumber);
                      }
                    }}
                    className="flex min-h-[72px] w-full items-center gap-3 border-y border-line bg-surface px-4 py-4 text-left hover:bg-subtle md:px-6"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-label tracking-[0.06em] text-accent">
                        下一话 · 第 {section.nextNumber} 话
                      </span>
                      <span className="mt-1 block truncate text-h3 font-semibold text-ink">
                        {nextChapter?.number === section.nextNumber
                          ? nextChapter.title
                          : "正在准备…"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm-site font-semibold text-accent">
                      继续阅读
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-ink-3">
                      ›
                    </span>
                  </button>
                )}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <ReaderProgressBar
        chapter={active.section.number}
        page={active.pageInChapter}
        totalPages={active.section.pages.length}
      />
    </>
  );
}
