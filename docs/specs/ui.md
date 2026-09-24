# 漫画站 MVP（范围 B）UI 设计规格 v1.0（移动端优先）

| 字段 | 内容 |
| --- | --- |
| 版本 | v1.0（第 3 次派发：移动端优先重设计，作废第 1 次派发的桌面优先稿） |
| 日期 | 2026-09-25 |
| 作者 | UI 设计（T-002 一次性子代理） |
| 上游依据 | D-006（站点浅色 + 阅读页深色）、D-009（移动端优先）、`docs/specs/prd.md` v1.1、`docs/specs/design.md` §5/§9、`docs/contracts/types.ts` |
| 下游用途 | `src/app/globals.css` 的令牌落地、`src/components/**` 的视觉依据、设计定稿闸门的评审材料 |
| 状态 | 待用户在设计定稿闸门点头（点头前实现任务不启动） |
| 配套预览 | `docs/design-preview/{index,comics,detail,reader}.html` + 18 张 PNG（见 §9），全部可双击直接打开、不依赖构建、不引外部资源 |

---

## 0. 怎么读这份文档

这份文档只回答「长什么样、点什么、说什么话」，不写实现结构。三件事按顺序对上：

1. **§3 设计令牌** —— 唯一的色值/字号/间距来源。预览页里的 CSS 变量名与这里的表格**逐个同名**，实现时照抄进 Tailwind 主题即可。
2. **§5 页面规格** —— 4 个页面在手机（390px 基准）与桌面（1280px 增强）下的布局结构、组件清单、交互与文案。
3. **§9 截图索引** —— 每页两种宽度 + 状态样张 + 两张手机视口图，评审时对着图看规格。

已知的实现结构见 `docs/specs/design.md`；文档里出现的组件名（`ComicCard`、`TagFilter`、`SearchBox`、`ChapterList`、`ReaderStrip`、`ReaderProgressBar`、`RetryableImage`、`EmptyState`）与该文档 §3 的目录一致，方便 1:1 落到 `src/components/`。

---

## 1. 设计原则

| 编号 | 原则 | 怎么落地 |
| --- | --- | --- |
| P1 | **手机是基准，桌面是增强**（D-009） | 所有布局先按 390px 写；≥768px 只做三件事：加列数、加留白、把阅读列居中定宽。桌面不另起一套布局。 |
| P2 | **站点浅色、阅读页深色**（D-006） | 两套色板分域：站点用 `--c-*`，阅读页用 `--r-*`；阅读页不出现任何浅色底区块。 |
| P3 | **克制的黑白灰 + 单一主色** | 浅色域主色 `#C2410C`（焦橙，用于主按钮、选中态、进度标记）；深色域强调色 `#FF9E7A`。除这两支与错误色外不再引入其他彩色。 |
| P4 | **触控优先** | 所有可点区域 ≥44×44px，相邻触控目标间距 ≥8px，输入框字号 ≥16px（避免 iOS 聚焦自动放大）。 |
| P5 | **先占位、后填充** | 封面固定 2:3、页图固定 3:4，骨架块与真实块同尺寸 —— 图片或数据晚到时页面不上下位移（F5-12）。 |

---

## 2. 令牌命名规则

预览页与本文共用同一套变量名，前缀含义固定：

| 前缀 | 含义 | 例 |
| --- | --- | --- |
| `--c-*` | 浅色站点色板（color） | `--c-bg:#FFFFFF` |
| `--r-*` | 深色阅读域色板（reader） | `--r-bg:#0B0D10` |
| `--fs-*` / `--lh-*` | 字号 / 行高 | `--fs-h2:19px` / `--lh-h2:26px` |
| `--sp-*` | 间距刻度（4 的倍数） | `--sp-4:16px` |
| `--rad-*` | 圆角（两个域通用） | `--rad-md:14px` |
| `--sh-*` | 阴影（只用于浅色域） | `--sh-md` |
| `--touch` / `--touch-lg` / `--tap-gap` | 触控尺寸硬指标 | 44px / 56px / 8px |
| `--gutter` / `--container` / `--sticky-h` / `--reader-col` / `--bar-h` / `--foot-h` / `--cta-h` | 布局常量 | 16·24px / 1120px / 56px / 100%·720px / 56px / 52px / 64px |

---

## 3. 设计令牌

### 3.1 浅色站点色板（`--c-*`）

对比度为**实测值**（相对亮度按 WCAG 2.1 公式计算，计算命令见 §7.6）。

| 令牌 | 值 | 用途 | 对比度（实测） |
| --- | --- | --- | --- |
| `--c-bg` | `#FFFFFF` | 站点页面底色 | 正文压其上 17.92:1 |
| `--c-bg-subtle` | `#F5F6F8` | 次级底：条件标签底、状态样张区底、详情页阅读记录卡底、卡片内标签底 | 正文 16.57:1 |
| `--c-surface` | `#FFFFFF` | 卡片 / 输入框 / 按钮底 | — |
| `--c-surface-hover` | `#F0F2F5` | 悬停底（话列表条目、返回按钮、空状态插图） | — |
| `--c-border` | `#E4E7EC` | 分隔线、卡片描边 | 1.24:1（仅分隔线，不承担识别功能） |
| `--c-border-strong` | `#C7CCD4` | 标签 chip 描边、插图描边 | 1.61:1（同上，chip 靠文字识别） |
| `--c-border-input` | `#7C8493` | **交互控件边界**：搜索框、次要按钮 | 3.76:1（满足非文本 3:1） |
| `--c-text` | `#14171F` | 正文、标题 | 17.92:1 |
| `--c-text-secondary` | `#4A5158` | 次要文字：作者行、简介、chip 文字 | 8.05:1（压 `--c-bg-subtle` 上 7.44:1） |
| `--c-text-muted` | `#666D7A` | 说明文字、计数、占位符、卡片标签 | 5.21:1（压 `--c-bg-subtle` 上 4.81:1） |
| `--c-text-disabled` | `#9CA3AF` | 仅禁用态与装饰（面包屑分隔符） | 2.54:1（禁用态，WCAG 1.4.3 豁免） |
| `--c-primary` | `#C2410C` | 主按钮底、焦点环 | 5.18:1 |
| `--c-on-primary` | `#FFFFFF` | 压在主按钮上的文字 | 5.18:1 |
| `--c-primary-hover` | `#9A3412` | 主色深阶：选中 chip 的文字 | 压 `--c-primary-soft` 上 6.59:1 |
| `--c-primary-soft` | `#FDF1EA` | 选中态底色、条件标签底 | — |
| `--c-primary-soft-border` | `#F2CDB8` | 选中态描边 | 1.48:1（选中态同时有字重变化，不靠颜色单独表意） |
| `--c-danger` | `#B42318` | 错误标题、错误图标 | 6.57:1（压 `--c-danger-soft` 上 5.92:1） |
| `--c-danger-soft` | `#FEF0EF` | 错误角标底 | — |

### 3.2 深色阅读域色板（`--r-*`）

| 令牌 | 值 | 用途 | 对比度（实测） |
| --- | --- | --- | --- |
| `--r-bg` | `#0B0D10` | 阅读域底色（近黑，让画面成为焦点） | 正文压其上 16.74:1 |
| `--r-surface` | `#15181D` | 顶栏、底栏、接下一话区块、状态卡 | 正文 15.31:1 |
| `--r-surface-2` | `#1B1F25` | 单页失败卡的底 | 与 `--r-bg` 差 1.18:1（弱区分，另加虚线描边） |
| `--r-border` | `#262B33` | 页与页之间的 1px 分隔线、区块描边 | 1.37:1（仅分隔线） |
| `--r-border-strong` | `#333A44` | **仅装饰**：插图描边、卡片描边（不用于可交互控件的识别边界） | 1.70:1（装饰性，不适用 1.4.11） |
| `--r-border-control` | `#6E7683` | **可交互控件描边**：次要按钮、输入框、可点卡片边界（对应 `--color-line-control`） | 4.25:1（满足 WCAG 1.4.11 的 3:1，D-011） |
| `--r-text` | `#ECEEF1` | 主文字 | 16.74:1 |
| `--r-text-secondary` | `#A9B0BA` | 次要文字：底栏计数、按钮文字 | 8.90:1（压 `--r-surface` 上 8.14:1） |
| `--r-text-muted` | `#949CAA` | 页码、说明文字 | 7.04:1（压 `--r-surface` 上 6.43:1） |
| `--r-text-disabled` | `#6E7683` | 禁用/装饰（本期未用于信息型文字） | 4.25:1 |
| `--r-accent` | `#FF9E7A` | 强调：话序号、进度条填充、当前页角标 | 9.66:1（压 `--r-surface` 上 8.83:1） |
| `--r-on-accent` | `#101215` | 压在主色按钮上的文字 | 9.31:1 |
| `--r-accent-soft` | `#2A1E19` | 「当前阅读位置」角标底 | — |
| `--r-accent-border` | `#5A3A2C` | 同上角标描边 | 1.92:1（装饰） |
| `--r-danger-text` | `#FFB4A8` | 错误文字与图标 | 压 `--r-danger-soft` 上 9.88:1 |
| `--r-danger-soft` | `#2A1917` | 错误角标底 | — |

