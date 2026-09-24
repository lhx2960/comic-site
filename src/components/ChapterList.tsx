/* =============================================================================
 * ChapterList —— 详情页的话列表（客户端组件）
 *
 * 为什么是客户端组件：只有「读到此」角标依赖本机进度，而进度只存在于浏览器。
 * 服务端渲染时先渲染不带角标的版本（与客户端首次渲染一致，因此没有水合不一致），
 * 挂载后再按 localStorage 补上角标。
 *
 * 每条都是原生 <a>：整行 56px 可点（ui.md §7.1 的「大目标」），Tab 可达、Enter 进入。
 * 「从第 1 话重读」不会改记录，所以列表角标始终反映「真实记录」而不是本次点击。
 *
 * ⚠️ 为什么这里的链接必须 `prefetch={false}`（缺陷 F-06 / 裁决 D-020，别优化回去）：
 *   现象：生产构建下，详情页首屏刚出来的一小段时间窗内点话条目，`<Link>` 的处理函数
 *   跑了（默认跳转被 preventDefault）、导航用的 RSC 请求也 200 返回了，但**路由没有提交**——
 *   地址栏与页面都不变，没有任何报错，用户得再点一次（dev 下不会出现，只有 prod 会）。
 *   触发条件：与首屏这 5 条 `<Link>` 的 `Next-Router-Prefetch` 请求是否在途强相关
 *   （测试会话 A/B：全部 abort 掉预取请求后 20×3 全过；本机基线复现 2/20 失败）。
 *   取舍：关掉这几条链接的预取，点击永远走一次真实导航，换来 100% 可点；
 *   代价是首次点击时该话的 RSC 要现取（本项目的阅读页数据极小，实测无感）。
 *   最高频的「开始阅读 / 继续阅读」主按钮**保留默认预取**（只有 1 条，不在这个竞争窗口里）。
 * ========================================================================== */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PROGRESS_CHANGED_EVENT, readProgress } from "@/lib/progress";
import type { ChapterSummary } from "@/types/comic";

export function ChapterList({
  slug,
  chapters,
}: {
  slug: string;
  chapters: ChapterSummary[];
}) {
  const [currentChapter, setCurrentChapter] = useState<number | null>(null);

  useEffect(() => {
    // 挂载后才读：服务端渲染拿不到 localStorage，先渲染「无角标」版本
    const sync = () => setCurrentChapter(readProgress(slug)?.chapter ?? null);
    sync();
    window.addEventListener(PROGRESS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, sync);
  }, [slug]);

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="text-h2 font-semibold text-ink">话列表</h2>
        <p className="text-sm-site text-ink-3">共 {chapters.length} 话</p>
      </div>

      <ul>
        {chapters.map((chapter) => (
          <li key={chapter.number}>
            <Link
              href={`/comics/${slug}/${chapter.number}`}
              // 关闭预取：避免首屏 5 条并发预取与用户点击竞争导致路由不提交（F-06、D-020）
              prefetch={false}
              className="flex min-h-14 items-center gap-3 border-b border-line px-1 transition-colors hover:bg-surface-hover"
            >
              {/* 话序号固定 64px 宽，标题长短不影响纵向对齐（ui.md §5.3） */}
              <span className="w-16 shrink-0 text-sm-site font-bold text-ink-2">
                第 {chapter.number} 话
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">{chapter.title}</span>
              {currentChapter === chapter.number ? (
                <span className="shrink-0 rounded-xs bg-accent-soft px-2 py-1 text-label text-accent">
                  读到此
                </span>
              ) : null}
              <span aria-hidden="true" className="shrink-0 text-ink-disabled">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
