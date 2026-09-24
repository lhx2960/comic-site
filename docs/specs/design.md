# 漫画站 MVP（范围 B）架构设计 v1.0（已冻结）

| 字段 | 内容 |
| --- | --- |
| 版本 | v1.0（**已冻结**：D-010 用户授权「事后追认」，实现据此开工） |
| 日期 | 2026-09-25 |
| 作者 | 架构师 |
| 上游依据 | D-001 ～ D-008、`docs/specs/prd.md`（v1.1 修订中）、`docs/specs/架构师答复-Q1-Q14.md`、`docs/specs/ui.md`（T-002 产出） |
| 下游用途 | `docs/contracts/`（契约冻结依据）、`docs/tasks/T-003+`（实现任务单） |
| 状态 | 冻结（2026-09-25）。改动需由架构师发起并在 `docs/specs/决策记录.md` 记录 |

本文只做技术决策，不写实现代码。本期目标不只是「做一个能用的站」，而是让用户沿着一条完整链路把 Next.js App Router 的机制学明白：服务端渲染 → 数据获取 → URL 即状态 → 客户端交互边界 → 图片优化 → 部署。

---

## 1. 技术栈与版本基线

| 项 | 选择 | 说明 |
| --- | --- | --- |
| 框架 | Next.js（App Router） | 页面、数据获取、Route Handler 都在一个应用里 |
| 语言 | TypeScript（`strict: true`） | 契约用类型表达，写错在编译期就暴露 |
| 样式 | Tailwind CSS | 设计令牌映射进 theme，组件不写死颜色 |
| 包管理 | pnpm | 命令以 `package.json` 为准 |
| 单元测试 | Vitest | 只测纯逻辑与小组件 |
| E2E | Playwright | 覆盖 PRD 关键路径，Chromium + WebKit |
| 部署 | Vercel | 预览环境 + 生产环境 |

## 2. 数据层：两个方案（闸门处确认）

**推荐方案 A（本期采用）：文件即数据源 + 可替换的访问层**

- 示例数据放仓库里（`data/comics.ts`），由 `scripts/generate-sample-data.mjs` 生成，占位图同时生成到 `public/comics/**`。
- 页面**不直接 import 数据文件**，一律通过 `src/lib/data/` 的访问层取数；访问层是纯函数，可单测、可替换。
- 好处：零外部依赖，本地/CI/Vercel 直接能跑，不需要账号与连接串，学习精力全花在 Next.js 本身。
- 代价：没有真实数据库的查询与迁移经验。

**方案 B（备选，后续可切换）：Neon Postgres + Drizzle ORM**

- 真实数据库、真实迁移与 SQL，学习价值更高；代价是要账号、连接串、迁移流程，CI 与本地都要能连库。
- 切换成本被设计压到最低：页面只认访问层的函数签名（见 `docs/contracts/data-access.md`），换实现时只改 `src/lib/data/`，页面与测试不动。

## 3. 目录结构

```
comic-site/
├─ data/                       # 示例数据源
├─ public/comics/              # 占位图（脚本生成，按 漫画/话/页 分目录）
├─ scripts/generate-sample-data.mjs
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx            # 全局壳（单写者文件）
│  │  ├─ globals.css           # 设计令牌与全局样式（单写者文件）
│  │  ├─ page.tsx              # 首页 = 列表 + 搜索 + 标签筛选（Q1）
│  │  ├─ comics/[slug]/page.tsx             # 漫画详情
│  │  ├─ comics/[slug]/[chapter]/page.tsx   # 阅读页
│  │  ├─ api/comics/[slug]/chapters/[chapter]/route.ts  # 预取下一话的 JSON
│  │  ├─ not-found.tsx / error.tsx / loading.tsx
│  ├─ components/              # ComicCard、TagFilter、SearchBox、ChapterList、
│  │                           # ReaderStrip、ReaderProgressBar、RetryableImage、EmptyState
│  ├─ lib/
│  │  ├─ data/                 # 访问层：对外只暴露函数
│  │  ├─ progress.ts           # 阅读进度读写（localStorage）
│  │  └─ search-params.ts      # URL 查询参数解析与构造
│  └─ types/comic.ts           # 领域类型（与 docs/contracts/types.ts 一致）
├─ tests/                      # 单元测试
└─ e2e/                        # Playwright 用例
```