### 3.3 字号与行高阶梯

手机档为基准，桌面档在 `min-width:768px` 抬高（只有标题变大，正文与 UI 文字不变，避免手机上字太小）。

| 令牌 | 手机 390px | 桌面 1280px | 用在哪 |
| --- | --- | --- | --- |
| `--fs-display` / `--lh-display` | 26 / 34 | 34 / 44 | 首页首屏站点名 |
| `--fs-h1` / `--lh-h1` | 22 / 30 | 30 / 38 | 详情页漫画标题 |
| `--fs-h2` / `--lh-h2` | 19 / 26 | 20 / 28 | 分节标题（全部漫画、话列表、筛选结果） |
| `--fs-h3` / `--lh-h3` | 16 / 22 | 17 / 24 | 卡片标题、进度卡主值、下一话标题 |
| `--fs-body` / `--lh-body` | 16 / 26 | 16 / 26 | 正文、话列表条目、按钮（大字版）、**输入框最小字号** |
| `--fs-sm` / `--lh-sm` | 14 / 22 | 14 / 22 | 次要正文：作者行、副标题、chip 文字 |
| `--fs-caption` / `--lh-caption` | 13 / 20 | 13 / 20 | 计数、说明、进度文本 |
| `--fs-label` / `--lh-label` | 12 / 16 | 12 / 16 | 角标、页码、字段名（字距 +0.06em） |

页内大数字（阅读页占位页码 `03-06`）用 20px / 行高 1 / 字距 0.14em，属于占位稿专用样式，不进主题。

### 3.4 间距、圆角、阴影、边框

间距刻度刻意与 Tailwind 默认刻度对齐（见 §4），这样实现时不需要自定义间距：

| 令牌 | 值 | Tailwind 默认刻度 |
| --- | --- | --- |
| `--sp-1` | 4px | `1` |
| `--sp-2` | 8px | `2` |
| `--sp-3` | 12px | `3` |
| `--sp-4` | 16px | `4` |
| `--sp-5` | 24px | `6` |
| `--sp-6` | 32px | `8` |
| `--sp-7` | 48px | `12` |

| 令牌 | 值 | 用在哪 |
| --- | --- | --- |
| `--rad-xs` | 6px | 角标、骨架线条 |
| `--rad-sm` | 10px | 按钮、输入框、封面、页块 |
| `--rad-md` | 14px | 卡片、状态卡、详情大封面 |
| `--rad-lg` | 20px | 保留（本期预览未使用，留给弹层/大容器） |
| `--rad-pill` | 999px | 标签 chip、搜索框、计数点 |

| 令牌 | 值 | 用在哪 |
| --- | --- | --- |
| `--sh-sm` | `0 1px 2px rgba(20,23,31,.06)` | 卡片静置 |
| `--sh-md` | `0 4px 12px rgba(20,23,31,.08)` | 卡片悬停、详情大封面 |
| 吸底栏专用 | `0 -4px 16px rgba(20,23,31,.06)` | 详情页手机吸底 CTA 顶部的上投影 |

边框统一 1px；分隔线用 `--c-border`（浅色域）/ `--r-border`（深色域）；**交互控件的边界**只用 `--c-border-input`（浅色域）或文字本身（深色域，见 §7.5）。

### 3.5 布局与尺寸常量

| 令牌 | 值 | 说明 |
| --- | --- | --- |
| `--touch` | 44px | 最小可点区域（F/G 硬指标） |
| `--touch-lg` | 56px | 列表条目、吸底主按钮、「接下一话」区块 |
| `--tap-gap` | 8px | 相邻触控目标最小间距 |
| `--gutter` | 16px（手机）/ 24px（≥768px） | 页面左右留白；**阅读页图片不吃这个留白**（全出血） |
| `--container` | 1120px | 站点内容最大宽度 |
| `--sticky-h` | 56px | 吸顶头（含搜索框）的高度 |
| `--bar-h` | 56px | 阅读页顶部信息条高度 |
| `--foot-h` | 52px | 阅读页底部进度条文字行高度（进度条本体 3px 另算） |
| `--cta-h` | 64px | 详情页手机吸底 CTA 总高（按钮 56px + 上下 10px 内边距的近似值，用于给正文留底部空间） |
| `--reader-col` | `100%`（手机）/ `720px`（≥768px） | 阅读页图片列宽：手机上等于视口宽（全出血），桌面居中定宽 |

**断点**：只在两处断（与 Tailwind 默认断点重合，无需自定义）——

| 断点 | 行为 |
| --- | --- |
| `< 768px` | 手机档：单列或 2 列、吸底 CTA、图片全出血；`≤340px` 时卡片退化为单列横向卡 |
| `≥ 768px` | 桌面档：站点容器 1120px、卡片 3 列、详情两列、阅读列 720px 居中、主 CTA 回到信息区 |

### 3.6 图片占位与宽高比规则

| 场景 | 比例 | 占位尺寸 | 规则 |
| --- | --- | --- | --- |
| 漫画封面（卡片 / 详情大封面） | **2:3** | 600×900 | 容器写 `aspect-ratio:2/3`；实现时以 `ImageRef.width/height` 为准（`docs/contracts/types.ts`） |
| 阅读页页图 | **3:4** | 600×800 | 与 `design.md` §5 一致；容器写 `aspect-ratio:3/4`，图片宽度 100%，高度由比例决定 |
| 骨架块 | 同真实块 | 同上 | 骨架必须复用同一比例的容器类，禁止用固定像素兜底 |
| 占位视觉 | — | — | 浅色域用 `linear-gradient(150deg,#EDEFF3 0%,#DCE1E8 100%)`；深色域用 `linear-gradient(160deg,#161A20 0%,#1E232A 100%)`；角落标注用途（「封面 2:3」/「03-06」），不引任何外部图片 |

> **比例以数据为准，不写死在组件里**：T-003 的生成脚本给阅读页页图出的是 600×800（3:4）；封面若也按 3:4 生成（任务单只写了「600×800」），卡片容器必须用 `ImageRef.width/height` 算出 `aspect-ratio`（或 `next/image` 的 `width/height`），否则 2:3 容器会把 3:4 的封面裁掉一截。两种做法都行，**推荐脚本给封面单独出 2:3（600×900）**，与本节表格一致。

---

## 4. 令牌 → Tailwind 映射

### 4.1 颜色

Tailwind v4 用 `@theme` 声明即可生成工具类（浅色域 / 深色域各一套，前缀区分）：

