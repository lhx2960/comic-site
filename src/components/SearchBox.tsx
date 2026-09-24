/* =============================================================================
 * SearchBox —— 搜索框（客户端组件）
 *
 * 它是本期三个客户端组件之一（design.md §5）：需要「受控输入」——用户敲的每个
 * 字都进 React state，提交时才把关键词写进 URL。URL 才是真正的状态（D-005），
 * 组件本身不保存筛选结果。
 *
 * 这里刻意不 import 服务端的 search-params / 访问层：那会把 data/comics.ts 一起
 * 打进浏览器 bundle。替换参数时只保留服务端已经校验过的 tag，逻辑就够用了。
 *
 * 输入框字号用 --text-body（16px）：iOS Safari 对小于 16px 的输入框会自动放大
 * 整页（ui.md §8.2）。
 * ========================================================================== */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { FormEvent } from "react";

/**
 * 由「关键词 + 当前标签」拼出首页地址；关键词为空就把它从 URL 里去掉。
 * 导出出来是为了让单测能直接钉住这条 URL 规则（清空即移除 q、保留 tag）。
 */
export function buildHomeHref(keyword: string, tag?: string): string {
  const params = new URLSearchParams();
  const trimmed = keyword.trim();
  if (trimmed !== "") {
    params.set("q", trimmed);
  }
  if (tag) {
    params.set("tag", tag);
  }
  const serialized = params.toString();
  return serialized === "" ? "/" : `/?${serialized}`;
}

export function SearchBox({
  initialKeyword,
  activeTag,
}: {
  initialKeyword: string;
  /** 服务端解析出的生效标签；提交关键词时保留它（F2-7 的交集） */
  activeTag?: string;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(initialKeyword);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildHomeHref(keyword, activeTag));
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-pill border border-line-control bg-surface pr-0.5 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)]"
    >
      <input
        type="search"
        name="q"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="搜索漫画名或作者"
        aria-label="搜索漫画名或作者"
        // 高度用 min-h-11 而不是 h-full：表单自身有 1px 描边，h-full 只能拿到
        // 42px，达不到 44px 触控底线（ui.md §7.1）；表单高度是固定的 h-11，
        // 所以这里多出的 1px 不会把表单撑高。
        className="min-h-11 min-w-0 flex-1 bg-transparent px-4 text-body text-ink outline-none placeholder:text-ink-3"
      />
      <button
        type="submit"
        aria-label="搜索"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-2 hover:bg-surface-hover"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-5"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