## 4. 路由与数据流

| 路由 | 类型 | 数据来源 | 说明 |
| --- | --- | --- | --- |
| `/` | Server Component，动态（读 `searchParams`） | `listComics({ q, tag })` + `listTags()` | 首页即列表（Q1）；筛选状态全在 URL：`?q=...&tag=...` |
| `/comics/[slug]` | Server Component，动态 | `getComic(slug)` + `listChapters(slug)` | 找不到 → `notFound()` |
| `/comics/[slug]/[chapter]` | Server Component 外壳 + 客户端阅读器 | `getChapter(slug, n)` | 首话服务端直出，后续话由 Route Handler 预取追加 |
| `/api/comics/[slug]/chapters/[chapter]` | Route Handler | `getChapter()` | 只给阅读页内部用，返回页清单（图片地址、宽高比），不返回图片二进制 |

**为什么用 URL 承载筛选状态**：刷新、分享、前进后退天然可用，服务端能直接按参数查数据，不需要客户端状态库（对应 D-005）。

**为什么阅读页要 Route Handler**：滚到底接下一话要「不换页地续上内容」。首话服务端直出（首屏快、可直接测），后续话用 `fetch` 取 JSON 追加渲染（对应 D-004、Q5）。

## 5. 渲染与缓存策略

- **默认服务端渲染**：页面在服务端取数、渲染 HTML；客户端组件只出现在必须交互的地方。
- **客户端组件清单（实况 6 个，见 D-015）**：`SearchBox`（受控输入 + 提交）、`ChapterList`（本机进度角标）、`ProgressCTA`（阅读记录卡 + 主按钮）、`ReaderStrip`（滚动、预取下一话、进度上报）、`RetryableImage`（图片错误态与重试）、`ReaderProgressBar`（底部进度条）。其余都是服务端组件。
- **数据获取**：访问层用 React `cache()` 做请求内去重；示例数据是构建期常量，不需要 `revalidate`。
- **图片**：`next/image` + 本地占位图，固定宽高比（3:4，600×800），显式给尺寸或用比例容器，保证滚动过程**无布局跳动**（D-004 配套项）。

## 6. 阅读页设计（本期最复杂的一块）

1. 进入 `/comics/[slug]/[chapter]`：服务端渲染该话页清单，图片先占位。
2. `ReaderStrip` 用 `IntersectionObserver` 观察页间哨兵：进入视口才加载图片（懒加载），接近底部时预取下一话 JSON（预加载）。
3. 滚到底渲染「下一话」区块，把下一话页面追加到同一滚动容器；同时用 `router.replace(..., { scroll: false })` 把地址更新为下一话，标题区随之更新（Q5）。
4. 最后一话底部显示「已是最后一话」+ 返回详情 / 回到顶部。
5. 进度写入：滚动停止 500ms 后，取「视口顶部起第一张可见页」写入 localStorage（Q6）；**首次挂载后**才读取进度，避免水合不一致（hydration mismatch）。
6. 图片失败：`RetryableImage` 显示「图片加载失败 + 重试」，不影响后续页（Q12）。

## 7. 状态与持久化（阅读进度）

- 存储：浏览器 `localStorage`，key 与结构见 `docs/contracts/storage.md`，只在本机生效（D-004、F6）。
- 读取：客户端组件挂载后读取（`useEffect`），服务端不参与。
- 写入：滚动停止防抖 500ms；读到最后一话最后一页时标记 `finished`。
- 清除：详情页次要位置提供「清除本机阅读记录」（Q6）。

## 8. 错误处理与空状态

| 场景 | 处理 | 依据 |
| --- | --- | --- |
| 漫画/话不存在 | `notFound()` → `not-found.tsx`：提示「内容不存在」+ 返回入口 | F4-5、F5-9、G3 |
| 搜索/筛选 0 条 | `EmptyState`：提示 + 清除关键词/清除筛选 | F2-9、F3-5、G2 |
| 数据层异常 | `error.tsx` 错误边界：提示 + 重试（`reset()`） | G4 |
| 单张图片失败 | `RetryableImage` 就地降级 + 重试 | G4、Q12 |
| 加载中 | 路由级 `loading.tsx` 骨架 | G4 |

