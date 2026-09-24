/* =============================================================================
 * ReaderStrip —— 阅读页的整条竖向长条（客户端组件）
 *
 * 它在做什么（F5）：把一话的 10 页按顺序铺成一条竖向滚动流，滚动时
 *   1) 懒加载：页面进入视口下方 200px 内才把它交给 next/image 请求图片；
 *   2) 记录当前页：口径严格按 storage.md —— 视口顶部往下第一张「底边仍在视口顶部
 *      之下」的页，没有满足的就取最后一页；
 *   3) 滚动停止 500ms 后把当前页写进 localStorage；切页/卸载前不额外写；
 *   4) 顶栏随滚动方向收起/显示，点按画面也能唤回；
 *   5) 首次进入时按本机记录滚到该页（Q5 的落点规则）。
 *
 * 为什么这些必须在客户端：IntersectionObserver、scroll 事件、localStorage 都是
 * 浏览器能力。服务端只负责把这一话的数据（页清单、前后话序号）取好传进来，
 * 于是首屏 HTML 里就有完整的 10 个页位，图片再按需到达 —— 这也是「无布局跳动」
 * 的前提：页位是服务端渲染出来的 3:4 容器，图片只是填进去。
 *
 * 「接下一话」不在这里实现（T-007）：T-007 会把下面的 sections 改成 state 并把
 * 下一话 append 进同一条滚动流，因此这里一开始就按「多段落」的形状来渲染。
 * ========================================================================== */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ReaderProgressBar } from "@/components/ReaderProgressBar";
import { RetryableImage } from "@/components/RetryableImage";
import { createProgressRecord, readProgress, writeProgress } from "@/lib/progress";
import type { ImageRef } from "@/types/comic";

/** storage.md：滚动停止 500ms 后写入 */
const WRITE_DEBOUNCE_MS = 500;
/** 懒加载提前量：只往下看 200px，避免首屏就把 10 页全请求了（F5-10） */
const LAZY_ROOT_MARGIN = "0px 0px 200px 0px";
/** 图片列宽度：手机全出血、桌面 720px 居中（ui.md §5.4） */
const IMAGE_SIZES = "(min-width: 768px) 720px, 100vw";

type StripSection = {
  number: number;
  title: string;
  pages: ImageRef[];
};

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
  /** 由服务端的 getChapter().next 决定：T-006 先用来判断「要不要显示收尾」 */
  hasNextChapter: boolean;
}) {
  // T-006 只有当前话一段；T-007 会把它改成 state 并 append 下一话（见文件头注释）
  const sections: StripSection[] = [{ number: chapter, title: chapterTitle, pages }];
  const totalPages = sections.reduce((sum, section) => sum + section.pages.length, 0);

  const stripRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedElements = useRef(new Map<string, Element>());
  const refCallbacks = useRef(new Map<string, (element: HTMLDivElement | null) => void>());

  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(() => new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [restoredPage, setRestoredPage] = useState<number | null>(null);
  const [topBarHidden, setTopBarHidden] = useState(false);

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

  /** 按 storage.md 的口径量一次当前页 */
  const measureCurrentPage = useCallback(() => {
    const nodes = stripRef.current?.querySelectorAll<HTMLElement>("[data-page-index]");
    if (!nodes || nodes.length === 0) {
      return 1;
    }
    const index = findCurrentPageIndex(Array.from(nodes, (node) => node.getBoundingClientRect()));
    const page = index + 1;
    setCurrentPage(page);
    return page;
  }, []);

  const writeCurrentPage = useCallback(
    (page: number) => {
      const previous = readProgress(comicSlug);
      // 读到最后一话最后一页即「已读完」（末页的判定见 isAtScrollBottom 注释）；
      // 已读完之后再回滚不取消这个标记（F6-7 要求详情页持续显示「已读完」）
      const reachedLastPage = page >= totalPages || isAtScrollBottom();
      const finished = (!hasNextChapter && reachedLastPage) || Boolean(previous?.finished);
      writeProgress(comicSlug, createProgressRecord(chapter, page, finished));
    },
    [comicSlug, chapter, totalPages, hasNextChapter],
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

  // 滚动：量当前页 + 500ms 防抖写进度 + 顶栏收起/显示
  useEffect(() => {
    let frame = 0;
    let writeTimer: ReturnType<typeof setTimeout> | null = null;
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
        const page = measureCurrentPage();
        if (writeTimer) {
          clearTimeout(writeTimer);
        }
        writeTimer = setTimeout(() => {
          writeTimer = null;
          writeCurrentPage(page);
        }, WRITE_DEBOUNCE_MS);
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
      if (writeTimer) {
        // 卸载前不补写：契约只要求「滚动停止 500ms 后写入」
        clearTimeout(writeTimer);
      }
    };
  }, [measureCurrentPage, writeCurrentPage]);

  // 进页时按本机记录落到该页（Q5：该话有进度就从记录页继续）
  useEffect(() => {
    const record = readProgress(comicSlug);
    if (!record || record.chapter !== chapter || record.page < 2 || record.page > totalPages) {
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
    setCurrentPage(record.page);
    return () => window.cancelAnimationFrame(frame);
  }, [comicSlug, chapter, totalPages]);

  const pageIndexOf = (sectionIndex: number, pageIndex: number) =>
    sections.slice(0, sectionIndex).reduce((sum, section) => sum + section.pages.length, 0) +
    pageIndex;

  return (
    <>
      <header
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
              第 {chapter} 话 · {chapterTitle}
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
          <section key={section.number} aria-label={`第 ${section.number} 话 ${section.title}`}>
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
          </section>
        ))}

        {/* ← T-007：「下一话」区块与下一话页块从这里接上，仍在同一条滚动流里 */}
      </div>

      <ReaderProgressBar chapter={chapter} page={currentPage} totalPages={totalPages} />
    </>
  );
}