| 设计令牌 | Tailwind 主题变量（v4 `@theme`） | 生成的类 | 值 |
| --- | --- | --- | --- |
| `--c-bg` | `--color-site-bg` | `bg-site-bg` | `#FFFFFF` |
| `--c-bg-subtle` | `--color-site-bg-subtle` | `bg-site-bg-subtle` | `#F5F6F8` |
| `--c-surface` | `--color-site-surface` | `bg-site-surface` | `#FFFFFF` |
| `--c-surface-hover` | `--color-site-surface-hover` | `bg-site-surface-hover` | `#F0F2F5` |
| `--c-border` | `--color-site-border` | `border-site-border` | `#E4E7EC` |
| `--c-border-strong` | `--color-site-border-strong` | `border-site-border-strong` | `#C7CCD4` |
| `--c-border-input` | `--color-site-border-input` | `border-site-border-input` | `#7C8493` |
| `--c-text` | `--color-site-text` | `text-site-text` | `#14171F` |
| `--c-text-secondary` | `--color-site-text-secondary` | `text-site-text-secondary` | `#4A5158` |
| `--c-text-muted` | `--color-site-text-muted` | `text-site-text-muted` | `#666D7A` |
| `--c-text-disabled` | `--color-site-text-disabled` | `text-site-text-disabled` | `#9CA3AF` |
| `--c-primary` | `--color-site-primary` | `bg-site-primary` / `text-site-primary` | `#C2410C` |
| `--c-primary-hover` | `--color-site-primary-hover` | `bg-site-primary-hover` | `#9A3412` |
| `--c-primary-soft` | `--color-site-primary-soft` | `bg-site-primary-soft` | `#FDF1EA` |
| `--c-primary-soft-border` | `--color-site-primary-soft-border` | `border-site-primary-soft-border` | `#F2CDB8` |
| `--c-danger` | `--color-site-danger` | `text-site-danger` | `#B42318` |
| `--c-danger-soft` | `--color-site-danger-soft` | `bg-site-danger-soft` | `#FEF0EF` |
| `--c-on-primary` | `--color-site-on-primary` | `text-site-on-primary` | `#FFFFFF` |
| `--r-bg` | `--color-reader-bg` | `bg-reader-bg` | `#0B0D10` |
| `--r-surface` | `--color-reader-surface` | `bg-reader-surface` | `#15181D` |
| `--r-surface-2` | `--color-reader-surface-2` | `bg-reader-surface-2` | `#1B1F25` |
| `--r-border` | `--color-reader-border` | `border-reader-border` | `#262B33` |
| `--r-border-strong` | `--color-reader-border-strong` | `border-reader-border-strong` | `#333A44` |
| `--r-text` | `--color-reader-text` | `text-reader-text` | `#ECEEF1` |
| `--r-text-secondary` | `--color-reader-text-secondary` | `text-reader-text-secondary` | `#A9B0BA` |
| `--r-text-muted` | `--color-reader-text-muted` | `text-reader-text-muted` | `#949CAA` |
| `--r-text-disabled` | `--color-reader-text-disabled` | `text-reader-text-disabled` | `#6E7683` |
| `--r-accent` | `--color-reader-accent` | `bg-reader-accent` / `text-reader-accent` | `#FF9E7A` |
| `--r-on-accent` | `--color-reader-on-accent` | `text-reader-on-accent` | `#101215` |
| `--r-accent-soft` | `--color-reader-accent-soft` | `bg-reader-accent-soft` | `#2A1E19` |
| `--r-accent-border` | `--color-reader-accent-border` | `border-reader-accent-border` | `#5A3A2C` |
| `--r-danger-text` | `--color-reader-danger-text` | `text-reader-danger-text` | `#FFB4A8` |
| `--r-danger-soft` | `--color-reader-danger-soft` | `bg-reader-danger-soft` | `#2A1917` |

### 4.2 字号 / 行高 / 圆角 / 阴影 / 尺寸

| 设计令牌 | Tailwind（v4 `@theme`） | 生成的类 |
| --- | --- | --- |
| `--fs-display` + `--lh-display` | `--text-display:26px; --text-display--line-height:34px` | `text-display` |
| `--fs-h1` + `--lh-h1` | `--text-h1:22px; --text-h1--line-height:30px` | `text-h1` |
| `--fs-h2` + `--lh-h2` | `--text-h2:19px; --text-h2--line-height:26px` | `text-h2` |
| `--fs-h3` + `--lh-h3` | `--text-h3:16px; --text-h3--line-height:22px` | `text-h3` |
| `--fs-sm` + `--lh-sm` | `--text-sm-site:14px; --text-sm-site--line-height:22px` | `text-sm-site` |
| `--fs-caption` + `--lh-caption` | `--text-caption:13px; --text-caption--line-height:20px` | `text-caption` |
| `--fs-label` + `--lh-label` | `--text-label:12px; --text-label--line-height:16px` | `text-label` |
| `--rad-xs/sm/md/lg/pill` | `--radius-xs:6px; --radius-sm:10px; --radius-md:14px; --radius-lg:20px; --radius-pill:999px` | `rounded-xs/sm/md/lg/pill` |
| `--sh-sm` / `--sh-md` | `--shadow-sm: …; --shadow-md: …` | `shadow-sm` / `shadow-md` |
| `--touch` | 直接用 Tailwind 默认刻度 `11` | `min-h-11 min-w-11`（11×4px = 44px） |
| `--touch-lg` | 默认刻度 `14` | `min-h-14`（56px） |
| `--sp-1…7` | 默认刻度 `1,2,3,4,6,8,12` | `gap-4` `py-6`（见 §3.4 对照表） |
| `--container` | 不建令牌 | `max-w-[1120px] mx-auto px-4 md:px-6` |
| `--reader-col` | 不建令牌 | `w-full md:max-w-[720px] md:mx-auto` |
| 断点 | 默认 `md:768px` | `md:` 前缀即桌面档 |

正文（body）字号用 Tailwind 默认的 `text-base`（16px / 行高 24px）会与令牌的 16/26 有 2px 差异，**正文类统一用 `text-body`**（`--text-body:16px; --text-body--line-height:26px`），避免两处行高不一致。

### 4.3 完整 `@theme`（可直接抄进 `src/app/globals.css`，对应 T-003 第 7 条）

```css
@import "tailwindcss";

@theme {
  /* —— 浅色站点色板（= §3.1 的 --c-*）—— */
  --color-site-bg:#FFFFFF;              --color-site-bg-subtle:#F5F6F8;
  --color-site-surface:#FFFFFF;         --color-site-surface-hover:#F0F2F5;
  --color-site-border:#E4E7EC;          --color-site-border-strong:#C7CCD4;
  --color-site-border-input:#7C8493;
  --color-site-text:#14171F;            --color-site-text-secondary:#4A5158;
  --color-site-text-muted:#666D7A;      --color-site-text-disabled:#9CA3AF;
  --color-site-primary:#C2410C;         --color-site-primary-hover:#9A3412;
  --color-site-primary-soft:#FDF1EA;    --color-site-primary-soft-border:#F2CDB8;
  --color-site-danger:#B42318;          --color-site-danger-soft:#FEF0EF;
  --color-site-on-primary:#FFFFFF;

  /* —— 深色阅读域色板（= §3.2 的 --r-*）—— */
  --color-reader-bg:#0B0D10;            --color-reader-surface:#15181D;
  --color-reader-surface-2:#1B1F25;
  --color-reader-border:#262B33;        --color-reader-border-strong:#333A44;
  --color-reader-text:#ECEEF1;          --color-reader-text-secondary:#A9B0BA;
  --color-reader-text-muted:#949CAA;    --color-reader-text-disabled:#6E7683;
  --color-reader-accent:#FF9E7A;        --color-reader-on-accent:#101215;
  --color-reader-accent-soft:#2A1E19;   --color-reader-accent-border:#5A3A2C;
  --color-reader-danger-text:#FFB4A8;   --color-reader-danger-soft:#2A1917;

  /* —— 字号 / 行高（手机档；桌面档用 md: 前缀抬高，取值见 §3.3）—— */
  --text-display:26px;  --text-display--line-height:34px;
  --text-h1:22px;       --text-h1--line-height:30px;
  --text-h2:19px;       --text-h2--line-height:26px;
  --text-h3:16px;       --text-h3--line-height:22px;
  --text-body:16px;     --text-body--line-height:26px;
  --text-sm-site:14px;  --text-sm-site--line-height:22px;
  --text-caption:13px;  --text-caption--line-height:20px;
  --text-label:12px;    --text-label--line-height:16px;

  /* —— 圆角 / 阴影 —— */
  --radius-xs:6px; --radius-sm:10px; --radius-md:14px; --radius-lg:20px; --radius-pill:999px;
  --shadow-sm:0 1px 2px rgba(20,23,31,.06);
  --shadow-md:0 4px 12px rgba(20,23,31,.08);
}
```

### 4.4 语义层：让同一份组件在两个域里都能用（对应 §10 第 2 条）

