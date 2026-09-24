# 运维手册（ops.md）

| 字段 | 内容 |
| --- | --- |
| 版本 | v1.0 |
| 日期 | 2026-09-25 |
| 作者 | 运维工程师（会话「漫画站-运维」） |
| 上游依据 | `docs/specs/design.md` §13（部署与环境）、§14（风险）、D-017（404 流式 200）、`docs/specs/prd.md` v1.1 G 系列、`docs/contracts/routes.md`、`docs/tasks/T-010.md` |
| 适用阶段 | 范围 B MVP（无数据库、无密钥、单应用） |
| 当前状态 | CI 已就绪并本地验证通过；**真实 Vercel 部署被阻塞**（本机无 Vercel CLI、无登录凭据），部署与回滚步骤已写好并做了本地等价演练 |

本文件回答四件事：**要配什么（环境变量）**、**怎么跑起来（本地/CI）**、**怎么发布与回滚**、**出事去哪看日志**。

---

## 1. 部署视角下的项目画像

| 项 | 现状 | 对运维的意义 |
| --- | --- | --- |
| 形态 | 单个 Next.js 15 应用（App Router），前端页面 + 一个 Route Handler 都在里面 | 一次构建、一次部署，没有前后端分别发布的顺序问题 |
| 数据 | 仓库内文件：`data/comics.ts`（元数据）+ `public/comics/**/*.svg`（占位图） | **无数据库、无迁移、无备份对象**；回滚不涉及数据 |
| 状态 | 无服务端状态；阅读进度存在浏览器 localStorage | 服务端可随时替换实例；缩容/重建不丢用户数据 |
| 密钥 | 无 | 没有密钥轮换、没有密钥泄漏面 |
| 渲染 | 首页/详情/阅读页均为动态渲染（ƒ），404 走 `_not-found` | 线上必须跑 Node 运行时，不能只用纯静态托管 |
| 部署目标 | Vercel（`design.md` §13）：main → 生产，其它分支/PR → 预览 | 生产与预览是两套独立 URL，互不影响 |

一句话：**这是运维成本最低的一类应用**——无状态、无数据迁移、无密钥。引入数据库或第三方服务时，本文件必须同步扩写「迁移与备份」一节。

---

## 2. 环境变量清单

### 2.1 本期必需变量

| 变量名 | 用途 | 本期取值 | 配在哪 |
| --- | --- | --- | --- |
| —— | —— | —— | —— |

**本期一个都不需要。** 数据在仓库里，没有数据库、没有第三方服务、没有密钥。这不是"还没写"，是这一版的真实情况；`.env.example` 保持为空也是同一原因。

### 2.2 Vercel 自己注入的变量（不要手配）

Vercel 在构建与运行时自动注入一批只读变量，例如 `VERCEL_ENV`（`production` / `preview` / `development`）、`VERCEL_URL`、`VERCEL_GIT_COMMIT_SHA`、`VERCEL_GIT_COMMIT_REF`。它们**不需要**写进 `.env.example`，也不要手动在平台里覆盖。

### 2.3 规矩与新增流程

1. 只有 `NEXT_PUBLIC_` 前缀的变量会进浏览器包，**能看见就等于公开**，绝不往里放密钥。
2. 值只存在两处：本机 `.env.local`（已在 `.gitignore`）、平台的 Environment Variables。仓库、文档、任务单、回报里只允许出现**变量名**。
3. 新增一个变量的完整流程：
   - 在本文件 2.1 表格加一行（变量名 + 用途 + 取值来源）；
   - 在 `.env.example` 里加同名占位（只写名字，不写值）；
   - 在 Vercel 的 **Production 与 Preview 两个环境都配**（只配一个是常见事故）；
   - 改完让 CI 跑一遍：构建期读不到的变量会在 `pnpm build` 或页面运行时暴露出来。

---

## 3. 本地启动

### 3.1 标准流程

