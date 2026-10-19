# API 接口文档

Base URL（本地）：`http://localhost:3000`

所有接口都在 Next.js Route Handlers 中实现，运行时为 Node.js。

---

## 1. 鉴权与会话

当前没有账号系统，使用匿名 HttpOnly Cookie：

```http
Cookie: hdsid=<随机UUID>
```

- 首次调用 `GET /api/session`（或任意会创建会话的接口）时，服务端创建会话并返回 `Set-Cookie`。
- Cookie 属性：`HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`，生产环境加 `Secure`。
- 浏览器 `fetch` 使用 `credentials: 'same-origin'`。
- 文件接口也依赖该 Cookie；无 Cookie 或不属于当前会话的资源返回 404。
- 非浏览器客户端（curl/脚本）可以不带 Cookie 先调用 `/api/session`，保存响应中的 Cookie 再继续。

写请求会做同源校验：如果请求带 `Origin`，其 host 必须与 `Host` 一致，否则 403。没有 `Origin` 的脚本请求不受影响。

---

## 2. 通用错误格式

非 2xx 响应：

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "今日生成次数已用完（10 次）。请在明天再试，或先使用已有作品。",
    "retryable": false
  }
}
```

参数校验错误可能带 `details`：

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "请求参数不合法。",
    "retryable": false,
    "details": [
      { "path": "styleId", "message": "Invalid enum value" }
    ]
  }
}
```

### 错误码

| code | HTTP | 含义 |
|---|---|---|
| `BAD_REQUEST` | 400 | 请求体/参数不合法 |
| `UNAUTHORIZED` | 401 | 缺少会话（任务查询/文件） |
| `FORBIDDEN` | 403 | 跨站请求 |
| `NOT_FOUND` | 404 | 资源不存在或无权访问 |
| `UNSUPPORTED_IMAGE_FORMAT` | 400 | 非 JPEG/PNG/WebP |
| `INVALID_IMAGE` | 400 | 图片损坏/无法读取 |
| `IMAGE_DIMENSIONS_INVALID` | 400 | 宽高超出 16–12000 |
| `IMAGE_TOO_LARGE` | 413 | 文件 > 15MB 或像素 > 3600 万 |
| `QUOTA_EXCEEDED` | 429 | 每日额度用完 |
| `RATE_LIMITED` | 429 | 短时间请求过多 |
| `TASK_NOT_CANCELLABLE` | 409 | 任务已处理/已结束，无法取消 |
| `INVALID_LAYOUT` | 400 | 排版文档不合法 |
| `AI_NOT_CONFIGURED` | 503 | 未配置真实 AI 服务 |
| `AUTH_FAILED` | 502 | 供应商鉴权失败 |
| `ACCOUNT_NOT_ACTIVATED` | 502 | 模型/服务未开通 |
| `CONTENT_BLOCKED` | 422 | 供应商内容审核未通过 |
| `INVALID_INPUT` | 502 | 供应商拒绝图片/提示词 |
| `TIMEOUT` | 504 | 供应商超时 |
| `UPSTREAM_ERROR` | 502 | 供应商暂时不可用 |
| `RESULT_DOWNLOAD_FAILED` | 502 | 生成成功但下载结果失败 |
| `INVALID_RESPONSE` | 502 | 供应商返回结构异常 |
| `TASK_INTERRUPTED` | — | 任务记录中的错误码：服务重启导致中断 |
| `INTERNAL_ERROR` | 500 | 未预期错误 |

---

## 3. 数据类型

### Asset

```json
{
  "id": "8c3c0d7e-...",
  "kind": "source",
  "url": "/api/files/8c3c0d7e-...",
  "mime": "image/png",
  "width": 1024,
  "height": 796,
  "bytes": 997495,
  "createdAt": "2026-10-19T01:00:00.000Z"
}
```

`kind`：`source`（上传原图/裁剪副本）或 `generated`（AI 或 mock 结果）。

### Quota

```json
{
  "used": 0,
  "limit": 10,
  "remaining": 10,
  "globalUsed": 3,
  "globalLimit": 60
}
```

### Task

```json
{
  "id": "2942ad24-...",
  "status": "succeeded",
  "styleId": "watercolor",
  "styleName": "水彩手绘",
  "provider": {
    "id": "ark",
    "label": "火山方舟 Seedream",
    "isMock": false
  },
  "model": "doubao-seedream-5-0-flash-260915",
  "fidelity": "balanced",
  "composition": "sketchbook",
  "promptVersion": "handdrawn-2026-10-19.v3",
  "error": null,
  "result": { "id": "...", "kind": "generated", "url": "/api/files/...", "...": "..." },
  "costCents": 12,
  "createdAt": "2026-10-19T01:00:00.000Z",
  "updatedAt": "2026-10-19T01:00:20.000Z",
  "startedAt": "2026-10-19T01:00:01.000Z",
  "finishedAt": "2026-10-19T01:00:20.000Z"
}
```

