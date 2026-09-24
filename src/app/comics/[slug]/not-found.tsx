/* =============================================================================
 * 详情页的 404（PRD F4-5）
 *
 * 文案按 ui.md §5.3 的「内容不存在」状态：「这部漫画不存在」+「链接可能被改过，
 * 回首页看看还有哪些作品。」+「返回首页」。与全局 404 的区别只有文案 ——
 * 用户看到的是「这部漫画不存在」而不是笼统的「内容不存在」。
 *
 * 说明：not-found 边界不接收页面参数，拿不到 slug，所以只给「返回首页」；
 * 详情页的上一级就是首页（列表视图），退回首页即符合 G7。
 * ========================================================================== */

import type { Metadata } from "next";

import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "这部漫画不存在" };

export default function ComicNotFound() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-12 md:px-6">
      <div className="mx-auto max-w-[42ch]">
        <EmptyState
          title="这部漫画不存在"
          description="链接可能被改过，回首页看看还有哪些作品。"
          actions={[
            // 当前路由结构下「漫画库」就是首页的列表视图（Q1：首页即列表），
            // 两个入口指向同一地址；保留两个入口是为了给将来的独立漫画库路由留位置。
            { label: "去漫画库", href: "/" },
            { label: "返回首页", href: "/" },
          ]}
        />
      </div>
    </main>
  );
}