上面两套是**原始色板**（评审时能同时看到两套值）。组件不要直接写 `bg-site-primary` / `bg-reader-accent`，而是再走一层语义令牌：

```css
/* 浅色站点（默认域） */
:root {
  --color-base:#FFFFFF; --color-surface:#FFFFFF; --color-subtle:#F5F6F8;
  --color-line:#E4E7EC; --color-line-strong:#C7CCD4; --color-line-control:#7C8493;
  --color-ink:#14171F; --color-ink-2:#4A5158; --color-ink-3:#666D7A; --color-ink-disabled:#9CA3AF;
  --color-accent:#C2410C; --color-accent-hover:#9A3412;
  --color-accent-soft:#FDF1EA; --color-accent-soft-line:#F2CDB8;
  --color-on-accent:#FFFFFF; --color-danger:#B42318; --color-danger-soft:#FEF0EF;
}
/* 阅读页容器：只换取值，不换令牌名 —— 组件不必写「阅读页专用样式」 */
[data-theme="reader"] {
  --color-base:#0B0D10; --color-surface:#15181D; --color-subtle:#1B1F25;
  --color-line:#262B33; --color-line-strong:#333A44; --color-line-control:#6E7683;
  --color-ink:#ECEEF1; --color-ink-2:#A9B0BA; --color-ink-3:#949CAA; --color-ink-disabled:#6E7683;
  --color-accent:#FF9E7A; --color-accent-hover:#FFB79B;
  --color-accent-soft:#2A1E19; --color-accent-soft-line:#5A3A2C;
  --color-on-accent:#101215; --color-danger:#FFB4A8; --color-danger-soft:#2A1917;
}
```

把这一层也放进 `@theme`（`--color-base`、`--color-surface`、`--color-ink`…），组件里就只出现 `bg-surface`、`text-ink-2`、`border-line`、`bg-accent`、`text-on-accent` 这类类名；阅读页只在容器上加 `data-theme="reader"`（`design.md` §9 的要求）。注意 `--color-accent-hover:#FFB79B` 是深色域主按钮的悬停档（预览稿未用到，实现时按需启用；实测对 `#0B0D10` 11.58:1）；浅色域的 `#9A3412` 对白底实测 7.31:1。

（Tailwind v3 用 `tailwind.config.ts` 的 `theme.extend.colors/…` 表达同一份映射，键名不变。）

---

## 5. 页面规格

每页给三样东西：**布局**（手机 390px 基准 / 桌面 1280px 增强）、**组件清单**（组件名、状态、交互、中文文案）、**三种状态的视觉说明**。

「实测内容高度」来自自检脚本（§7.6）在 `node docs/design-preview/shots.mjs` 里量到的 `scrollHeight`，**包含页面下方的状态样张区**，只用于说明页面长度量级。

### 5.1 首页（`/`，浏览入口）

预览：`docs/design-preview/index.html`

#### 布局

**手机 390px（基准，实测内容高 2514px）**

| 区块 | 规格 |
| --- | --- |
| 吸顶头（`sticky`） | 单行，`min-height:56px`；左侧站点名「漫画站」（16px/700 + 18px 主色渐变方块）；右侧搜索框 `flex:1`，高 44px，圆角 pill，内嵌 44×44 搜索按钮；底色 `rgba(255,255,255,.96)` + 8px 模糊 |
| 首屏文案 | 上边距 16px；h1「漫画站」26/34；副标题 14/22（`--c-text-secondary`） |
| 标签条 | 上边距 16px；字段名「按标签逛」12/16 字距 .06em + `--c-text-muted`；chip 行 `flex-wrap:nowrap` + `overflow-x:auto`，滚动条隐藏，chip 高 44px、圆角 pill、间距 8px、内边距 16px；计数 13px |
| 分节标题 | 上 24 下 12；「全部漫画」19/26 + 「共 3 部」14/22（`--c-text-muted`） |
| 卡片网格 | **2 列**，`gap:12px`，左右留白 16px；卡片内边距 8px、圆角 14px、描边 1px + `--sh-sm`；封面 2:3（390px 下约 173×260）；标题 16/22 **固定两行高（44px）**保证同行对齐；作者 13/20；标签 chip 12/16 |
| `≤340px` | 退化为**单列横向卡**：封面固定 88px 宽在左，标题/作者/标签在右 |

**桌面 1280px（增强，实测内容高 1850px）**

一行头部：站点名 → 搜索框（`max-width:420px`，靠右）→ 导航「首页 / 筛选」；容器 1120px、左右留白 24px；首屏文案 h1 34/44、上边距 48px；标签条改为**换行**（不再横向滚动）；卡片栅格 `repeat(auto-fill, minmax(280px,1fr))`、`gap:24px`，1280px 下正好 **3 列**（每列约 341px，封面约 341×512）。

![首页 · 手机 390px](../design-preview/index-mobile.png)

![首页 · 桌面 1280px](../design-preview/index-desktop.png)

#### 组件清单

| 组件 | 位置 | 状态 | 交互 | 中文文案示例 |
| --- | --- | --- | --- | --- |
| `SiteHeader` | 吸顶 | 默认 / 滚动中吸顶 | 点站点名回首页；搜索框聚焦时描边变主色 + 3px 主色光晕 | 「漫画站」 |
| `SearchBox` | 吸顶头右侧 | 空 / 已填 / 聚焦 | 输入关键词回车提交 → `/?q=…`；手机上按钮在框内（不占第二行） | 占位符「搜索漫画名或作者」 |
| `HeroTitle` | 首屏 | — | 纯展示 | 「漫画站」/「示例数据练手的漫画阅读站」 |
| `TagFilter` | 首屏下方 | 未选 / 选中（`aria-pressed`） | 点标签 → `/?tag=…`；再次点同一标签取消；手机横向滚动、桌面换行 | 「按标签逛」「科幻 2」「冒险 1」「武侠 1」「悬疑 1」「都市 1」 |
| `SectionHeading` | 列表上方 | — | 纯展示 | 「全部漫画」「共 3 部」 |
| `ComicCard` | 网格 | 静置 / 悬停（桌面） | 整卡可点（一张卡片一个链接）→ `/comics/{slug}`；不显示阅读进度标记（Q14） | 标题「星海拾荒者」、作者「作者：林晚」、标签「科幻」「冒险」 |
| `ComicGrid` | 列表 | 2 列 / 3 列 / 1 列横向 | 栅格容器 | — |

#### 三种状态

| 状态 | 触发 | 视觉 | 文案 / 出路 |
| --- | --- | --- | --- |
| 加载中 | 首页数据未就绪 | 骨架卡 ×4：与真实卡片同款容器 + 2:3 封面骨架 + 两条文字骨架（宽 70% / 45%） | 无文字，纯骨架 |
| 空状态 | 一部漫画都没有（演示数据为空） | 48px 虚线插画块 + 标题 + 说明 + 次要按钮 | 「还没有可看的漫画」/「示例数据还没准备好，稍后回来看看。」/ 按钮「刷新页面」 |
| 错误状态 | 列表数据读取失败 | 28px 圆形错误角标（`--c-danger-soft` 底）+ 标题 + 说明 + 主按钮 + 次要按钮 | 「漫画列表加载失败」/「网络或数据服务暂时不可用，请稍后重试。」/「重试」「刷新页面」 |

三种状态只替换「全部漫画」卡片区，吸顶头、首屏文案与标签条保持不动。

![首页状态样张 · 手机 390px](../design-preview/index-states-mobile.png)

![首页状态样张 · 桌面 1280px](../design-preview/index-states-desktop.png)

### 5.2 列表 + 搜索 + 标签筛选（`/?q=…&tag=…`，与首页同一个视图）

预览：`docs/design-preview/comics.html`

> Q1：首页与列表是同一个路由。本页专门画「筛选/搜索已经生效」时的样子，供实现时对照 URL 驱动的状态。

#### 布局

**手机 390px（基准，实测内容高 1851px）**