```bash
pnpm install --frozen-lockfile   # 只按锁文件装依赖
pnpm dev                         # 开发服务器 http://localhost:3000

# 想验证生产构建（部署前必做）
pnpm build && pnpm start         # 默认也是 3000，可用 -p 3210 换端口
```

Node 要求见 `package.json` 的 `engines`（`>=20.9.0`，当前开发环境 Node 22.17.1）。

### 3.2 本机（Windows）两个已知坑

这两个都不影响 CI，只影响本机开发，遇到了不用怀疑项目坏了：

**坑 1：`pnpm` 是运行时兜底的 shim，版本号会骗人。**
`pnpm -v` 报 `11.25.0`，但实际执行安装时用的是 **pnpm 10.24.0**（离线安装的输出里会写 `Done in 13.2s using pnpm v10.24.0`，`node_modules/.modules.yaml` 里也是 `packageManager: pnpm@10.24.0`）。CI 以 10.24.0 钉住，见 §4。

**坑 2：`pnpm <script>` 可能在跑脚本前先中止。**
报错形如：

```
[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY] Aborted removal of modules directory due to no TTY
```

原因是 pnpm 跑脚本前做了一次依赖预检，发现 `node_modules` 的安装器版本与当前 pnpm 版本号不一致，想删掉重装，但非交互终端不允许它删。两种绕过方式（都不需要改动仓库文件）：

```bash
pnpm --config.verify-deps-before-run=false run test   # 关掉预检，直接用现有 node_modules
# 或者把环境变量 CI 设为 true，让 pnpm 按非交互模式处理
```

---

## 4. CI

工作流文件：`.github/workflows/ci.yml`（job `verify`）。

| 项 | 取值 | 理由 |
| --- | --- | --- |
| 触发 | PR、push 到 main、手动 `workflow_dispatch` | 个人分支的 push 不刷屏，需要时手动点 |
| 并发 | 同分支/PR 取消旧运行 | 连续推送只留最新一次，省时间 |
| 权限 | `contents: read` | CI 不需要写仓库 |
| 运行环境 | `ubuntu-latest` + Node 22（Active LTS） | 与本机一致；`engines` 要求 `>=20.9.0` |
| pnpm | `10.24.0`（钉死） | 与生成 `pnpm-lock.yaml` 的安装器一致 |
| 缓存 | `actions/setup-node` 的 `cache: pnpm` | 键含锁文件哈希，锁文件变了缓存自动失效 |
| 步骤 | install `--frozen-lockfile` → type-check → lint → test → build | 便宜的检查先跑，最慢的 build 放最后 |
| 超时 | 15 分钟 | 正常一轮约 1～2 分钟，超时说明卡住了 |

### 4.1 本地复现同一串命令

```bash
pnpm install --frozen-lockfile
pnpm type-check && pnpm lint && pnpm test && pnpm build
```

### 4.2 本次在干净副本上实测的结果（2026-09-25，基线 `925baf6`）

```
pnpm install --frozen-lockfile --offline   → exit 0，Done in 13.2s using pnpm v10.24.0
                                             （提示 Ignored build scripts: esbuild, unrs-resolver，无害，见 §8）
pnpm type-check                            → exit 0
pnpm lint                                  → exit 0
pnpm test                                  → exit 0，Test Files 15 passed，Tests 139 passed
pnpm build                                 → exit 0，Next.js 15.5.26，Compiled successfully in 6.2s
```

### 4.3 E2E：默认关闭，怎么打开

`e2e` job 带着 `if: ${{ false }}`，每次都跳过——原因是 Playwright 首次要下载 Chromium/WebKit 二进制，冷启动多花 2～4 分钟，而本期 E2E 由 T-009 交付、合并进度还不确定。打开方式（三步）写在 `.github/workflows/ci.yml` 的注释里，简述：确认 `playwright.config.ts` 与 `e2e/` 已进主分支 → 删掉 `if: ${{ false }}`（或换成只在 PR/main 跑的条件）→ 本地先用 `pnpm exec playwright install --with-deps chromium webkit` 装浏览器再 `pnpm e2e`。