## 9. 样式与设计令牌

- `docs/specs/ui.md` 是唯一视觉依据；令牌映射到 Tailwind theme（在 `globals.css` 集中声明），**组件内禁止写死十六进制颜色**（D-006，列入质量评审检查项）。
- 站点页面走浅色令牌；阅读页在容器上切换 `data-theme="reader"`，走深色令牌，两套色值互不污染。

## 10. 测试策略

| 层 | 工具 | 覆盖对象 |
| --- | --- | --- |
| 单元 | Vitest | 访问层查询（关键词/标签/交集/大小写/空结果）、URL 解析与构造、进度读写与「当前页」口径 |
| E2E | Playwright | 首页 → 标签筛选刷新不丢 → 搜索 → 详情 → 阅读 → 滚到底接下一话 → 进度记忆 → 空/错误状态 |
| 静态检查 | `tsc --noEmit`、ESLint | 每次提交前必跑 |

## 11. 学习导向注释规范（D-002 落地）

每个文件要有 3～5 行文件头注释，说明「这个文件负责什么、在 Next.js 里属于哪一层（服务端/客户端/路由/数据）」。关键机制处写清「为什么这么写」，重点覆盖：Server/Client 组件边界、`searchParams` 为什么是异步的、`cache()` 的作用、`next/image` 为什么必须给尺寸、`useEffect` 读 localStorage 的原因、Route Handler 与 Server Action 的区别。**不逐行复述语法**。

## 12. 并发与写者约束

- 单写者文件：`src/app/layout.tsx`、`src/app/globals.css`、`next.config.mjs`、`src/types/comic.ts`——同一时刻只允许一个角色改。
- 页面与组件按文件归属拆任务，禁止两个任务改同一文件（AGENTS.md 硬规则）。

## 13. 部署与环境

- Vercel：main → 生产；其他分支/PR → 预览环境。
- 本期无密钥类环境变量（数据在仓库、无数据库）；`docs/ops.md` 由运维角色在首个可部署版本后建立。

## 14. 风险与取舍

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 文件数据 + 无数据库，缺真实查询经验 | 学习覆盖度 | 访问层保持可替换，后续切 Postgres 只改实现 |
| 长条滚动 + 自动接下一话是最复杂的部分 | 进度风险 | 拆成「阅读页核心」与「接续+预取」两个任务分别验证 |
| localStorage 进度易水合不一致 | 常见坑 | 只在客户端挂载后读取 |
| 150 张占位图 | 仓库体积 | 脚本生成 SVG，体积极小；换真实图片时再评估存储 |
| 流式渲染下 404 页面返回 200（D-017） | SEO / 语义 | 本期接受；接真实内容前用路由组把 404 路径移出 Suspense 边界 |

## 15. 任务切分预告（计划定稿闸门后细化）

| 任务 | 内容 | 归属 |
| --- | --- | --- |
| T-003 | 工程脚手架 + 数据生成脚本 + 访问层 + 类型落地 | 全栈 |
| T-004 | 首页：列表 + 标签筛选 + 搜索 + 空状态（URL 驱动） | 全栈 |
| T-005 | 详情页：元信息 + 话列表 + 不存在处理 | 全栈 |
| T-006 | 阅读页核心：长条滚动 + 懒加载 + 图片降级 + 进度读写 | 全栈 |
| T-007 | 接下一话：Route Handler 预取 + 追加渲染 + 地址同步 | 全栈 |
| T-008 | 全局收尾：loading/error/not-found、键盘可达、文案统一 | 全栈 |
| T-009 | E2E 用例 + 验收标准映射 | 测试 |
| T-010 | CI + Vercel 部署 + 回滚步骤 | 运维 |

## 16. 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v0.1 | 2026-09-25 | 初稿：技术栈、数据层两方案、目录结构、路由与数据流、阅读页机制、错误处理、测试与部署策略 |
| v1.0 | 2026-09-25 | **冻结**：数据层采用方案 A（文件数据 + 可替换访问层）；移动端优先（D-009）；据 D-010 直接进入实现，无需逐项请示 |