| 区块 | 规格 |
| --- | --- |
| 吸顶头 | 与首页同款；搜索框**回填 `searchParams.q`**（预览里填的是「海」） |
| 标签条 | 与首页同款；选中 chip 用主色软底 + 主色文字 + 字重 600 + `aria-pressed="true"` |
| 已选条件摘要行 | 上边距 12px，可换行：字段名「已选条件」12/16 + 条件 chip（高 32px，**非交互**，仅展示）+ 右侧「清除筛选」按钮（44px 高、`--c-border-input` 描边） |
| 结果分节标题 | 「筛选结果」19/26 + 「共 1 部」14/22 |
| 卡片网格 | 与首页完全一致（2 列 / ≤340px 单列横向） |

**桌面 1280px（增强，实测内容高 1515px）**：容器 1120px、标签条换行、卡片 3 列；摘要行与结果标题靠左对齐。

![列表 + 搜索 + 标签筛选 · 手机 390px](../design-preview/comics-mobile.png)

![列表 + 搜索 + 标签筛选 · 桌面 1280px](../design-preview/comics-desktop.png)

#### 组件清单

| 组件 | 位置 | 状态 | 交互 | 中文文案示例 |
| --- | --- | --- | --- | --- |
| `SiteHeader` + `SearchBox` | 吸顶 | 已填关键词 | 改词再提交 → 替换 `q`，保留 `tag` | 输入框内容「海」 |
| `TagFilter` | 筛选区 | 选中 / 未选 | 点另一个标签 → 单选替换（Q3）；点已选标签 → 取消 | 「科幻 2」（选中态） |
| `FilterSummary` | 标签条下方 | 无筛选时隐藏 / 有筛选时显示 | 「清除筛选」清空 `q` 与 `tag`，回到全部 3 部 | 「已选条件」「关键词「海」」「标签「科幻」」「清除筛选」 |
| `SectionHeading` | 结果上方 | 计数随结果变化 | 纯展示 | 「筛选结果」「共 1 部」 |
| `ComicCard` | 网格 | 同首页 | 整卡可点 | 「星海拾荒者」「作者：林晚」「科幻」「冒险」 |

#### 三种状态

| 状态 | 触发 | 视觉 | 文案 / 出路 |
| --- | --- | --- | --- |
| 加载中 | 筛选结果未就绪 | 骨架卡 ×2（与真实卡同尺寸），计数位置留白 | 无文字，纯骨架 |
| 空状态 | 关键词 + 标签组合命中 0 条（F2-9） | 虚线插画块 + 标题 + 说明 + **两个**次要按钮并排 | 「没有找到匹配的漫画」/「试试换个关键词，或点掉「科幻」标签看看全部作品。」/「清除关键词」「清除筛选」 |
| 错误状态 | 结果读取失败 | 与首页同款错误块；**保留已选条件** | 「筛选结果加载失败」/「网络或数据服务暂时不可用，请稍后重试。」/「重试」「清除筛选」 |

空状态必须保留输入框里的关键词与条件摘要 —— 用户要能看清是**哪个条件**导致的 0 条（G2）。

![列表状态样张 · 手机 390px](../design-preview/comics-states-mobile.png)

![列表状态样张 · 桌面 1280px](../design-preview/comics-states-desktop.png)

### 5.3 漫画详情（`/comics/[slug]`）

预览：`docs/design-preview/detail.html`

#### 布局

**手机 390px（基准，实测内容高 2687px）**

| 区块 | 规格 |
| --- | --- |
| 顶部条（`sticky`） | 56px 单行：返回（44×44，含「‹」图标 + 站点名「漫画站」）+ 分隔「/」+ 当前漫画名（14/22，`--c-text-secondary`，超长省略号）—— 这就是手机上的简化面包屑 |
| 详情头部 | **垂直结构**：大封面居中（`width:min(58vw,220px)`、2:3、圆角 14、`--sh-md`）→ 标题 22/30 居中 → 作者「作者：林晚」14/22 → 标签 chip ×2（12/16）→ 简介 14/22 左对齐 |
| 阅读记录卡 | 底色 `--c-bg-subtle`、圆角 14、内边距 16；字段名 12/16 + 主值 16/22 加粗 + 说明 13/20 + 两个文字按钮（44px 高、`--c-border-input` 描边） |
| 主 CTA | **吸底固定**：整宽按钮，高 56px、字号 16px、主色底；底栏内边距 `10px var(--gutter) calc(10px + env(safe-area-inset-bottom,0px))`，顶部 1px 分隔线 + 上投影；正文底部预留 `76px + safe-area`，滚到底不被盖住 |
| 话列表 | 标题行「话列表 共 5 话」（下边距 12px + 1px 分隔线）；条目 `min-height:56px`，整行可点：话序号（14/22 加粗、固定 64px 宽）+ 话标题（16/26）+「读到此」角标（12/16，主色软底）+ 右侧箭头 |

**桌面 1280px（增强，实测内容高 1842px）**

两列栅格 `240px + 1fr`（列间距 32px）：左列 240px 大封面；右列标题 30/38、作者、标签、简介、阅读记录卡、主 CTA。**主 CTA 不再吸底**，回到信息区（`max-width:320px`）。话列表挂在右列下方（`grid-row:2`），与标题同一条视线。

![详情 · 手机 390px](../design-preview/detail-mobile.png)

![详情 · 手机首屏（390×844 视口，看吸底主 CTA）](../design-preview/detail-mobile-viewport.png)

![详情 · 桌面 1280px](../design-preview/detail-desktop.png)

#### 组件清单

| 组件 | 位置 | 状态 | 交互 | 中文文案示例 |
| --- | --- | --- | --- | --- |
| `SiteHeader`（简化版） | 吸顶 | — | 「‹ 漫画站」回首页（G7）；右侧显示当前漫画名 | 「漫画站」「/」「星海拾荒者」 |
| `ComicDetailHeader` | 页首 | 静置 | 纯展示（封面图有 `alt`） | 标题「星海拾荒者」、作者「作者：林晚」、标签「科幻」「冒险」 |
| `ProgressCard` | 信息区 | 无记录 → 整卡隐藏；有记录 → 显示 | 「从第 1 话重读」→ 第 1 话第 1 页（**不改动**已有记录，F4-7）；「清除本机阅读记录」→ 删除本机记录并刷新入口状态（F4-8） | 「本机阅读记录」「第 3 话 · 第 6 页」「进度只保存在这台设备的浏览器里，清除浏览器数据会一起清掉。」 |
| `PrimaryCta` | 手机吸底 / 桌面内联 | 随进度切换文案 | 点按进入阅读页（有进度 → 记录页；无进度 → 第 1 话第 1 页） | 无进度「开始阅读」；有进度「继续阅读：第 3 话 第 6 页」；已读完「已读完，从头再读」（F6-7） |
| `ChapterList` | 页尾 | 每行静置 / 当前进度行带角标 | 整行可点 → `/comics/{slug}/{chapter}`（无进度从第 1 页开始） | 「第 1 话 起锚」「第 2 话 漂流的补给船」「第 3 话 三号环轨道」+ 角标「读到此」「第 4 话 无名船坞」「第 5 话 归航信号」 |

> 话列表只显示**话序号 + 话标题**，不显示页数、连载状态、阅读量（Q8）。

#### 三种状态（含主按钮变体）

| 状态 | 触发 | 视觉 | 文案 / 出路 |
| --- | --- | --- | --- |
| 加载中 | 详情数据未就绪 | 封面骨架 2:3 + 三条文字骨架 + 两条 56px 话列表骨架，尺寸与真实结构一致 | 无文字，纯骨架 |
| 内容不存在 | slug 在数据里查不到（F4-5） | 虚线插画块 + 标题 + 说明 + 「返回首页」次要按钮 | 「这部漫画不存在」/「链接可能被改过，回首页看看还有哪些作品。」 |
| 错误状态 | 详情读取失败 | 与首页同款错误块 + 两个出路 | 「漫画详情加载失败」/「网络或数据服务暂时不可用，请稍后重试。」/「重试」「返回首页」 |
| 主按钮变体 | 随本机进度切换 | 两个并排/堆叠样例 | 「开始阅读」/「继续阅读：第 3 话 第 6 页」 |

![详情状态样张 · 手机 390px](../design-preview/detail-states-mobile.png)

![详情状态样张 · 桌面 1280px](../design-preview/detail-states-desktop.png)

### 5.4 阅读页（`/comics/[slug]/[chapter]`，本期核心）

