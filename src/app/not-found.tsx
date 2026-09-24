/* =============================================================================
 * 全局 404 页面（App Router 的 not-found.tsx）
 *
 * 任何页面调用 notFound() 都会落到最近的一层 not-found 边界：详情页与阅读页各有
 * 更贴近语境的文案（`comics/[slug]/not-found.tsx`、`comics/[slug]/[chapter]/not-found.tsx`），
 * 这里兜底「完全没定义的地址」以及其它没有专门页面的情况（PRD G3）。
 *
 * 与 error.tsx 的分工：这里只处理「地址指向的内容不存在」（可预期）；
 * 真正的异常（网络/数据服务故障）由 error.tsx 接住并给「重试」。
 * 视觉与交互复用 EmptyState，保证所有「空 / 不存在」状态的形状一致。
 * ========================================================================== */

import type { Metadata } from "next";

import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "内容不存在" };

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-12 md:px-6">
      <div className="mx-auto max-w-[42ch]">
        <EmptyState
          title="内容不存在"
          description="链接可能被改过，回首页看看还有哪些作品。"
          actions={[{ label: "返回首页", href: "/" }]}
        />
      </div>
    </main>
  );
}
