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