---

## 5. 部署到 Vercel

> **当前阻塞**：本机没有 Vercel CLI（`vercel` 不在 PATH），也没有登录凭据（`~/.vercel` 不存在）。所以本节是**可执行步骤**，不是已完成的记录。要真正跑通，需要下面 5.1 的凭据。

### 5.1 缺什么（找架构师/用户要）

| 需要的东西 | 用途 | 怎么给 |
| --- | --- | --- |
| Vercel 账号 + 团队（scope） | 项目归属 | 用户注册/邀请 |
| 把 Git 仓库接到 Vercel | 走 §5.2 路径 A | 网页授权 GitHub App |
| Vercel Token（无头环境用） | 走 §5.2 路径 B，或 CI 里执行部署 | `vercel login` 生成的 `~/.vercel`，或平台上的 `VERCEL_TOKEN` |
| **仓库根目录的确认** | 见下方注意 | 用户/架构师确认后我按结论设 Root Directory |

> **注意（必须先确认）**：当前 `git remote` 是 `https://github.com/lhx2960/workspace.git`，仓库名是 `workspace` 而不是 `comic-site`。如果这是"大仓里放多个项目"，Vercel 项目必须把 **Root Directory 设成 `comic-site`**，否则它会在仓库根找 `package.json` 而构建失败。若本项目其实该有自己的独立仓库，建议先拆 remote 再接入。

### 5.2 两条部署路径

**路径 A：Git 集成（推荐，符合 `design.md` §13）**

1. Vercel → Add New → Project → 选 `workspace` 仓库；
2. Root Directory 填 `comic-site`（若 §5.1 的确认结论是独立仓库则留空）；
3. Framework Preset 会自动识别为 Next.js；确认 **Install Command = `pnpm install --frozen-lockfile`**、**Build Command = `pnpm build`**、**Output Directory 留空**（Next 自己管 `.next`）；
4. Settings → **Node.js Version 选 22.x**（与 CI、本机一致）；
5. Environment Variables：本期**不配任何变量**（见 §2）；
6. 之后：push 到 `main` → 自动出生产部署；开 PR → 自动出预览部署，URL 会贴在 PR 上。

**路径 B：CLI 手动部署（临时验证或不经 Git 时）**

```bash
# 本机还没装 CLI，用 dlx 免安装；也可 npm i -g vercel 长期使用
pnpm dlx vercel login          # 交互式登录，生成 ~/.vercel
pnpm dlx vercel link           # 关联到目标项目
pnpm dlx vercel                # 预览部署
pnpm dlx vercel --prod         # 生产部署
pnpm dlx vercel ls --prod      # 看生产上有哪些部署（回滚时要用）
```

### 5.3 部署后冒烟检查（每条都已在本机对同一构建实测过）

本项目的 404 页面在流式渲染下会返回 **HTTP 200**（决策 D-017），所以**不能只看状态码**，要连 `<title>` 一起看。

```bash
BASE=https://<你的部署域名>
for u in / /comics/xinghai /comics/xinghai/1 /comics/xinghai/9; do
  printf '%s  %s  ' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$u")" "$u"
  curl -s "$BASE$u" | grep -o '<title>[^<]*</title>'
done
curl -s -o /dev/null -w 'API %{http_code}\n' "$BASE/api/comics/xinghai/chapters/2"
curl -s "$BASE/api/comics/xinghai/chapters/99"   # 期望 {"error":"not_found"}
```

本机实测的期望值：

