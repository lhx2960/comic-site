/* =============================================================================
 * ComicCard —— 漫画卡片（服务端组件）
 *
 * 属于「展示层」，在服务端渲染成 HTML，不发客户端 JS。整张卡片就是一个原生
 * <a>（ui.md §7.4）：键盘 Tab 能到、Enter 能进，中间不嵌第二个链接。
 *
 * 两个硬约束写在类名里：
 * - 封面容器用 2:3（ui.md §3.6、T-004 第 4 条），图片按 ImageRef 的宽高交给
 *   next/image，加载前后容器高度不变，滚动时页面不跳；
 * - 标题固定两行高（line-clamp-2 + min-h-11），保证同一行卡片对齐。
 * 卡片上不出现阅读进度标记（Q14）。
 * ========================================================================== */

import Image from "next/image";
import Link from "next/link";

import type { Comic } from "@/types/comic";

export function ComicCard({
  comic,
  tagNames,
  priority = false,
}: {
  comic: Comic;
  /** 已由页面把标签 slug 翻成中文名，卡片只负责展示 */
  tagNames: string[];
  /** 首屏前两张封面给 priority，其余交给浏览器懒加载（ui.md §10.3） */
  priority?: boolean;
}) {
  return (
    <Link
      href={`/comics/${comic.slug}`}
      className="flex flex-col gap-2 rounded-md border border-line bg-surface p-2 shadow-sm transition-colors hover:bg-surface-hover max-[340px]:flex-row max-[340px]:items-start"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm bg-subtle max-[340px]:w-[88px] max-[340px]:shrink-0">
        <Image
          src={comic.cover.src}
          alt={`封面：${comic.title}`}
          width={comic.cover.width}
          height={comic.cover.height}
          sizes="(min-width: 1024px) 341px, (min-width: 768px) 45vw, 50vw"
          priority={priority}
          // 占位图是 SVG：Next 默认不对 SVG 做位图优化（会直接拒绝），
          // 关掉优化既省一次图片服务往返，也保留 next/image 的尺寸与懒加载能力。
          unoptimized
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* 固定两行高：长标题截断，但卡片高度不被标题长度左右 */}
        <h3 className="line-clamp-2 min-h-11 text-h3 font-semibold text-ink">
          {comic.title}
        </h3>
        <p className="text-caption text-ink-3">作者：{comic.author}</p>
        <ul className="flex flex-wrap gap-1">
          {tagNames.map((name) => (
            <li
              key={name}
              className="rounded-xs bg-subtle px-2 py-1 text-label text-ink-3"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}
