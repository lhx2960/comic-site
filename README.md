# comic-site（漫画站）

用 Next.js 全栈实现的漫画站点。本项目同时是一次「多角色协作」的试点：产品、架构、全栈、测试、运维分工，**架构师会话是唯一入口**。

## 当前阶段

- 立项中：需求与设计未定稿，尚未创建 Next.js 工程
- 范围待定：**A** 纯静态 / **B** MVP 带轻后端（浏览、搜索、详情、阅读页）/ **C** 完整平台（账号、收藏、评论、付费）
- 技术栈：Next.js（App Router）+ TypeScript + Tailwind；部署目标 Vercel

## 目录结构

```
comic-site/
├─ AGENTS.md              # 项目协作约定（角色、硬规则、命令）
├─ docs/roles/            # 角色章程（架构师=调度台、产品、全栈、测试、运维）
├─ docs/specs/            # PRD 与设计文档（架构师产出）
├─ docs/contracts/        # 接口与数据契约（冻结后并行开发）
├─ docs/tasks/            # 任务单（派活的唯一载体）
├─ docs/reports/          # 任务回报与证据
└─ .worktrees/            # 并发开发用的隔离工作区（已 gitignore）
```

## 协作模型

1. 用户只与「架构师会话」对话；架构师拆解需求、写任务单、派活、收口。
2. 一次性任务（实现、评审）用子代理并行，同一时刻最多 3 个，禁止两个代理改同一目录。
3. 长期角色用会话投递：`codex queue --thread "漫画站-全栈" --message "任务单 docs/tasks/T-xxx.md，先读它再开工"`。
4. 每个任务收口走两阶段评审：规格合规 → 代码质量。
5. 三处必须用户点头：设计定稿、计划定稿、合并上线。

细节见 `AGENTS.md` 与 `docs/roles/架构师.md`。

## 命令（工程创建后以 package.json 为准）

`pnpm dev` / `pnpm build` / `pnpm test` / `pnpm e2e` / `pnpm type-check` / `pnpm lint`

## 运维（CI 与部署）

完整的运维手册在 [`docs/ops.md`](docs/ops.md)：环境变量清单、本地启动与常见坑、CI 说明、Vercel 部署步骤、回滚步骤、日志与监控入口。这里只放最常用的几条。

- **CI**：[`.github/workflows/ci.yml`](.github/workflows/ci.yml) 在 PR 与 push 到 `main` 时跑 `pnpm install --frozen-lockfile` → `type-check` → `lint` → `test` → `build`（Node 22 + pnpm 10.24.0）。E2E 默认关闭，打开方式写在文件注释里。
- **本地复现同一串检查**：`pnpm install --frozen-lockfile && pnpm type-check && pnpm lint && pnpm test && pnpm build`
- **环境变量**：本期**无需任何环境变量**（数据在仓库内，无数据库、无密钥）；`Vercel` 自己注入的变量不用手配。
- **部署**：目标 Vercel，`main` → 生产、PR → 预览；步骤见 `docs/ops.md` §5。**当前本机缺 Vercel CLI 与登录凭据，尚未真实部署过。**
- **回滚**：在 Vercel Dashboard 把生产指回上一次好的部署（`vercel rollback <url>`），秒级生效；步骤与本地等价演练见 `docs/ops.md` §6。
- **日志**：构建看 Build Logs，运行时看 Runtime Logs；错误页上的「错误编号」可直接拿去 Runtime Logs 搜。
