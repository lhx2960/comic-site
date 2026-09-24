/* =============================================================================
 * 路由级加载态（App Router 的 loading.tsx）
 *
 * 在 App Router 里，loading.tsx 是这一段的 Suspense 兜底：导航到动态页面时
 * 服务端还没返回数据，先用它把「内容区」占住。它必须和真实内容同尺寸 ——
 * 骨架的圆角、比例、行数与真实结构一一对应，加载完才不会跳一下（ui.md §6）。
 *
 * 无障碍：骨架本身对屏幕阅读器是噪音，所以整体 aria-hidden，只留一行
 * role="status" 的「正在加载内容」播报一次；外层用 aria-busy 标记忙碌状态。
 * ========================================================================== */

export default function Loading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        正在加载内容
      </p>

      <div aria-hidden="true">
        {/* 顶部条骨架：高度与真实顶部条一致，避免加载期间页面上下跳动 */}
        <div className="border-b border-line bg-base/[0.96]">
          <div className="mx-auto flex min-h-14 max-w-[1120px] items-center gap-3 px-4 md:px-6">
            <div className="h-5 w-24 rounded-xs bg-subtle" />
            <div className="ml-auto h-11 w-full max-w-[420px] rounded-pill bg-subtle" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6">
          {/* 首屏文案骨架 */}
          <div className="h-7 w-32 rounded-xs bg-subtle md:h-9" />
          <div className="mt-3 h-4 w-56 rounded-xs bg-subtle" />
          {/* 标签条骨架 */}
          <div className="mt-4 flex gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-11 w-20 rounded-pill bg-subtle" />
            ))}
          </div>
          {/* 卡片骨架 ×4：2:3 封面 + 两条文字（70% / 45%），与真实卡片同款容器 */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:gap-6">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-md border border-line bg-surface p-2 shadow-sm">
                <div className="aspect-[2/3] w-full rounded-sm bg-subtle" />
                <div className="mt-2 h-4 w-[70%] rounded-xs bg-subtle" />
                <div className="mt-2 h-3 w-[45%] rounded-xs bg-subtle" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
