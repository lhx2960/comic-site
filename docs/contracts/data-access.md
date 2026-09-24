# 契约：数据访问层 v1.0（冻结）

页面**只能**通过这组函数取数，不得直接 import `data/` 下的数据文件。实现放在 `src/lib/data/`。换数据源（文件 → Postgres）时只改实现，函数签名与语义不变。

## 函数签名

```ts
/** 首页/列表：按关键词与标签过滤，按 Comic.order 升序返回 */
function listComics(query: ComicQuery): Comic[];

/** 全部标签（去重、按中文名的拼音无关固定顺序 = 数据给定顺序） */
function listTags(): Tag[];

/** 详情页：拿一部漫画 + 话列表；slug 不存在返回 null */
function getComic(slug: ComicSlug): ComicDetail | null;

/** 阅读页：拿一话的页清单与前后话序号；漫画或话不存在返回 null */
function getChapter(slug: ComicSlug, chapter: number): ChapterDetail | null;
```

## 语义（必须逐条实现，测试按此断言）

| 规则 | 说明 |
| --- | --- |
| 关键词匹配 | `q` 先做 `trim()`；大小写不敏感；命中条件 = `title` 或 `author` **包含** `q`；空字符串等于没有关键词 |
| 关键词范围 | 不匹配标签名、不匹配简介（Q4） |
| 标签匹配 | `tag` 命中 `comic.tags` 中的任意一项即算命中；标签单选（Q3） |
| 组合 | `q` 与 `tag` 同时存在时取**交集**（F2-7） |
| 排序 | 按 `order` 升序；`order` 在示例数据中唯一 |
| 空结果 | 返回空数组，不抛错（页面显示空状态） |
| 不存在 | `null`（页面调用 `notFound()` 转 404，不抛未捕获异常） |
| 纯净性 | 函数无副作用、不读环境变量、不访问网络 |

## Route Handler 返回体（阅读页预取用）

`GET /api/comics/[slug]/chapters/[chapter]` 成功时返回 `ChapterDetail` 的 JSON；失败时按 `routes.md` 的状态码约定返回。