失败时：

```json
{
  "status": "failed",
  "error": {
    "code": "CONTENT_BLOCKED",
    "message": "图片未通过内容安全审核，请更换照片后重试。",
    "retryable": false
  },
  "result": null
}
```

状态：`queued` / `processing` / `succeeded` / `failed` / `cancelled`。

### Work

```json
{
  "id": "af5decfe-...",
  "title": "未命名作品",
  "doc": {
    "version": 1,
    "ratio": "3:4",
    "canvas": {
      "width": 1200,
      "height": 1600,
      "background": "#FBF8F1",
      "texture": "paper"
    },
    "elements": []
  },
  "sourceAsset": { "...": "..." },
  "resultAsset": { "...": "..." },
  "styleId": "watercolor",
  "templateId": "single-poster",
  "providerId": "ark",
  "isMock": false,
  "thumbnailUrl": "/api/files/...",
  "createdAt": "2026-10-19T01:01:00.000Z",
  "updatedAt": "2026-10-19T01:01:00.000Z"
}
```

`doc` 的完整结构见 `src/lib/editor/types.ts`。服务端会拒绝比例/画布尺寸不一致、元素 ID 重复、图片素材不属于当前会话的文档。

---

## 4. 接口

### 4.1 获取/创建会话

```http
GET /api/session
```

响应 200：

```json
{
  "session": { "id": "..." },
  "quota": { "used": 0, "limit": 10, "remaining": 10, "globalUsed": 0, "globalLimit": 60 },
  "provider": {
    "id": "mock",
    "label": "演示图（非 AI）",
    "model": "mock-procedural-v1",
    "isMock": true,
    "supportsCancel": false
  },
  "aiConfigured": true,
  "estimatedCostCents": 12
}
```

如果未配置 Key 且不允许 mock，`provider` 为 `null`，`aiConfigured=false`。
`estimatedCostCents` 来自服务端 `AI_COST_CENTS_PER_IMAGE`，只用于界面参考；实际账单以供应商为准。

---

### 4.2 风格列表

```http
GET /api/styles
```

响应 200：

```json
{
  "styles": [
    {
      "id": "watercolor",
      "version": "2026-10-18.v1",
      "name": "水彩手绘",
      "subtitle": "透明色层 · 自然晕染",
      "description": "...",
      "medium": "彩色水彩画",
      "preview": { "base": "#FBF7EE", "wash": "#9DB7AE", "accent": "#D9A18A", "ink": "#5D6B63", "pattern": "wash" },
      "promptVersion": "handdrawn-2026-10-19.v3"
    }
  ],
  "promptVersion": "handdrawn-2026-10-19.v3"
}
```

`preview` 只用于前端 SVG 风格示意，不是 AI 结果。

---

### 4.3 上传图片

```http
POST /api/upload
Content-Type: multipart/form-data

file=<JPEG/PNG/WebP>
```

限制：

- 文件 ≤ 15MB（`MAX_UPLOAD_MB`）。
- 像素 ≤ 3600 万（`MAX_IMAGE_PIXELS`）。
- 宽高 16–12000。
- 仅 JPEG / PNG / WebP；HEIC/HEIF 需先转换。
- 限流：20 次/分钟/会话。

响应 201：

```json
{ "asset": { "id": "...", "kind": "source", "url": "/api/files/...", "...": "..." } }
```

服务端会读取 magic bytes 和图片尺寸，不信任客户端 MIME。

---

### 4.4 创建生成任务

```http
POST /api/generate
Content-Type: application/json

{
  "sourceAssetId": "...",
  "styleId": "watercolor",
  "fidelity": "balanced",
  "composition": "sketchbook",
  "idempotencyKey": "gen-<uuid>"
}
```

`styleId`：`watercolor` / `colored-pencil` / `pen-sketch`
`fidelity`：`faithful` / `balanced` / `artistic`（默认 `balanced`）
`composition`：`full` / `sketchbook`（默认 `full`）。`sketchbook` 要求主体以不规则边缘置于米白纸张，四周大面积留白，背景可概括；提示词不会自动添加日期、地点、签名或标题。生成完成后，服务端还会把 AI 结果缩小到 72% 并居中放到 `#FBF7EE` 纸张画布上，保证留白稳定出现。
`idempotencyKey`：8–128 位，字母/数字/下划线/连字符；同一次生成尝试应复用同一个 key。

行为：

- 同一 `(session, idempotencyKey)` 已存在时返回原任务，HTTP 200，不会重复扣额度。
- 新任务返回 202。
- 创建时预占每日额度。
- 任务在服务端进程内队列执行。

响应 202/200：

```json
{ "task": { "id": "...", "status": "queued", "...": "..." } }
```

限流：6 次/分钟/会话。