预览：`docs/design-preview/reader.html`

#### 布局

**手机 390px（基准，实测内容高 8986px = 10 页 × 520px + 下一话区块 + 第 4 话 2 页 + 收尾 + 状态区）**

| 区块 | 规格 |
| --- | --- |
| 顶部信息条（`sticky`） | 56px；底色 `rgba(21,24,29,.94)` + 8px 模糊 + 底部 1px `--r-border`；左「‹」返回（44×44）→ 详情；中间两行：漫画名 14/22 加粗（省略号）+ 「第 3 话 · 三号环轨道」12/16（`--r-text-muted`）；右「详情」文字按钮（44px 高） |
| 图片列 | **宽度 = 视口宽（全出血，左右 0 留白）**；页与页之间 **0 间距**，只有 1px `--r-border` 分隔线；每页 `aspect-ratio:3/4`（600×800）；页内居中：页码 20px 字距 .14em + 说明 12/16 |
| 当前阅读位置 | 第 6 页顶部一条整宽角标：`--r-accent-soft` 底 + 1px `--r-accent-border` + 主色文字 12/16 —— 让评审能看到「本机记录写在哪一页」 |
| 话末 + 接下一话 | 先一行「第 3 话 · 已读完」分隔线，再一个**整宽可点区块**：`min-height:72px`（>56px 硬指标）、`--r-surface` 底、上下 1px 描边、内边距 16px；左侧两行（「下一话 · 第 4 话」12/16 主色 + 标题 17/24 加粗）、右侧「继续阅读」+ 箭头 |
| 接续区 | 第 4 话标题块（「第 4 话」12/16 主色 + 「无名船坞」20/28）+ 第 4 话页块，**与第 3 话在同一条滚动流里**，不新开滚动容器 |
| 最后一话收尾 | 居中卡：标题 20/28 + 说明 14/22 + 「返回详情」（主色按钮 44px）「回到顶部」（描边按钮 44px） |
| 底部固定进度条 | 整宽固定：顶部 1px `--r-border`、3px 进度轨道（`rgba(255,255,255,.14)`）+ 主色填充；下面是 52px 文字行：「**第 3 话** · 第 6 页 / 共 10 页」13/20 + 右侧「回到顶部」（44px 高）；底栏 `padding-bottom: env(safe-area-inset-bottom,0px)` |
| 不遮挡画面 | `body` 底部预留 `52px + safe-area`（= 底栏高度），滚动到任何位置进度条都不压住页面内容 |
| 滚动行为 | `overscroll-behavior-y:contain`（不做滚动穿透、不误触下拉刷新）；`viewport-fit=cover` + `env(safe-area-inset-*)` 处理刘海与下巴 |
| 沉浸阅读 | 向下滚动超过 4px 且已滚过 80px → 顶栏 `translateY(-100%)` 收起（0.2s）；向上滚动超过 4px → 显示；**点按画面 → 显示** |

**桌面 1280px（增强，实测内容高 13324px）**：只有一处变化 —— 图片列改成 **720px 居中定宽**（`--reader-col`），其余（深色域、1px 分隔线、底部进度条、接续逻辑）完全一致，不重新发明布局。

![阅读页 · 手机 390px](../design-preview/reader-mobile.png)

![阅读页 · 手机首屏（390×844 视口：顶栏 + 全出血页图 + 底部进度条）](../design-preview/reader-mobile-viewport.png)

![阅读页 · 桌面 1280px](../design-preview/reader-desktop.png)

#### 组件清单

| 组件 | 位置 | 状态 | 交互 | 中文文案示例 |
| --- | --- | --- | --- | --- |
| `ReaderTopBar` | 顶部吸顶 | 显示 / 收起（滚动方向驱动） | 「‹」回详情；点按画面显示 | 「星海拾荒者」「第 3 话 · 三号环轨道」「详情」 |
| `ReaderStrip` | 页列容器 | 首话直出 / 追加下一话 / 懒加载中 | 滚动驱动懒加载与预取；滚动停止 500ms 后写本机进度（Q6） | — |
| `RetryableImage` | 每一页 | 加载中 / 已加载 / 失败 | 失败就地把该页降级为虚线卡 + 「重试这一页」，其余页与后续页照常可读（Q12）；图片 `alt` = 「第 3 话 第 6 页」 | 失败文案「第 3 话 · 第 6 页加载失败」「这一页暂时取不到，可以先往下读。」 |
| `ChapterNextBlock` | 话末 | 可点 / 加载中（56px 骨架） | 点按或继续向下滚动都进入下一话；顶栏与地址栏同步为第 4 话 | 「下一话 · 第 4 话」「无名船坞」「继续阅读」 |
| `ChapterEndCard` | 最后一话末尾 | — | 「返回详情」/「回到顶部」 | 「已是最后一话」「《星海拾荒者》到这里就读完了，可以回详情页挑别的作品。」 |
| `ReaderProgressBar` | 底部固定 | 随当前页更新 | `role="progressbar"`，`aria-valuenow` = 当前页；文字「第 x 话 · 第 y 页 / 共 10 页」 | 「第 3 话 · 第 6 页 / 共 10 页」「回到顶部」 |

#### 状态（阅读页没有「空列表」，它的空状态等价物是「这一话不存在」与「已是最后一话」）

| 状态 | 触发 | 视觉 | 文案 / 出路 |
| --- | --- | --- | --- |
| 加载中 | 该话数据未就绪 | 骨架页块 3:4（与真实页同比例）+ 「接下一话」区块先占 56px 骨架 | 「第 3 话正在加载……」 |
| 错误 ①：单张图片失败 | 某页图片请求失败（Q12） | 该页位置变成 3:4 虚线卡（`--r-surface-2` 底），**不改变整列高度** | 「第 3 话 · 第 6 页加载失败」「这一页暂时取不到，可以先往下读。」/「重试这一页」 |
| 错误 ②：整话加载失败 | 首话服务端直出失败（G4） | 28px 圆形错误角标 + 标题 + 说明 + 两个按钮（纵向堆叠） | 「这一话加载失败」「网络或数据服务暂时不可用，请稍后重试。」/「重试」「返回详情」 |
| 空状态等价物：这一话不存在 | 地址里的序号在数据里查不到（F5-9） | 同款错误块，图标换成「?」 | 「这一话不存在」「地址里的话序号可能被改过，回详情挑一话吧。」/「返回详情」 |

![阅读页状态样张 · 手机 390px](../design-preview/reader-states-mobile.png)

![阅读页状态样张 · 桌面 1280px](../design-preview/reader-states-desktop.png)

---

## 6. 状态与文案规范（跨页面）

| 通用规则 | 说明 |
| --- | --- |
| 每个状态都要有下一步动作 | 空状态给「清除关键词 / 清除筛选」，错误状态给「重试」+ 一条退路，内容不存在给「返回首页 / 返回详情」（G9） |
| 不出现空白页与错误堆栈 | 内容不存在走 404 页面（`not-found.tsx`），异常走错误边界（G3、G4） |
| 加载态只替换内容区 | 页头、吸顶头、筛选条保持可见，避免整页闪烁 |
| 骨架 = 真实结构 | 骨架块的圆角、比例、行数、行高与真实内容一一对应；不做「转圈代替骨架」 |
| 文案简体中文、句式一致 | 错误统一「……加载失败」+「网络或数据服务暂时不可用，请稍后重试。」；空状态统一「没有找到匹配的漫画」+ 一个具体建议 |
| 按钮动词开头 | 「重试」「刷新页面」「清除关键词」「清除筛选」「返回首页」「返回详情」「继续阅读」「开始阅读」 |

---

## 7. 无障碍与硬指标（可验证）

### 7.1 触控目标

| 规则 | 值 | 落在哪 |
| --- | --- | --- |
| 最小可点区域 | 44×44px | 搜索框与搜索按钮、标签 chip、清除筛选、文字按钮、导航链接、返回按钮 |
| 大目标 | ≥56px | 话列表条目、详情页吸底主按钮、「接下一话」区块（72px） |
| 相邻间距 | ≥8px | chip 之间、按钮之间、卡片之间（卡片 12px / 24px） |