| 请求 | 状态码 | `<title>` |
| --- | --- | --- |
| `/` | 200 | `漫画站` |
| `/comics/xinghai` | 200 | `星海拾遗 · 漫画站` |
| `/comics/xinghai/1` | 200 | `星海拾遗 第 1 话 · 漫画站` |
| `/comics/xinghai/9`（不存在的话） | 200（D-017） | `内容不存在 · 漫画站` |
| `/api/comics/xinghai/chapters/2` | 200 | JSON，`{"comic":{"slug":"xinghai",...` |
| `/api/comics/xinghai/chapters/99` | 404 | `{"error":"not_found"}` |

判断技巧：**正常页面的 HTML 里也会出现一次「内容不存在」**（它是 RSC 载荷里 not-found 边界组件的定义，不是渲染结果），所以用字符串判断会误报——**看 `<title>` 才准**。

---

## 6. 回滚

### 6.1 生产回滚（Vercel，秒级）

Vercel 保留历史部署，回滚的本质是**把生产域名指回上一次好的部署**，不需要重新构建。

1. **先确认回滚点**：Dashboard → Deployments → 找上一个 `Ready` 且状态正常的 Production 部署；命令行等价 `vercel ls --prod`。
2. **执行**：在该部署右侧 ⋯ → **Promote to Production**；命令行等价 `vercel rollback <deployment-url>`（交互式确认）或 `vercel promote <deployment-url>`。
3. **验证**：把 §5.3 的冒烟清单再跑一遍；`vercel ls --prod` 里 URL 列应指向你选的那次部署。
4. **留痕**：在 `docs/reports/` 或当天的运维记录里写清楚「为什么回滚 / 回到哪个 URL / 冒烟结果」。

代码层面的回滚（慢，几分钟）：`git revert <坏提交>` → push → Vercel 自动重新构建。**只在需要让仓库状态与线上一致时用**，救火请优先用第 2 步。

本项目无数据库，回滚不涉及数据迁移；将来引入数据库后，必须补「向前兼容的迁移」约束，否则回滚代码会让旧代码遇到新表结构。

### 6.2 本地等价演练（2026-09-25 已执行）

Vercel 的 Promote 等价于「把服务切到另一份构建产物」。本机没有凭据，于是在 `%TEMP%` 的干净副本里用两份真实构建做了同样的切换：

| 步骤 | 命令要点 | 结果 |
| --- | --- | --- |
| 记下制品 A（= 线上旧版本） | `Get-Content .next/BUILD_ID` | `ah4ruBmt9DxjYk4vl1jb8` |
| 备份 A | `Copy-Item .next artifact-old -Recurse` | 106 个文件 |
| 模拟新部署，构建制品 B | `pnpm build` | `0YJaOoMSY6jz6FaPoA2Av` |
| 探测（在跑 B） | `next start -p 3210` 后请求静态清单与首页 | `/_next/static/B/_buildManifest.js` → **200**；`/_next/static/A/...` → **404**；首页 HTML 含 B 的 buildId |
| **回滚**：切回 A | 删 `.next` → `Move-Item artifact-old .next` | `.next/BUILD_ID = ah4ruBmt9DxjYk4vl1jb8` |
| 探测（在跑 A） | 重新 `next start -p 3210` | `/_next/static/A/...` → **200**；`/_next/static/B/...` → **404**；首页 HTML 含 A 的 buildId |

结论：**「换掉构建产物 → 重启服务」能让服务端真的回到旧版本**，与 Vercel Promote 是同一件事；生产上这一步由平台完成，无需重新构建。

> 演练中踩到的坑（写下来避免重复）：用 `next.CMD` 启动时 `Stop-Process` 只杀了 cmd 外壳，真正的 node 子进程仍占着端口，第二次探测会打到旧进程。**验证时务必按端口回收进程**（`Get-NetTCPConnection -LocalPort <port> -State Listen` 找到 PID 再杀），或直接用 `node node_modules/next/dist/bin/next start` 启动。

### 6.3 回滚决策表

