/* =============================================================================
 * 阅读页的 404（PRD F5-9）
 *
 * 文案按 ui.md §5.4 的状态表：「这一话不存在」+「地址里的话序号可能被改过，
 * 回详情挑一话吧。」+「返回详情」。
 *
 * 为什么是客户端组件：not-found 边界不接收页面参数，而「返回详情」需要知道
 * 是哪一部漫画，只能用 useParams 从当前路由读 slug（读不到时退回首页）。
 * ========================================================================== */

"use client";

import { useParams } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";

export default function ChapterNotFound() {
  const params = useParams<{ slug?: string }>();
  const slug = typeof params?.slug === "string" && params.slug !== "" ? params.slug : null;

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-12 md:px-6">
      <div className="mx-auto max-w-[42ch]">
        <EmptyState
          title="这一话不存在"
          description="地址里的话序号可能被改过，回详情挑一话吧。"
          actions={
            slug
              ? [
                  { label: "返回详情", href: `/comics/${slug}` },
                  { label: "返回首页", href: "/" },
                ]
              : [{ label: "返回首页", href: "/" }]
          }
        />
      </div>
    </main>
  );
}
