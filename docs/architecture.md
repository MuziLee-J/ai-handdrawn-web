# 架构说明

## 1. 目标与非目标

### 目标

- 一套代码同时服务桌面和手机浏览器。
- 照片上传、裁剪、三种手绘风格、真实 AI 图生图。
- 可编辑的中文海报排版与高清导出。
- 密钥只在服务端、匿名会话隔离、额度与幂等控制。
- 本地零外部基础设施即可运行和测试。

### 非目标（当前 MVP）

- 账号体系、跨设备同步、社区/支付。
- 多实例任务调度、Serverless 后台任务。
- 历史版本浏览、多人协作、自由画笔/图层蒙版。
- 视频生成（仅预留适配思路，未实现）。

---

## 2. 系统上下文

```text
┌──────────────────────────────────────────────────────────────┐
│ 浏览器（Desktop / Mobile）                                    │
│  Next.js Client Components                                    │
│  ├─ 上传/裁剪（react-easy-crop + Canvas）                     │
│  ├─ 风格选择 / 任务轮询                                       │
│  └─ Konva 排版编辑器 / 2× 导出                                │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS + HttpOnly 匿名 Cookie
                ▼
┌──────────────────────────────────────────────────────────────┐
│ Next.js 服务端（Node 运行时）                                 │
│  Route Handlers                                               │
│  ├─ session / upload / generate / tasks / works / files       │
│  ├─ 输入校验（zod、magic bytes、尺寸/像素）                   │
│  ├─ 匿名会话 / 同源校验 / 进程内限流                          │
│  ├─ 额度事务 / 幂等键                                         │
│  ├─ 进程内任务队列（并发 2）                                  │
│  └─ ImageProvider 适配层                                      │
│        │                                                      │
│        ├── SQLite（sessions/assets/tasks/works/usage）        │
│        ├── 本地文件（$DATA_DIR/files/uploads|generated）      │
│        └── 火山方舟 Seedream 4.0（HTTPS，服务端密钥）          │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 运行时分层

### 3.1 浏览器层

| 模块 | 职责 |
|---|---|
| `src/app/create` | 上传 → 裁剪 → 风格 → 构图（满版/手账留白）→ 保真度 → 提交任务 → 轮询结果 |
| `src/app/editor/[id]` | 读取作品文档、编辑、保存、导出 |
| `src/app/works` | 会话作品列表、打开、删除 |
| `src/components/upload` | 本地裁剪/旋转，上传裁剪副本 |
| `src/components/editor` | Konva Stage/Layer、Transformer、工具面板、图层 |
| `src/lib/client` | `fetch` 封装、错误对象、裁剪数学 |

客户端不持有任何模型密钥。浏览器只调用本站 `/api/*`。

### 3.2 服务端层

| 模块 | 职责 |
|---|---|
| `src/app/api/*` | HTTP 入口、会话、参数校验、响应格式 |
| `src/lib/server/session.ts` | 匿名 Cookie 会话 |
| `src/lib/server/assets.ts` | 图片校验、落盘、归属校验 |
| `src/lib/server/tasks.ts` | 任务创建、状态转换、额度预占/退回 |
| `src/lib/server/task-runner.ts` | 进程内队列、供应商调用、结果落盘 |
| `src/lib/server/works.ts` | 作品 CRUD、排版文档校验、资源归属 |
| `src/lib/server/storage.ts` | 本地文件路径与原子写入 |
| `src/lib/server/quota.ts` | 每日额度事务 |
| `src/lib/server/rate-limit.ts` | 进程内滑动窗口限流 |
| `src/lib/server/http.ts` | 统一 JSON/错误响应、同源校验 |
| `src/lib/ai/ark.ts` | 火山方舟请求/响应/错误映射 |
| `src/lib/ai/mock.ts` | 程序化演示图（明确非 AI） |

### 3.3 AI 适配层

统一接口（`src/lib/ai/types.ts`）：

```ts
interface ImageProvider {
  id: string;
  label: string;
  model: string;
  supportsCancel: boolean;
  isMock: boolean;
  generateStyledImage(input: StyledImageRequest): Promise<StyledImageResult>;
}
```

适配器负责：

- 把统一请求转换成供应商格式；
- 处理鉴权、超时、限流、内容审核、返回结构；
- 下载/解码结果并验证图片；
- 返回模型、尺寸、usage、请求 ID。

第一阶段只有 Ark 同步适配器和 mock。腾讯 TokenHub 适配器未实现，原因是国内 `hy-image-v3` 的完整请求字段需要在真实账号/控制台核实后才能写死，避免把错误接口伪装成可用实现。

---

## 4. 数据模型

SQLite 表定义在 `src/lib/server/db.ts`。

### sessions

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PK | 随机 UUID，写入 HttpOnly Cookie |
| `created_at` | TEXT | ISO 时间 |
| `last_seen_at` | TEXT | 最后访问时间 |

### assets

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PK | 资源 ID |
| `session_id` | TEXT FK | 归属会话 |
| `kind` | TEXT | `source` / `generated` |
| `storage_key` | TEXT | `uploads/<id>.<ext>` 或 `generated/<id>.<ext>` |
| `mime` / `width` / `height` / `bytes` | | 校验后的元数据 |
| `created_at` | TEXT | |

索引：`(session_id, created_at)`。

### tasks

| 字段 | 说明 |
|---|---|
| `id` | 任务 ID |
| `session_id` / `source_asset_id` | 归属与输入 |
| `style_id` / `style_version` / `prompt_version` | 可复现信息 |
| `provider` / `model` / `prompt` / `fidelity` / `composition` | 供应商与参数快照 |
| `status` | `queued` / `processing` / `succeeded` / `failed` / `cancelled` |
| `error_code` / `error_message` / `error_retryable` | 失败信息 |
| `result_asset_id` | 成功结果 |
| `provider_request_id` / `provider_usage_json` | 供应商追踪 |
| `cost_cents` | 参考费用 |
| `quota_reserved` | 额度是否仍处于预占状态 |
| `idempotency_key` | 与 `session_id` 组成唯一约束 |
| 时间字段 | `created_at` / `updated_at` / `started_at` / `finished_at` |

索引：`(session_id, created_at)`、`(status, updated_at)`、唯一 `(session_id, idempotency_key)`。

### works

| 字段 | 说明 |
|---|---|
| `id` | 作品 ID |
| `session_id` | 归属会话 |
| `title` | 1–80 字符 |
| `doc_json` | 排版文档 JSON |
| `source_asset_id` / `result_asset_id` | 素材引用 |
| `style_id` / `template_id` | 风格与模板 |
| `created_at` / `updated_at` / `deleted_at` | 软删除 |

### usage / global_usage

- `usage(session_id, day, used)`：单会话每日预占计数。
- `global_usage(day, used)`：全站每日预占计数。
- `day` 按 `Asia/Shanghai` 计算，避免 UTC 跨日错位。

### 关于版本

- 每次生成都会保留独立的 `task` 与结果 `asset`，不会覆盖之前的生成图片。
- 作品保存当前覆盖 `works.doc_json`，**没有历史版本表/版本浏览 UI**。
- 这是已知 P1 限制，不是“已完成的版本历史”。

---

## 5. 生成任务生命周期

```text
POST /api/generate
  │
  ├─ 校验会话、资源归属、风格、构图、保真度、幂等键
  ├─ 幂等键已存在？→ 直接返回原任务（200）
  ├─ 检查并预占每日额度（SQLite 事务）
  ├─ 创建 task = queued
  └─ enqueueTask(taskId) → 202

进程内队列
  │
  ├─ queued → processing（原子 UPDATE）
  ├─ 读取原图 → 构建提示词 → 调用 Ark
  ├─ 成功：下载结果 → 校验 → 存 generated asset
  │         → succeeded（quota_reserved=0，记录费用）
  ├─ 失败：failed（记录错误码/retryable，退回额度）
  └─ 取消：仅 queued 可取消 → cancelled（退回额度）

前端每 1.5s 轮询 GET /api/tasks/:id
```

### 状态规则

- 供应商是同步接口，因此没有远端 task ID；`processing` 表示服务端已发送请求。
- Ark 不支持取消已发送的生成请求；`processing` 时取消返回 409 `TASK_NOT_CANCELLABLE`。
- 失败不自动重试，避免重复计费；用户点击“重新生成”会创建新任务并再次确认费用。
- 服务重启后，超过 `STALE_TASK_MINUTES` 的 queued/processing 任务会被标记为 `TASK_INTERRUPTED` 并退回额度。

### 额度

- 创建任务时预占；成功消费；失败/取消退回。
- 单会话和全站额度都在同一事务内检查，避免并发绕过。
- 每日重置按中国时区。

### 幂等

- 前端为每次生成尝试生成 `idempotencyKey`。
- 服务端唯一约束 `(session_id, idempotency_key)`。
- 网络超时后重复提交同一 key 不会创建第二个付费任务。
- “重新生成”必须使用新 key，并在 UI 中提示可能再次计费。

---

## 6. AI 请求设计

### 6.1 Ark 请求

```http
POST https://ark.cn-beijing.volces.com/api/v3/images/generations
Authorization: Bearer <ARK_API_KEY>
Content-Type: application/json

{
  "model": "doubao-seedream-5-0-flash-260915",
  "prompt": "<统一基础提示词 + 风格片段 + 保真度片段 + 构图片段>",
  "image": "data:image/jpeg;base64,...",
  "size": "<按原图比例计算的 2K 级显式宽高>",
  "response_format": "url",
  "watermark": false
}
```

- 原图从本地读取后 Base64 编码发送，避免把本地文件暴露成公网 URL。
- Seedream 5.0 Flash / 5.0 Pro 不支持 `sequential_image_generation`，适配器按模型自动省略；4.x 与 5.0 lite 发送 `disabled`。
- 输出尺寸由 `src/lib/ai/size.ts` 计算，满足 Ark 的像素/宽高比限制。
- 结果 URL 24 小时有效，服务端立即下载并保存为本地 `generated` asset。
- 不发送模型不支持的参数（如伪造的 `image_strength`、`negative_prompt`）。

### 6.2 提示词系统

`src/lib/ai/prompt.ts`：

- 基础提示词：保留主体、构图、空间关系、光影与关键细节。
- 风格片段：水彩/彩铅/钢笔各自的媒介、笔触、纸张、避免项。
- 保真度片段：faithful / balanced / artistic 三档。
- 构图片段：`full`（满版）或 `sketchbook`（手账留白）。留白模式要求主体以不规则手绘边缘置于米白纸张、四周大面积留白，背景可概括，并明确不自动生成日期、地点、标题、签名或边框。
- 留白排版：`src/lib/ai/composition.ts` 在 `sketchbook` 模式下把 AI 结果缩小到 72%，居中放到 `#FBF7EE` 纸张画布上。图片内容仍完全来自 AI；这一步只保证产品里的留白构图稳定出现。
- 版本号：`PROMPT_VERSION` 与每种风格的 `version` 写入任务，便于复现。
- 不包含旅行、美食、人物等题材硬编码；风格与构图可应用于任意题材。
- 明确要求不生成文字/签名/水印；中文文字由排版模块绘制。

---

## 7. 排版文档与导出

### 7.1 文档结构

`src/lib/editor/types.ts`：

```ts
interface EditorDoc {
  version: 1;
  ratio: '3:4' | '4:3' | '1:1';
  canvas: {
    width: number;
    height: number;
    background: string;
    texture: 'none' | 'paper';
  };
  elements: Array<ImageElement | TextElement | ShapeElement>;
}
```

- 每个元素有稳定 `id`。
- 图片元素引用 `assetId`，不复制二进制。
- 文字元素包含内容、字体族、字号、颜色、对齐、行距、字间距。
- 形状包含边框、线条、圆点、矩形、圆形。
- 服务端用 zod 校验：比例与画布尺寸一致、元素数量 ≤ 100、文本 ≤ 2000 字符、引用素材归属当前会话。

### 7.2 模板

`src/lib/editor/templates.ts`：

1. 单图艺术海报（3:4）。
2. 上下对照（3:4）。
3. 左右对照（4:3）。
4. 自由拼贴（3:4，含原图小图叠放与装饰）。

模板只生成文档，不包含固定成品图片。

### 7.3 编辑器

- Konva `Stage` 按容器尺寸缩放显示，内部坐标始终是设计尺寸。
- `Transformer` 提供拖动、缩放、旋转；`onTransformEnd` 归一化 `scaleX/scaleY` 回文档宽高。
- 撤销/重做保存文档快照，上限 50 步。
- 自动保存 2.2 秒防抖；手动保存；`beforeunload` 提示未保存。
- 预览模式隐藏 Transformer 和面板。

### 7.4 导出

- 使用同一 Konva Stage 调用 `toDataURL({ pixelRatio })`。
- `targetWidth = 设计宽度 × 2`：
  - 3:4 → 2400×3200
  - 4:3 → 3200×2400
  - 1:1 → 2800×2800
- 导出前：
  - 隐藏 Transformer；
  - 等待所有图片加载（最多 8 秒）；
  - 等待 `document.fonts.ready`；
  - 等待两帧让 React/Konva 重绘。
- 如果图片未加载完成，抛出错误并提示，不导出空白画布。
- 文字、背景、边框全部由 Canvas 绘制，不经过 AI。
- 限制：固定 2×，没有 4K 选项；系统字体跨平台渲染有差异。

---

## 8. 安全与访问控制

| 风险 | 当前措施 | 待办 |
|---|---|---|
| 密钥泄露 | 只在服务端 `process.env` 读取；`.env.local` gitignored | 部署时用平台 Secret |
| 未授权图片访问 | `/api/files/[id]` 校验 `session_id`；无 Cookie 404 | 可增加短期签名 URL |
| 重复付费 | 幂等键唯一约束 + 按钮禁用 | 多实例下仍由 DB 唯一约束保证 |
| 额度滥用 | 每日单会话/全站额度 + 进程内限流 | 多实例改 Redis/网关限流 |
| CSRF | SameSite=Lax + Origin/Host 同源校验 + JSON Content-Type | 可加 double-submit token |
| 文件类型伪装 | magic bytes + image-size + 尺寸/像素限制 | 可加病毒扫描 |
| 内容安全 | 依赖供应商审核 + 错误映射 | 公开上线前接入预审/人工申诉 |
| 数据清理 | `npm run cleanup`（默认 dry-run） | 定时任务 |
| 日志泄露 | 不记录请求体/Base64/Key；只记录错误名与消息 | 生产日志脱敏审计 |

---

## 9. 失败与恢复

| 场景 | 行为 |
|---|---|
| 上传格式不支持 | 400 `UNSUPPORTED_IMAGE_FORMAT` |
| 上传超限 | 413 `IMAGE_TOO_LARGE` |
| 无 Key / 配置错误 | 503 `AI_NOT_CONFIGURED`（不创建任务） |
| 额度用完 | 429 `QUOTA_EXCEEDED`，不调用供应商 |
| Ark 401/403 | 502 `AUTH_FAILED`，任务失败并退额度 |
| Ark 429 | 502/429 映射 `RATE_LIMITED`，记录可重试 |
| 内容审核 | 422 `CONTENT_BLOCKED`，提示更换照片 |
| 超时 | 504 `TIMEOUT`，提示可能已计费，需查账单 |
| 结果下载失败 | 502 `RESULT_DOWNLOAD_FAILED`，说明可能已产生费用 |
| 服务重启 | 超时任务标记 `TASK_INTERRUPTED`，退额度 |
| 任务查询失败 | 前端最多重试 3 次后提示刷新页面，不伪造进度 |

---

## 10. 扩展路径

1. **腾讯适配器**：核实 TokenHub 国内请求结构后实现 `ImageProvider`；任务模型无需改。
2. **持久队列**：把 `task-runner.ts` 的进程内队列替换为 BullMQ/Redis 或云任务队列；任务表作为状态源。
3. **对象存储**：把 `storage.ts` 替换为 OSS/COS/S3 适配器，文件访问改为短期签名 URL。
4. **登录/云同步**：在 `session.ts` 之上增加用户表与作品归属迁移；匿名作品可认领。
5. **作品版本历史**：新增 `work_versions` 表，保存每次文档快照；当前没有实现。
6. **视频生成**：独立的 `VideoProvider` 接口和任务表，不与图片任务混用；接入前重新核实 Seedance 权限、价格、时长与地域。

---

## 11. 关键文件

- AI：`src/lib/ai/{styles,prompt,ark,mock,size}.ts`
- 任务：`src/lib/server/{tasks,task-runner,quota}.ts`
- 数据：`src/lib/server/db.ts`
- 存储：`src/lib/server/storage.ts`
- 排版：`src/lib/editor/{types,templates,operations,history,validation}.ts`
- 画布：`src/components/editor/EditorCanvas.tsx`
- 页面：`src/app/{page.tsx,create,editor/[id],works}`
- 测试：`src/tests`、`e2e/app.spec.ts`