| 症状 | 首选动作 |
| --- | --- |
| 新部署后页面报错 / 白屏 / 数据明显不对 | 立即 Promote 上一个 Ready 的生产部署（§6.1），先恢复再排查 |
| 构建阶段就失败（生产没变） | 不用回滚，GitHub Actions / Vercel Build Logs 看原因，修完重推 |
| 只有某个页面坏，其它正常 | 先回滚保稳定，再把坏页面当缺陷单处理 |
| 预览部署有问题 | 不影响生产，直接修；预览 URL 本来就是一次性的 |

---

## 7. 日志与监控

| 想看的 | 去哪看 |
| --- | --- |
| 构建日志（`pnpm build` 的输出、失败原因） | Vercel → 项目 → Deployments → 点某次部署 → **Build Logs** |
| 运行时日志（Route Handler 的报错、服务端异常） | Vercel → 项目 → **Logs** / 对应部署 → **Runtime Logs**，可按时间与路径过滤 |
| 访问量与真实用户性能 | Vercel → **Analytics** / **Speed Insights**（需在项目里开启，默认关闭） |
| 错误页上的「错误编号」 | 是 Next.js 的错误摘要（digest），拿它去 Runtime Logs 里搜同一条，能定位到服务端那次抛错 |
| CI 结果 | GitHub → 仓库 → **Actions** → 选一次运行；PR 页面底部也会显示检查结果 |
| 部署失败通知 | Vercel → 项目 Settings → Notifications，建议开启部署失败邮件 |

本期**没有接入第三方监控**（Sentry 之类）：没有真实用户、没有后端依赖、没有密钥要保护，引入错误聚合的收益小于它带来的依赖与配置成本。引入时机：有真实用户、或排查线上问题时需要跨会话聚合错误时，届时再评估。

排障顺序建议：**先看 Build Logs（构建期）→ 再看 Runtime Logs（运行期）→ 最后本地复现**。本地复现时记得用 `pnpm build && pnpm start`，`pnpm dev` 与生产构建的行为差异（尤其 404/流式渲染）会让你白找一轮。

---

## 8. 常见问题速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` | pnpm 脚本前的依赖预检想重装 `node_modules`，但非交互终端不批 | 用 `pnpm --config.verify-deps-before-run=false run <script>`，或设 `CI=true`（见 §3.2） |
| CI 上 `--frozen-lockfile` 失败 | 改了 `package.json` 但没提交 `pnpm-lock.yaml`，或 CI 的 pnpm 版本与锁文件不匹配 | 本地重跑 `pnpm install` 提交锁文件；确认 CI 里 pnpm 仍是 10.24.0 |
| 构建报 Node 版本不符 | Vercel 项目里 Node.js Version 没设成 22.x | Settings → Node.js Version 改 22.x |
| `Ignored build scripts: esbuild, unrs-resolver` | pnpm 10 默认不跑依赖的安装脚本 | **无害**：这两个包用平台可选依赖提供二进制，本期在本机关闭脚本的情况下 type-check / lint / test / build 全绿（见 §4.2）。真需要时用 `pnpm approve-builds`，但当前不需要 |
| 访问不存在的漫画/话，状态码却是 200 | 决策 D-017：流式渲染下 `notFound()` 已开始发送响应 | 本期接受；**冒烟用 `<title>` 判定**（见 §5.3），接真实内容前用路由组把 404 路径移出 Suspense 边界 |
| 图片不显示 | 占位图在 `public/comics/**`，属仓库内静态资源 | 确认构建产物里带上了 `public/`；将来改对象存储才需要配 `images.remotePatterns` |
| CI 卡住超时 | 通常是依赖下载慢或测试挂起 | 看是哪个 step；缓存命中后安装约 10 秒，明显超时说明网络或测试出了问题 |

---

## 9. 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-09-25 | 首版（T-010）：部署画像、环境变量清单（本期为空）、本地启动与本机两个坑、CI 说明与实测结果、Vercel 部署步骤（阻塞点：缺凭据）、回滚步骤 + 本地等价演练、日志与监控入口、故障速查 |