**踩过的坑**：`<a>` 是行内元素，写 `min-height` 不生效（元素只有 23px 高）。所有既是按钮又用 `<a>` 的地方必须 `display:inline-flex; align-items:center; justify-content:center`。这个 bug 正是被 §7.6 的自检抓出来的（第一次运行报 `detail.html` / `reader.html` 不合格，修完复跑全绿）。

### 7.2 文字对比度（WCAG AA）

§3.1 / §3.2 已逐条给出实测值，结论：

- 全部信息型文字 ≥ 4.5:1（最低的一对是 `--c-text-muted` 压 `--c-bg-subtle` 的 4.81:1）；
- 按钮文字：`--c-on-primary` 压主色 5.18:1、`--r-on-accent` 压深色主色 9.31:1；
- 只有两处低于 4.5:1，且都是**非信息型**：禁用态文字 2.54:1（WCAG 1.4.3 对禁用控件豁免）、面包屑分隔符「/」（装饰）。

### 7.3 焦点可见

```css
:focus-visible { outline:3px solid var(--c-primary); outline-offset:2px; border-radius:6px; }
/* 深色阅读域换成亮色主色，落在图片块上也看得见 */
[data-theme="reader"] :focus-visible { outline-color: var(--r-accent); }
/* 搜索框用 focus-within：输入框本身没有描边，光晕给整个容器 */
.search:focus-within { border-color: var(--c-primary); box-shadow:0 0 0 3px var(--c-primary-soft); }
```

禁止 `outline:none`；禁止用「只改背景色」表示聚焦。

### 7.4 键盘顺序（Tab 序列）

| 页面 | 顺序 |
| --- | --- |
| 首页 | 站点名 → 搜索框 → 搜索按钮 → 标签 chip ×5 → 卡片 ×3 |
| 列表 | 站点名 → 搜索框 → 搜索按钮 → 标签 chip ×5 → 清除筛选 → 结果卡片 |
| 详情 | 返回（漫画站）→ 从第 1 话重读 → 清除本机阅读记录 → 主 CTA → 话列表 ×5（桌面最后是导航「首页」） |
| 阅读 | 返回 → 详情 → 接下一话区块 → 返回详情 → 回到顶部 → 底栏「回到顶部」 |

实现约定：卡片与列表条目都是原生 `<a>`（Enter 进入）；标签是 `<button aria-pressed>`（回车/空格切换）；不要把 `div` 当按钮。

### 7.5 非文本对比度与已知取舍

| 项 | 实测 | 结论 |
| --- | --- | --- |
| 浅色域交互控件描边（搜索框、次要按钮） `#7C8493` | 3.76:1 | ✅ ≥3:1（WCAG 1.4.11） |
| 深色域进度条填充 `#FF9E7A` 压 `#0B0D10` | 9.66:1 | ✅ |
| 选中态的表意 | 字重 600 + 主色底 + 主色描边 + `aria-pressed` | ✅ 不只靠颜色（1.4.1） |
| 错误态的表意 | 圆形「!」角标 + 标题文字 + 出路按钮 | ✅ 不只靠颜色 |
| 深色域次要按钮描边（原 `--r-border-strong`） | 4.25:1 | ✅ 已按 **D-011** 改为 `--r-border-control` = `#6E7683`（对 `--r-bg` 实测 4.25:1，满足 1.4.11）；`--r-border-strong` 只保留装饰用途 |
| 浅色域未选中 chip 描边 `--c-border-strong` | 1.61:1 | ⚠️ 同上，chip 有文字标签，靠文字识别 |
| 分隔线（1.24:1 / 1.37:1） | — | 装饰性，不承担识别功能 |

### 7.6 本任务跑过的自检（命令 + 结果）

```powershell
# 在仓库根目录执行：截图 + 三组硬指标自检（无 npm 依赖，用系统 Chrome 的 CDP）
node docs/design-preview/shots.mjs
```

**自检 1：无横向滚动**（判定 `scrollWidth ≤ 视口宽 + 1`，四个页面 × 四个宽度 = 16 条，全部通过）

| 页面 | 360px | 390px | 430px | 1280px |
| --- | --- | --- | --- | --- |
| `index.html` | 360 ✓ | 390 ✓ | 430 ✓ | 1280 ✓ |
| `comics.html` | 360 ✓ | 390 ✓ | 430 ✓ | 1280 ✓ |
| `detail.html` | 360 ✓ | 390 ✓ | 430 ✓ | 1280 ✓ |
| `reader.html` | 360 ✓ | 390 ✓ | 430 ✓ | 1280 ✓ |

**自检 2：可点区域 ≥44×44**（390px 视口，遍历页面里所有 `a` / `button` / `input`）

| 页面 | 可点元素 | 最小宽 × 最小高 | 结论 |
| --- | --- | --- | --- |
| `index.html` | 14 | 44 × 44 | ✓ |
| `comics.html` | 14 | 44 × 44 | ✓ |
| `detail.html` | 14 | 80 × 44 | ✓ |
| `reader.html` | 10 | 44 × 44 | ✓ |

**自检 3：卡片栅格几何与圆角**（读 `getComputedStyle(.cards).gridTemplateColumns` 与首卡尺寸）

| 页面 | 320px | 360px | 390px（主基准） | 1280px |
| --- | --- | --- | --- | --- |
| `index.html` | 1 列 × 288px（横向卡，封面 88×132） | 2 列 × 158px | 2 列 × 173px；首卡 173×355、封面 155×233（2:3） | 3 列 × 341px；封面 315×473 |
| `comics.html` | 同上 | 2 列 × 158px | 2 列 × 173px | 3 列 × 341px |

圆角核对：所有页面卡片 `border-radius` = 14px、封面 = 10px（对应 `--rad-md` / `--rad-sm`）。

**这三组自检不是摆设，各自抓到过一个真实缺陷**（都已修复并复跑全绿）：

1. 自检 2 发现：用 `<a>` 当按钮时 `min-height` 不生效，吸底主 CTA 只有 23px 高 → 改 `display:inline-flex`；
2. 自检 3 发现：批量改令牌名时圆角令牌被写成残缺的 `--rad-`（CSS 变量名不合法，于是最后一条声明 999px 生效），卡片和封面全变成胶囊形 → 逐个补回 `--rad-xs/sm/md/lg/pill`；
3. 截图复核发现：手机视口里 `position:fixed` 的吸底元素在**整页截图**中会被画到页面中部 → 补拍 390×844 的视口截图作为「固定元素位置」的依据。

**对比度**：用 Node 按 WCAG 2.1 相对亮度公式实测（脚本一行命令，输出逐对贴在本节 7.2 与 §3 的表格里）。抽样输出：

```
#14171F on #FFFFFF = 17.92:1     #666D7A on #FFFFFF = 5.21:1
#FFFFFF on #C2410C = 5.18:1      #9A3412 on #FDF1EA = 6.59:1
#ECEEF1 on #0B0D10 = 16.74:1     #FF9E7A on #0B0D10 = 9.66:1
#A9B0BA on #0B0D10 = 8.90:1      #101215 on #FF9E7A = 9.31:1
```

> 尚未验证的部分（留给实现期 E2E）：Safari / iOS Safari 上的真实 `env(safe-area-inset-bottom)` 取值、200% 缩放下触控目标是否重叠、屏幕阅读器朗读顺序。这三条已写进 §10 的实现注意事项。

---

## 8. 移动端细则（D-009 落地）

### 8.1 各宽度下的行为

| 视口宽 | 定位 | 卡片列数 | 页面留白 | 标签条 | 阅读页图宽 | 详情页主 CTA |
| --- | --- | --- | --- | --- | --- | --- |
| 360px | 最小支持宽度（必须无横向滚动） | 2（≤340 才单列） | 16px | 横向滚动 | 全出血 360px | 吸底 |
| 390px | **主设计基准**（截图基准） | 2 | 16px | 横向滚动 | 全出血 390px | 吸底 |
| 430px | 大屏手机 | 2 | 16px | 横向滚动 | 全出血 430px | 吸底 |
| 431–767px | 大手机 / 小平板 | 2 | 16px | 横向滚动 | 全宽 | 吸底 |
| 768–1023px | 桌面档起点 | 2（min 280px） | 24px | 换行 | 720px 居中 | 内联 |
| ≥1024px | 桌面增强 | 3（容器 1120px） | 24px | 换行 | 720px 居中 | 内联 |

