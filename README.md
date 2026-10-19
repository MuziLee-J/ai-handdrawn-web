# 绘相 · 通用 AI 手绘图片创作网页版

把任意照片转成水彩、彩铅或钢笔速写手绘作品，再用可编辑的海报排版工具加入中文文字、背景、边框与装饰，导出 PNG/JPEG 成品。

项目同时支持桌面浏览器和手机浏览器，核心编辑逻辑与作品数据共用同一套实现。

---

## 当前状态（重要）

**这是一个可本地运行的 MVP；真实 AI 已完成 2 张照片 × 3 种风格（含“手账留白”构图）的验证。**

- 已使用 **Seedream 5.0 Flash** 将 1 张食物照片转换为水彩、彩铅、钢笔速写三种风格，输出 1536×2048，单张参考费用约 0.12 元。
- 已用同一模型完成 1 张风景照片的“手账留白”三风格测试；该构图已接入创建页的“满版 / 手账留白”选项，不自动添加日期或地点文字。
- 食物首轮结果：主体、构图、包装中文文字基本保留，三种风格差异明显；衣服小字有变形。
- 完整 5 类题材 × 3 风格的质量矩阵仍未完成（当前测了食物、风景各 1 张）。
- 没有 Key 时仍可使用 mock 演示图；界面和作品列表会明确标注“演示模式 / 非 AI”，不会冒充真实结果。
- 桌面与移动端（Chromium 模拟）端到端流程已通过。
- 未购买服务器、域名、资源包，未部署。

详细进度与续接说明：`docs/PROGRESS.md`
阶段 0 官方资料核验：`docs/phase-0-feasibility.md`

---

## 功能

### 创作流程

1. 上传照片：文件选择、拖拽上传、比例裁剪、缩放、旋转 90°。
2. 选择风格：水彩手绘、彩铅绘画、钢笔速写。
3. 选择构图：满版 / 手账留白（留白模式不自动添加日期或地点）。
4. 选择保真度：更接近原图 / 平衡 / 更艺术化（通过提示词控制，不伪造模型参数）。
5. AI 生成：服务端任务、真实状态轮询、错误提示、额度控制、幂等防重复。
6. 对照结果：原图/手绘滑块、下载、重新生成、换风格。
7. 排版编辑：四种模板、图片拖动/缩放/旋转、中文文字、背景、纸张颗粒、装饰、图层、撤销/重做。
8. 导出：PNG/JPEG，同一 Konva 画布按 2× 像素比原生渲染。
9. 作品集：保存、再次编辑、删除。

### 服务端能力

- 匿名 HttpOnly 会话（单浏览器，30 天）。
- JPEG/PNG/WebP 上传校验，最大 15MB、3600 万像素。
- 私有文件按会话鉴权，不暴露可猜测的永久公开路径。
- 生成任务状态：`queued` / `processing` / `succeeded` / `failed` / `cancelled`。
- 幂等键唯一约束，阻止同一任务重复付费。
- 每日单会话额度 + 全站额度，失败/取消退回预占额度。
- 进程内限流、同源校验、超时任务恢复。
- 失败/取消任务与孤立素材清理脚本。
- 火山方舟错误映射：鉴权、限流、内容审核、超时、结果下载失败等。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16.4 App Router、React 19、TypeScript、Tailwind CSS 3 |
| 排版 | Konva 10、react-konva 19 |
| 上传裁剪 | react-easy-crop |
| 后端 | Next.js Route Handlers（Node 运行时） |
| 数据 | SQLite（better-sqlite3） |
| 文件 | 本地 `.data/files`（可替换为对象存储） |
| AI | 火山方舟 Seedream 4.0（同步图像生成/编辑） |
| 测试 | Vitest、Playwright（Chromium 桌面/移动模拟） |

---

## 快速开始

### 环境要求

- Node.js **22 LTS 推荐**（最低 20.9）。
- npm 10+。
- 本地不需要 Docker、数据库服务或云账号。

### 1. 安装

```bash
cd ai-handdrawn-web
npm install
```

`better-sqlite3` 是原生模块。如果切换过 Node 版本并出现 `NODE_MODULE_VERSION` 不匹配：

```bash
npm rebuild better-sqlite3
```

### 2. 配置本地环境

```bash
cp .env.example .env.local
```

本地演示模式的最小配置：

```env
AI_PROVIDER=mock
ALLOW_MOCK_AI=true
DATA_DIR=../handdrawn-data
```

