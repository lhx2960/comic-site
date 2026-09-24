// @vitest-environment jsdom
/* =============================================================================
 * 本机阅读进度工具的单测（逐条对应 docs/contracts/storage.md）
 *
 * 这一层不渲染界面，只钉住「键名、结构、覆盖、隔离、损坏与写入失败」这些规则。
 * 用 jsdom 环境是因为 window.localStorage 只在浏览器语义下存在。
 * ========================================================================== */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PROGRESS_CHANGED_EVENT,
  PROGRESS_STORAGE_KEY,
  clearProgress,
  createProgressRecord,
  listProgress,
  readProgress,
  writeProgress,
} from "@/lib/progress";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("读写规则", () => {
  it("没有记录时返回 null 与空表", () => {
    expect(readProgress("xinghai")).toBeNull();
    expect(listProgress()).toEqual({});
  });

  it("写入后能读回，并且落在契约规定的键上", () => {
    writeProgress("xinghai", createProgressRecord(3, 6));

    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull();
    expect(readProgress("xinghai")).toMatchObject({ chapter: 3, page: 6, finished: false });
  });

  it("createProgressRecord 的 updatedAt 是 ISO 8601 字符串", () => {
    const record = createProgressRecord(1, 2, true);
    expect(record.finished).toBe(true);
    expect(record.updatedAt).toBe(new Date(record.updatedAt).toISOString());
  });

  it("同一部漫画后写覆盖前写（契约：只增改进度，只有一条记录）", () => {
    writeProgress("xinghai", createProgressRecord(1, 3));
    writeProgress("xinghai", createProgressRecord(3, 6));

    expect(readProgress("xinghai")).toMatchObject({ chapter: 3, page: 6 });
    expect(Object.keys(listProgress())).toEqual(["xinghai"]);
  });

  it("多部漫画互不干扰", () => {
    writeProgress("xinghai", createProgressRecord(2, 4));
    writeProgress("slow-cooking", createProgressRecord(1, 1));

    expect(readProgress("xinghai")).toMatchObject({ chapter: 2, page: 4 });
    expect(readProgress("slow-cooking")).toMatchObject({ chapter: 1, page: 1 });
  });

  it("清除只删除指定漫画，其他漫画保留（F4-8）", () => {
    writeProgress("xinghai", createProgressRecord(2, 4));
    writeProgress("slow-cooking", createProgressRecord(1, 1));

    clearProgress("xinghai");

    expect(readProgress("xinghai")).toBeNull();
    expect(readProgress("slow-cooking")).toMatchObject({ chapter: 1, page: 1 });
  });

  it("清除不存在的记录不报错", () => {
    expect(() => clearProgress("no-such-comic")).not.toThrow();
  });

  it("写入与清除都会广播变更事件（详情页两处入口靠它同步）", () => {
    const listener = vi.fn();
    window.addEventListener(PROGRESS_CHANGED_EVENT, listener);

    writeProgress("xinghai", createProgressRecord(1, 1));
    clearProgress("xinghai");

    window.removeEventListener(PROGRESS_CHANGED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("损坏与边界（契约：损坏数据视为无进度并删除；写入异常吞掉）", () => {
  it("JSON 解析失败：视为无进度，并删除损坏的键", () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, "{ 这不是 JSON");

    expect(readProgress("xinghai")).toBeNull();
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });

  it("解析出来不是对象（数组）：同样删除该键", () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, "[1,2,3]");

    expect(listProgress()).toEqual({});
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });

  it("单条记录结构不对时丢掉这一条，其它记录照常可用", () => {
    window.localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        xinghai: { chapter: "3", page: 6, finished: false, updatedAt: "x" },
        "slow-cooking": { chapter: 2, page: 2, finished: false, updatedAt: "2026-09-25T00:00:00.000Z" },
      }),
    );

    expect(readProgress("xinghai")).toBeNull();
    expect(readProgress("slow-cooking")).toMatchObject({ chapter: 2, page: 2 });
  });

  it("写入抛错（隐私模式 / 配额不足）时吞掉异常，不阻断调用方", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => writeProgress("xinghai", createProgressRecord(1, 1))).not.toThrow();
  });

  it("读取抛错时当作无进度，而不是让页面崩掉", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(readProgress("xinghai")).toBeNull();
    expect(listProgress()).toEqual({});
  });
});
