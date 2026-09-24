/* =============================================================================
 * RetryableImage —— 单个页图，失败可就地重试（客户端组件）
 *
 * 阅读页最怕「一张图挂了整页看不了」。这里把失败限制在单页范围内：
 * 失败时同一块区域换成虚线卡片 + 「重试这一页」，容器高度不变（还是 3:4），
 * 因此下面的页不会跳位，用户可以先往下读（Q12、F5/错误①）。
 *
 * 重试为什么要带 `?retry=n`：浏览器对同一个 URL 的失败请求可能直接用缓存里的
 * 失败结果，加一个递增参数才是「真的再请求一次」。
 *
 * 尺寸为什么必须给：next/image 需要宽高才能在图片到达前预留空间；配合外层
 * `aspect-[3/4]` 容器，图片从加载到显示的过程中不会发生布局跳动（F5-12）。
 * ========================================================================== */

"use client";

import Image from "next/image";
import { useState } from "react";

import type { ImageRef } from "@/types/comic";

export function RetryableImage({
  page,
  chapter,
  pageNumber,
  sizes,
  eager = false,
}: {
  page: ImageRef;
  chapter: number;
  pageNumber: number;
  sizes: string;
  /** 首屏前两页给 eager，其余交给懒加载（ui.md §10.3） */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed border-line-strong bg-subtle px-6 text-center">
        <p className="text-h3 font-semibold text-ink">
          第 {chapter} 话 · 第 {pageNumber} 页加载失败
        </p>
        <p className="text-caption text-ink-2">这一页暂时取不到，可以先往下读。</p>
        <button
          type="button"
          onClick={() => {
            setAttempt((value) => value + 1);
            setFailed(false);
          }}
          className="mt-1 inline-flex min-h-11 items-center rounded-sm border border-line-control px-4 text-sm-site font-semibold text-ink"
        >
          重试这一页
        </button>
      </div>
    );
  }

  return (
    <Image
      // retry 参数只用于「重试时换一个 URL」，正常加载永远是干净的路径
      src={attempt === 0 ? page.src : `${page.src}?retry=${attempt}`}
      alt={page.alt}
      width={page.width}
      height={page.height}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      // 占位图是 SVG，跳过 Next 的位图优化，直接按原文件请求
      unoptimized
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
