/* =============================================================================
 * 本机阅读进度（localStorage）
 *
 * 层次：这是一个「只在浏览器端」的模块 —— 服务端没有 localStorage，而且读完就
 * 写、下次进来接着读是纯客户端行为。调用它的组件都带 "use client"。
 *
 * 关键设计：读取必须发生在组件挂载之后（useEffect）。服务端渲染时拿不到进度，
 * 若让首屏 HTML 直接带着「继续阅读：第 3 话 第 6 页」，客户端再按同样状态渲染，
 * 一旦两边不一致就是 hydration mismatch；所以约定「服务端渲染无进度版本，
 * 挂载后在 effect 里补上」，两边的第一次渲染永远一致。
 *
 * 契约（docs/contracts/storage.md）：key = comicsite:progress:v1；值 = ProgressMap
 * 的 JSON；损坏数据视为无进度并删除该键；写入异常（隐私模式、配额不足）吞掉。
 * ========================================================================== */

import type { ComicSlug, ProgressMap, ProgressRecord } from "@/types/comic";

/** 契约规定的键名；带 v1 是为了将来结构不兼容时换新键而不是迁移 */
export const PROGRESS_STORAGE_KEY = "comicsite:progress:v1";

/**
 * 进度变更事件：详情页上「阅读记录卡」与「话列表角标」是两个独立的客户端组件，
 * 清除记录后两边都要立刻变，所以写操作完成后广播一个自定义事件，各自重新读一次。
 * 用事件而不是共享状态，是为了不引入额外的 Context 文件（组件树由服务端页面拼装）。
 */
export const PROGRESS_CHANGED_EVENT = "comicsite:progress-changed";

/** SSR 期间没有 window；隐私模式下访问 localStorage 也可能抛错，两种情况都兜住 */
function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 记录是否结构合法：话与页都是从 1 开始的正整数，finished 是布尔，updatedAt 是字符串 */
export function isValidProgressRecord(value: unknown): value is ProgressRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Partial<ProgressRecord>;
  return (
    Number.isInteger(record.chapter) &&
    (record.chapter ?? 0) >= 1 &&
    Number.isInteger(record.page) &&
    (record.page ?? 0) >= 1 &&
    typeof record.finished === "boolean" &&
    typeof record.updatedAt === "string"
  );
}

/**
 * 读取整张进度表。
 * - 没有这个键 → 空表；
 * - JSON 解析失败、或解析出来不是对象（数组、字符串…）→ 删掉这个键，按无进度处理；
 * - 单条记录结构不对 → 丢掉这一条（例如手改过 localStorage 或旧版本结构）。
 */
export function listProgress(): ProgressMap {
  const storage = getStorage();
  if (!storage) {
    return {};
  }

  let raw: string | null = null;
  try {
    raw = storage.getItem(PROGRESS_STORAGE_KEY);
  } catch {
    return {};
  }
  if (raw === null) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeKey(storage);
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    removeKey(storage);
    return {};
  }

  const result: ProgressMap = {};
  for (const [slug, record] of Object.entries(parsed)) {
    if (isValidProgressRecord(record)) {
      result[slug] = record;
    }
  }
  return result;
}

/** 单部漫画的进度；没有记录（或记录损坏）返回 null */
export function readProgress(slug: ComicSlug): ProgressRecord | null {
  return listProgress()[slug] ?? null;
}

/**
 * 写入进度：同一部漫画只有一条记录，后写覆盖前写（契约「只增改进度」）。
 * 写入失败一律吞掉 —— 进度存不下不该让阅读中断。
 */
export function writeProgress(slug: ComicSlug, record: ProgressRecord): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    const next: ProgressMap = { ...listProgress(), [slug]: record };
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
    notifyChanged();
  } catch {
    // 隐私模式 / 配额不足：静默失败，阅读继续
  }
}

/** 清除单部漫画的记录，其它漫画的记录保持不动 */
export function clearProgress(slug: ComicSlug): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    const next: ProgressMap = { ...listProgress() };
    if (!(slug in next)) {
      return;
    }
    delete next[slug];
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
    notifyChanged();
  } catch {
    // 同上：清不掉也不报错
  }
}

/**
 * 组装一条记录。把「写入时刻」收在这里，阅读页只管调它，
 * 避免每个调用点各写一遍 new Date().toISOString()。
 */
export function createProgressRecord(
  chapter: number,
  page: number,
  finished = false,
): ProgressRecord {
  return { chapter, page, finished, updatedAt: new Date().toISOString() };
}

function removeKey(storage: Storage): void {
  try {
    storage.removeItem(PROGRESS_STORAGE_KEY);
  } catch {
    // 删不掉也无所谓：函数已经按「无进度」返回了
  }
}

/** 广播进度变更；在 SSR / 测试环境里 window 不存在时直接跳过 */
function notifyChanged(): void {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(PROGRESS_CHANGED_EVENT));
    }
  } catch {
    // 事件广播失败不影响进度已经写入的事实
  }
}
