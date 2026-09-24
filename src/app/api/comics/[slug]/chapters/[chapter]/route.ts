/* =============================================================================
 * Route Handler：GET /api/comics/[slug]/chapters/[chapter]
 *
 * 它只服务一件事：阅读页滚到底之前，客户端要提前把「下一话」的数据拿到手。
 * 返回体就是契约里的 ChapterDetail（页清单 + 前后话序号），不含图片二进制
 * （见 docs/contracts/routes.md 与 data-access.md）。
 *
 * 为什么用 Route Handler 而不是 Server Action：
 *   - Server Action 是「表单提交 / 变更数据」的通道，Next 会为它生成 POST 端点；
 *     这里没有任何写入，只是读数据。
 *   - Route Handler 是一个真正的 HTTP 端点，能被客户端 fetch、能被缓存策略与
 *     状态码（404/500）表达，也方便用浏览器的 Network 面板直接验证。
 * 所以读取类、需要被客户端在任意时刻调用的接口走 Route Handler。
 *
 * 为什么不让阅读页在服务端直接把下一话也渲染出来：那样首屏要多渲染一话的页位，
 * 用户可能根本读不到；按需预取能把「一话读完接下一话」的等待压到接近零，同时
 * 不牺牲首屏体积（D-004 的形态就是这么定的）。
 * ========================================================================== */

import { NextResponse } from "next/server";

import { getChapter } from "@/lib/data/queries";

/** 与 routes.md 一致：正整数、无前导零 */
const CHAPTER_PATTERN = /^[1-9][0-9]*$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; chapter: string }> },
) {
  try {
    const { slug, chapter } = await context.params;

    // 话号格式不合法与「数据里没有这一话」对客户端是同一件事：都按 404 处理
    if (!CHAPTER_PATTERN.test(chapter)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const detail = getChapter(slug, Number(chapter));
    if (!detail) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch {
    // 未预期异常：不回堆栈，只回契约约定的错误码，避免把内部信息暴露给浏览器
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
