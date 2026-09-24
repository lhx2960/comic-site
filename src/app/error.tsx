/* =============================================================================
 * 路由级错误边界（App Router 的 error.tsx）
 *
 * 它必须是客户端组件：错误边界靠 React 的错误捕获机制工作，服务端渲染阶段
 * 抛出的错误要靠这一层在客户端接住。Next 会传入两个 props：
 *   - error：错误对象（含可选的 digest，用于和服务器日志对上号）；
 *   - reset：重试函数 —— 调用它会重新渲染这一段，是最直接的「重试」出路。
 *
 * 文案遵循 ui.md §6：统一「……加载失败」+「网络或数据服务暂时不可用，请稍后重试。」，
 * 并且一定给出下一步动作（重试 / 返回首页），不出现空白页与错误堆栈。
 * ========================================================================== */

"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-12 md:px-6">
      <div className="mx-auto max-w-[42ch] rounded-md border border-line bg-surface p-6 text-center">
        <p
          aria-hidden="true"
          className="mx-auto flex size-7 items-center justify-center rounded-pill bg-danger-soft text-sm-site font-bold text-danger"
        >
          !
        </p>
        <h1 className="mt-3 text-h2 font-semibold text-ink">内容加载失败</h1>
        <p className="mt-2 text-sm-site text-ink-2">
          网络或数据服务暂时不可用，请稍后重试。
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-accent px-4 text-sm-site font-semibold text-on-accent"
          >
            重试
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-line-control px-4 text-sm-site font-semibold text-ink"
          >
            返回首页
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-3 text-label text-ink-3">错误编号：{error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