> 把 `DATA_DIR` 放在项目外，可以避免 `next dev` 监视上传/生成文件导致 HMR 刷新。默认值 `.data` 也可以使用，但开发时上传文件可能触发页面重载。

> `mock` 只用于开发/测试，生产环境必须关闭。

### 3. 启动

```bash
npm run dev
```

访问：

- http://localhost:3000
- http://127.0.0.1:3000

`next.config.ts` 已配置 `allowedDevOrigins: ['127.0.0.1', 'localhost']`，否则通过 `127.0.0.1` 访问时客户端资源会被 Next 拦截，页面按钮无反应。

### 4. 运行测试

```bash
npm run typecheck     # TypeScript
npm test              # Vitest 单元测试
npm run test:e2e      # Playwright 桌面 + 移动端
npm run smoke         # API 冒烟（需先启动 dev server）
npm run cleanup       # 数据清理预览（不删除）
```

---

## 接入真实火山方舟

### 你需要完成的控制台操作

1. 注册/登录火山引擎，完成实名认证。
2. 开通火山方舟（Ark）。
3. 在模型广场开通一个图像模型。本项目已实测 **Seedream 5.0 Flash**；4.0 需使用 `doubao-seedream-4-0-20260415` 并单独开通。
4. 创建最小权限 API Key，确认访问范围包含该模型。
5. 将 Key 写入 `.env.local`，**不要发到聊天、不要提交到 Git**：

```env
AI_PROVIDER=ark
ARK_API_KEY=你的真实Key
ARK_MODEL=doubao-seedream-5-0-flash-260915
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ALLOW_MOCK_AI=false
AI_COST_CENTS_PER_IMAGE=12
```

> Seedream 5.0 Flash / 5.0 Pro 不支持 `sequential_image_generation` 参数；适配器会按模型自动省略。4.0 默认使用 `disabled`。

“手账留白”构图会先通过提示词要求模型概括背景并保留不规则边缘，再由 `src/lib/ai/composition.ts` 把 AI 结果缩小并居中放到米白纸张上，保证四周留白。不会自动添加日期或地点。真实验证脚本：

```bash
npx tsx scripts/ui-composition-check.ts
# 可选：STYLE=colored-pencil 或 pen-sketch
```

6. 重启 `npm run dev`。
7. 打开 `/api/session`，确认：

```json
{
  "provider": {
    "id": "ark",
    "isMock": false
  },
  "aiConfigured": true
}
```

8. 用一张自有照片生成一次，记录任务 ID、结果尺寸、耗时与实际账单。

官方参考价：Seedream 5.0 Flash 输出图约 **0.12 元/张**；Seedream 4.0 约 **0.20 元/张**。输入图免费，审核失败未输出不计费。以实际账单为准。
参考：`docs/phase-0-feasibility.md`

### 真实测试矩阵

已完成：

- **食物类 1 张 × 3 风格**（满版，参考费用 0.36 元）。
- **风景类 1 张 × 3 风格**（手账留白，参考费用 0.36 元）。

> 真实测试照片与生成结果包含个人内容，未包含在仓库中；仓库只保留测试结论与可复现脚本。

待完成：

- 其余 3 类照片：人物、宠物、日常物品。
- 每类 3 种风格；其余题材也需覆盖“满版 / 手账留白”两种构图。
- 每张记录：主体保真、构图、风格辨识度、结构错误、耗时、失败原因、费用。
- 首轮总预算建议 ≤ 20 元。
- 结果写入 `docs/test-report.md`。

---

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `AI_PROVIDER` | `ark` | `ark` 或 `mock` |
| `ARK_API_KEY` | 空 | 仅服务端使用 |
| `ARK_BASE_URL` | 方舟北京地址 | 可替换区域/代理 |
| `ARK_MODEL` | `doubao-seedream-5-0-flash-260915` | 模型 ID（4.0 可改为 `doubao-seedream-4-0-20260415`） |
| `ARK_TIMEOUT_MS` | `120000` | 单次生成超时 |
| `ALLOW_MOCK_AI` | 开发环境 `true` | 生产必须 `false` |
| `AI_COST_CENTS_PER_IMAGE` | `12` | 成功任务的参考费用（分）；4.0 用 20 |
| `DATA_DIR` | `../handdrawn-data`（示例） | SQLite 与图片文件目录；部署时用持久卷绝对路径 |
| `DAILY_LIMIT_PER_SESSION` | `10` | 单浏览器每日生成次数 |
| `DAILY_LIMIT_GLOBAL` | `60` | 全站每日生成次数 |
| `MAX_UPLOAD_MB` | `15` | 上传大小上限 |
| `MAX_IMAGE_PIXELS` | `36000000` | 上传像素上限 |
| `TASK_CONCURRENCY` | `2` | 进程内并发任务数 |
| `STALE_TASK_MINUTES` | `10` | 超时任务恢复阈值 |
| `RATE_LIMIT_GENERATE_PER_MINUTE` | `6` | 单会话每分钟生成请求上限 |
| `RATE_LIMIT_UPLOAD_PER_MINUTE` | `20` | 单会话每分钟上传上限 |