### 8.2 手机专属细节

| 项 | 做法 | 为什么 |
| --- | --- | --- |
| 安全区 | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` + `env(safe-area-inset-bottom, 0px)` | 详情吸底 CTA 与阅读底栏要给「下巴」留白，否则按钮压在手势条上 |
| 输入框字号 | `font-size:16px` | iOS Safari 对 <16px 的输入框会自动放大整页 |
| 图片不跳动 | `aspect-ratio` 容器 + 骨架同比例 + 卡片标题固定两行高 | 对应 F5-12：图片从加载中到完成，已渲染内容不位移 |
| 横向滚动容器 | `overflow-x:auto` + `scrollbar-width:none` + `::-webkit-scrollbar{display:none}` + `overscroll-behavior-x:contain` | 标签条能滑，但不给页面添横向滚动条，也不把滑动传给页面 |
| 滚动穿透 | 阅读页 `overscroll-behavior-y:contain` | 滚到底继续滑不会触发下拉刷新/页面橡皮筋 |
| 沉浸阅读 | 向下滚 >4px 且 y>80 收起顶栏；向上滚 >4px 或点按画面显示 | 把竖屏高度让给画面 |
| 触控反馈 | 卡片/条目悬停底色只在 `hover` 生效，移动端不依赖 hover | 手机上不存在 hover 状态 |

---

## 9. 截图索引（18 张，全部来自 `node docs/design-preview/shots.mjs`）

命名规则：`{页面}-{宽度或区块}.png`；手机 = 390px（主基准，2 倍像素密度），桌面 = 1280px（2 倍）。`reader-mobile.png` / `reader-desktop.png` 两张整页图因为页面过长（8986 / 13324 CSS px）分别降到 1.5 倍 / 1 倍，避免单张 PNG 到 2~3MB；这两页的细节看状态样张与视口截图（均为 2 倍）。

| 文件 | 拍的是 | PNG 尺寸 | 用来看什么 |
| --- | --- | --- | --- |
| `index-mobile.png` | 首页整页 @390 | 780×5028 | 吸顶搜索、标签条横向滚动、2 列卡片、底部状态样张 |
| `index-desktop.png` | 首页整页 @1280 | 2560×3700 | 3 列卡片、容器 1120、标签条换行 |
| `index-states-mobile.png` | 首页状态区 @390 | 780×2658 | 加载中 / 空 / 错误三种状态 |
| `index-states-desktop.png` | 首页状态区 @1280 | 2560×1524 | 同上，三列并排 |
| `comics-mobile.png` | 列表整页 @390 | 780×3702 | 关键词回填、选中 chip、条件摘要、结果卡片 |
| `comics-desktop.png` | 列表整页 @1280 | 2560×3030 | 同上，桌面布局 |
| `comics-states-mobile.png` | 列表状态区 @390 | 780×2104 | 空状态的两个清除入口 |
| `comics-states-desktop.png` | 列表状态区 @1280 | 2560×988 | 同上 |
| `detail-mobile.png` | 详情整页 @390 | 780×5374 | 大封面垂直头部、阅读记录卡、话列表角标 |
| `detail-mobile-viewport.png` | 详情首屏 @390×844 视口 | 780×1688 | **吸底主 CTA 的真实位置** |
| `detail-desktop.png` | 详情整页 @1280 | 2560×3684 | 两列布局、CTA 回到信息区 |
| `detail-states-mobile.png` | 详情状态区 @390 | 780×2650 | 加载中 / 不存在 / 失败 / 主按钮变体 |
| `detail-states-desktop.png` | 详情状态区 @1280 | 2560×1550 | 同上，2×2 排布 |
| `reader-mobile.png` | 阅读页整页 @390 | 585×13479 | 全出血页列、1px 分隔线、当前页角标、接下一话、最后一话 |
| `reader-mobile-viewport.png` | 阅读页首屏 @390×844 视口 | 780×1688 | **顶栏 + 页图 + 底部 3px 进度条** 的真实位置 |
| `reader-desktop.png` | 阅读页整页 @1280 | 1280×13324 | 720px 居中列、其余规则与手机一致 |
| `reader-states-mobile.png` | 阅读页状态区 @390 | 780×3794 | 加载中 / 单页失败 / 整话失败 / 这一话不存在 |
| `reader-states-desktop.png` | 阅读页状态区 @1280 | 2560×2046 | 同上，2×2 排布 |

> 为什么还要两张「视口截图」：无头浏览器截整页时，`position:fixed` 的底栏会被画在页面中部。**固定/吸底元素的位置以 `*-mobile-viewport.png` 为准**，整页图用来看整体结构与长列表。

---

## 10. 实现注意事项（交给全栈工程师）

1. **令牌集中**：所有色值、字号、间距只写在 `src/app/globals.css`（单写者文件）的 `@theme` 里；组件里出现裸十六进制颜色或 Tailwind 默认调色板（`gray-500`、`orange-600`）都算不合格（D-006，列入质量评审）。
2. **两域一套语义令牌**：预览稿为了评审直观，用 `--c-*` / `--r-*` 并列展示两套原始色板；**实现时把它们映射到同一组语义令牌**（`--color-bg` / `--color-text` / `--color-surface` / `--color-border` / `--color-accent` / `--color-on-accent`），阅读页容器加 `data-theme="reader"` 覆盖取值。这样同一份组件在浅色域与深色域都能用，不需要写两套样式（对应 `design.md` §9）。
3. **图片**：用 `next/image`，尺寸来自 `ImageRef.width/height`（`docs/contracts/types.ts`），配 `sizes` 按断点给；只有首屏前两张封面给 `priority`，页图首屏 1–2 张 `eager`，其余 `lazy`。
4. **骨架与真实块共用尺寸类**：骨架不写死 px，复用同一套 `aspect-ratio` 与行高，否则会出现「加载完页面跳一下」。
5. **进度条语义**：`role="progressbar"` + `aria-valuemin/valuemax/aria-valuenow`（当前页 / 总页数），文字部分用 `aria-live="off"` 避免朗读噪音，翻话时再更新。
6. **顶栏收起**：滚动方向 + `requestAnimationFrame` 节流，阈值 4px / 起点 80px；只改 `transform`，不改布局属性（避免重排）。
7. **吸底元素**：`position:fixed` + `padding-bottom: env(safe-area-inset-bottom, 0px)`，正文加等高的底部内边距（详情 76px、阅读 52px + safe-area），保证内容不被遮挡。
8. **横向滚动容器**：见 §8.2；容器自身滚，页面不滚。
9. **Copy 集中**：空/错误/按钮文案放一个常量文件（如 `src/lib/copy.ts`），同一句话只写一次（G9 要求全站一致）。
10. **键盘与语义**：原生 `button`/`a`；标签用 `aria-pressed`；当前导航用 `aria-current="page"`；图片 `alt` 规则 —— 封面「封面：{标题}」，页图「第 x 话 第 y 页」。
11. **加载/错误状态的落点**：路由级 `loading.tsx` 用骨架（对应 §6 的「只替换内容区」），`error.tsx` 用错误块 + 重试，`not-found.tsx` 用「内容不存在」块。
12. **单写者提醒**：`globals.css`、`layout.tsx`、`next.config.mjs` 同一时刻只允许一个角色改（AGENTS.md 硬规则 2）；本规格里的令牌改动属于 `globals.css`，改之前先跟架构师对齐。

---

## 11. 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-09-25 | 初稿（T-002 第 3 次派发，移动端优先重设计）：浅色/深色两套色板与全部设计令牌、令牌 → Tailwind 映射、4 个页面在 390px / 1280px 下的布局规格与组件清单、三态样张（阅读页另含单张图片失败态）、无障碍硬指标（含实测对比度与两组自检结果）、18 张截图索引、实现注意事项。作废第 1 次派发的桌面优先预览。 |
| v1.0.1 | 2026-09-25 | 按架构师裁决 **D-011**：新增可交互控件描边令牌 `--r-border-control` = `#6E7683`（4.25:1），`--r-border-strong` 降为纯装饰用途；§7.5 的「已知取舍」随之关闭。实现侧对应 `--color-line-control`。 |