常见错误：`AI_NOT_CONFIGURED`、`QUOTA_EXCEEDED`、`NOT_FOUND`、`BAD_REQUEST`。

---

### 4.5 查询任务

```http
GET /api/tasks/{id}
```

响应 200：

```json
{ "task": { "...": "..." } }
```

- 仅返回当前会话的任务。
- `Cache-Control: no-store`。
- 前端每 1.5 秒轮询，终态停止。
- 任务不存在/无权访问：404。

---

### 4.6 取消任务

```http
POST /api/tasks/{id}/cancel
```

- 只有 `queued` 可以取消；取消后退回预占额度。
- `processing` 无法取消（Ark 同步调用不支持），返回 409 `TASK_NOT_CANCELLABLE`。
- 已成功/失败：409。
- 已取消：幂等返回当前任务。
- 限流：10 次/分钟/会话。

响应 200：

```json
{ "task": { "status": "cancelled", "...": "..." } }
```

---

### 4.7 作品列表

```http
GET /api/works
```

响应 200：

```json
{ "works": [ { "id": "...", "title": "...", "thumbnailUrl": "...", "updatedAt": "..." } ] }
```

- 仅当前会话、未软删除的作品。
- 按更新时间倒序，最多 50 条。

---

### 4.8 创建作品

```http
POST /api/works
Content-Type: application/json

{
  "title": "未命名作品",
  "doc": { "version": 1, "ratio": "3:4", "canvas": { "...": "..." }, "elements": [] },
  "sourceAssetId": "...",
  "resultAssetId": "...",
  "styleId": "watercolor",
  "templateId": "single-poster"
}
```

- `title`：1–80 字符。
- `doc`：必须通过调度文档 schema。
- 文档内引用的所有 `assetId`、`sourceAssetId`、`resultAssetId` 必须属于当前会话。
- 限流：60 次/分钟/会话。

响应 201：`{ "work": { ... } }`

---

### 4.9 获取作品

```http
GET /api/works/{id}
```

响应 200：`{ "work": { ... } }`
不存在/无权/已删除：404。

---

### 4.10 更新作品

```http
PATCH /api/works/{id}
Content-Type: application/json

{ "title": "新标题", "doc": { "...": "..." } }
```

- 至少提供一个字段。
- `doc` 同样会做 schema 与素材归属校验。
- 更新会覆盖当前 `doc_json`；没有历史版本。
- 限流：60 次/分钟/会话。

响应 200：`{ "work": { ... } }`

---

### 4.11 删除作品

```http
DELETE /api/works/{id}
```

- 软删除：写入 `deleted_at`，作品不再出现在列表/详情中。
- 素材文件不会立即删除；由 `npm run cleanup:apply` 按保留策略清理。
- 限流：60 次/分钟/会话。

响应 200：`{ "ok": true }`

---

### 4.12 读取文件

```http
GET /api/files/{assetId}
Cookie: hdsid=...
```

- 仅当前会话的资源；无 Cookie/无权返回 404。
- 返回原始字节，`Content-Type` 为图片 MIME。
- `Cache-Control: private, max-age=3600`。
- `X-Content-Type-Options: nosniff`。
- 不提供目录列表，不暴露服务器文件路径。

---

## 5. 限流与额度汇总

| 项目 | 默认值 | 可配置 |
|---|---|---|
| 上传 | 20 次/分钟/会话 | 代码内常量 |
| 生成 | 6 次/分钟/会话 | 代码内常量 |
| 取消 | 10 次/分钟/会话 | 代码内常量 |
| 作品写操作 | 60 次/分钟/会话 | 代码内常量 |
| 单会话每日生成 | 10 次 | `DAILY_LIMIT_PER_SESSION` |
| 全站每日生成 | 60 次 | `DAILY_LIMIT_GLOBAL` |
| 任务并发 | 2 | `TASK_CONCURRENCY` |
| 上传大小 | 15MB | `MAX_UPLOAD_MB` |
| 上传像素 | 3600 万 | `MAX_IMAGE_PIXELS` |

进程内限流在多实例部署时每实例独立；每日额度由 SQLite 事务保证。

---

## 6. curl 示例

```bash
# 1. 创建会话并保存 Cookie
curl -c cookies.txt http://localhost:3000/api/session

# 2. 上传
curl -b cookies.txt -c cookies.txt \
  -F "file=@photo.jpg;type=image/jpeg" \
  http://localhost:3000/api/upload

# 3. 创建任务（把 assetId 换成上一步返回值）
curl -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"sourceAssetId":"...","styleId":"watercolor","fidelity":"balanced","composition":"sketchbook","idempotencyKey":"gen-demo-001"}' \
  http://localhost:3000/api/generate

# 4. 查询任务
curl -b cookies.txt http://localhost:3000/api/tasks/<taskId>

# 5. 作品列表
curl -b cookies.txt http://localhost:3000/api/works
```
