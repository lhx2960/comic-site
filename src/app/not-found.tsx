/* =============================================================================
 * 404 页面（App Router 的 not-found.tsx）
 *
 * 任何页面调用 notFound() 都会落到这里：详情页 slug 不存在、阅读页话号非法或
 * 不存在、以及访问完全没定义的地址（PRD G3）。按 ui.md §5.3 的「内容不存在」
 * 规格：虚线插画块 + 标题 + 说明 + 「返回首页」。
 *
 * 与 error.tsx 的分工：这里只处理「地址指向的内容不存在」（可预期）；
 * 真正的异常（网络/数据服务故障）由 error.tsx 接住并给「重试」。
 * 逐作品的文案（「这部漫画不存在」）需要路由级 not-found 文件，见 T-008 回报的遗留项。
 * ========================================================================== */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "内容不存在" };

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-12 md:px-6">
      <div className="mx-auto max-w-[42ch] rounded-md border border-line bg-surface p-6 text-center">
        <p
          aria-hidden="true"
          className="mx-auto mb-4 size-12 rounded-sm border border-dashed border-line-strong bg-subtle"
        />
        <h1 className="text-h2 font-semibold text-ink">内容不存在</h1>
        <p className="mt-2 text-sm-site text-ink-2">
          链接可能被改过，回首页看看还有哪些作品。
        </p>
        <div className="mt-4 flex justify-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-line-control px-4 text-sm-site font-semibold text-ink"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
