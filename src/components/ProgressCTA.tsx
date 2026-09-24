/* =============================================================================
 * ProgressCTA —— 详情页的「阅读记录卡 + 主按钮」（客户端组件）
 *
 * 为什么必须是客户端组件：进度存在浏览器 localStorage 里，服务端渲染时读不到。
 * 处理办法是「两段式」——服务端渲染「无进度」版本，组件挂载后在 useEffect 里
 * 读到进度再切到「继续阅读」版本。第一次客户端渲染与服务端 HTML 完全一致，
 * 因此不会出现 hydration mismatch（这也是本文件注释里最想强调的一点）。
 *
 * 它同时承担 ui.md §5.3 里的两个角色：
 *   - ProgressCard：有记录才显示；「从第 1 话重读」不修改记录，「清除本机阅读记录」删除记录；
 *   - PrimaryCta：手机上吸底固定（56px、留 safe-area），桌面上回到信息区（≤320px）。
 * 两个角色写在同一个文件里，是因为 T-005 的可改目录只给了这一个组件文件；
 * 组件提取留给 T-008（D-014）。
 * ========================================================================== */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  PROGRESS_CHANGED_EVENT,
  clearProgress,
  readProgress,
} from "@/lib/progress";
import type { ProgressRecord } from "@/types/comic";

export function ProgressCTA({
  slug,
  chapterCount,
  pagesPerChapter,
}: {
  slug: string;
  /** 这部漫画有几话：记录指向不存在的话时视为无进度（storage.md 的边界规则） */
  chapterCount: number;
  /** 每话页数：同理，页码超出范围也视为无进度 */
  pagesPerChapter: number;
}) {
  const [record, setRecord] = useState<ProgressRecord | null>(null);

  const sync = useCallback(() => {
    const stored = readProgress(slug);
    // 数据可能变小（例如以后删过话），过期记录不能让主按钮指向不存在的地址
    const usable =
      stored &&
      stored.chapter >= 1 &&
      stored.chapter <= chapterCount &&
      stored.page >= 1 &&
      stored.page <= pagesPerChapter;
    setRecord(usable ? stored : null);
  }, [slug, chapterCount, pagesPerChapter]);

  useEffect(() => {
    sync();
    // 同一个页面上的话列表角标也监听这个事件，两边状态不会各说各话
    window.addEventListener(PROGRESS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, sync);
  }, [sync]);

  const accentLinkClass =
    "flex h-14 w-full items-center justify-center rounded-sm bg-accent text-body font-semibold text-on-accent md:max-w-[320px]";
  const quietButtonClass =
    "inline-flex min-h-11 items-center justify-center rounded-sm border border-line-control px-3 text-sm-site font-semibold text-ink";

  return (
    <>
      {record ? (
        <div className="mt-6 rounded-md bg-subtle p-4">
          <p className="text-label tracking-[0.06em] text-ink-3">本机阅读记录</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-h3 font-semibold text-ink">
            第 {record.chapter} 话 · 第 {record.page} 页
            {record.finished ? (
              <span className="rounded-xs bg-accent-soft px-2 py-1 text-label text-accent">
                已读完
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-caption text-ink-3">
            进度只保存在这台设备的浏览器里，清除浏览器数据会一起清掉。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* 次要入口：只换落点，不动已有记录（F4-7） */}
            <Link href={`/comics/${slug}/1`} className={quietButtonClass}>
              从第 1 话重读
            </Link>
            <button type="button" onClick={() => clearProgress(slug)} className={quietButtonClass}>
              清除本机阅读记录
            </button>
          </div>
        </div>
      ) : null}

      {/* 手机上吸底；桌面回到信息区（ui.md §5.3） */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-base px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))] md:static md:z-auto md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <Link
          href={record && !record.finished ? `/comics/${slug}/${record.chapter}` : `/comics/${slug}/1`}
          className={accentLinkClass}
        >
          {record
            ? record.finished
              ? "已读完，从头再读"
              : `继续阅读：第 ${record.chapter} 话 第 ${record.page} 页`
            : "开始阅读"}
        </Link>
      </div>
    </>
  );
}