完整示例见 `.env.example`。

---

## 目录结构

```text
ai-handdrawn-web/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # 首页
│   │   ├── create/                  # 上传 → 风格 → 生成 → 结果
│   │   ├── editor/[id]/             # Konva 排版编辑器
│   │   ├── works/                   # 作品集
│   │   └── api/                     # session/styles/upload/generate/tasks/works/files
│   ├── components/
│   │   ├── ui/                      # Header、Button、SVG 风格示意
│   │   ├── upload/                  # 裁剪上传
│   │   ├── result/                  # 对照滑块
│   │   └── editor/                  # Konva 画布、工具面板、图层
│   ├── lib/
│   │   ├── ai/                      # 风格、提示词、构图留白、Ark、mock、输出尺寸
│   │   ├── editor/                  # 排版文档、模板、操作、历史、zod 校验
│   │   ├── server/                  # SQLite、会话、存储、任务、队列、额度、限流
│   │   └── client/                  # fetch API 客户端、裁剪工具
│   ├── scripts/                     # cleanup 脚本
│   └── tests/                       # Vitest
├── e2e/app.spec.ts                  # Playwright 全链路
├── scripts/smoke.ts                 # API 冒烟
├── docs/                            # 架构、API、测试、部署、验收、进度
├── Dockerfile
├── .env.example
├── next.config.ts
├── playwright.config.ts
├── tailwind.config.ts
└── vitest.config.ts
```

---

## 数据与隐私

- 上传的图片与生成结果保存在本机 `DATA_DIR`，默认 `.data/`。
- 文件通过 `/api/files/[id]` 提供，需要当前浏览器会话 Cookie；无 Cookie 返回 404。
- 会话是匿名的，没有账号系统，不跨设备同步；清除 Cookie 后旧作品无法继续访问。
- 使用真实 AI 时，原图会发送给火山方舟；上线前必须在隐私政策中明确说明第三方数据处理。
- 密钥只在服务端环境变量中读取，不进入浏览器代码。
- 当前没有内容安全预审，依赖供应商审核；公开上线前需要补齐。
- 详细说明：`docs/security-privacy.md`

---

## 已知限制

完整清单：`docs/PROGRESS.md` 第 7 节。高优先级：

1. 完整真实 AI 题材矩阵未验证；已完成食物类 1 张（满版）× 3 风格、风景类 1 张（手账留白）× 3 风格，其余 3 类待测。
2. 腾讯 TokenHub 适配器未实现（国内请求字段待核实）。
3. 进程内任务队列，仅适合单实例持久 Node 进程；Serverless 需要外部队列。
4. 没有登录/云同步，作品属于单浏览器会话。
5. 没有历史版本浏览；每次保存覆盖当前排版文档，但生成图片资产不覆盖。
6. 导出固定 2×，没有 4K 选项。
7. 字体使用系统字体，跨操作系统渲染有差异。
8. 未做真实手机、Safari、微信浏览器验证；Playwright 使用 Chromium 移动模拟。
9. 未部署、未备案、未做合规审查。

---

## 部署

见 `docs/deployment.md`。核心要点：

- 必须使用持久 Node 进程 + 持久化 `.data` 卷。
- 单实例运行（进程内队列）；多实例需改外部队列。
- 公网需要 HTTPS、域名备案、隐私政策、生成式 AI 相关合规核查。
- 未经同意不要购买任何资源。

---

## 交付文档

- `docs/PROGRESS.md`：暂停点与续接步骤
- `docs/phase-0-feasibility.md`：服务商官方资料核验
- `docs/architecture.md`：架构与数据模型
- `docs/api-spec.md`：接口与错误码
- `docs/test-report.md`：测试记录与未验证项
- `docs/deployment.md`：部署、备案与费用注意事项
- `docs/acceptance.md`：验收表
- `docs/security-privacy.md`：安全、隐私与合规待办
