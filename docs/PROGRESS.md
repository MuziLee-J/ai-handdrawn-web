# 项目续接说明（当前状态）

> 更新时间：2026-10-19
> 项目：通用 AI 手绘图片创作网页版
> 目录：项目根目录（本机绝对路径已隐去）
> 状态：**本地 MVP 已完成；“满版 / 手账留白”已接入创建页 UI；真实 AI 已完成 2 张自有照片 × 3 风格验证；完整题材矩阵与公网部署未验证。**

---

## 1. 一句话现状

已完成可本地运行的全栈 MVP：

照片上传/裁剪 → 水彩/彩铅/钢笔风格 → 服务端生成任务 → 结果对照 → Konva 海报排版（中文文字/背景/装饰/图层/撤销重做）→ PNG/JPEG 2× 导出 → 作品保存/重开/删除。

**真实火山方舟调用已成功**：用户开通 **Doubao-Seedream-5.0-Flash** 后，已完成两组真实生成：

1. 一张食物照片 × 水彩/彩铅/钢笔，满版构图；
2. 一张风景照片 × 水彩/彩铅/钢笔，手账留白构图。

真实测试产物因包含自有照片，未包含在公开仓库中。历史累计 15 次成功调用（含方向修正、构图提示词迭代和复跑），参考费用约 1.80 元（失败请求是否计费以账单为准）。完整 5 类题材矩阵仍未完成。

**2026-10-19 更新：**“满版 / 手账留白”构图已作为创建页的正式选项接入。构图值随任务写入 SQLite，并拼接到服务端提示词；日期、地点不会自动添加。页面会显示所选构图，mock E2E 已覆盖该流程。

---

## 2. 已实际验证的结果

### 单元测试

```bash
npm test
```

- **6 个测试文件、31 个测试全部通过**。
- 覆盖：提示词风格区分/无题材硬编码/保真度/满版与手账留白构图、手账留白纸张排版、Ark 输出尺寸边界、图片格式与像素校验、4 种模板、元素操作、撤销重做、比例切换。

### API 冒烟（mock）

```bash
npm run dev
npm run smoke
```

- 上传 → 生成 → 同幂等键返回同一任务 → 轮询成功 → 下载结果（约 997KB）→ 无 Cookie 404 → 作品创建/更新/列表/删除。
- 输出 `SMOKE TEST PASSED`。

### 浏览器 E2E

```bash
npx playwright test
```

- **桌面 Chromium（1440×900）：通过**。
- **移动 Chromium（Pixel 7 模拟 412×915）：通过**。
- 两个 project 均完成：
  - 首页 → 上传 → 裁剪 → 选风格 → 选“手账留白” → mock 生成 → 结果显示构图；
  - 编辑器添加中文标题、查看图层、改背景、撤销/重做；
  - 导出 PNG **2400×3200**；
  - 保存 → 作品集 → **重新打开作品，确认标题元素恢复**；
  - 首页/作品集无横向溢出。
- 截图：本地 `test-results/screenshots/`（未提交）
- 导出文件：本地 `test-results/export-desktop-chromium.png`、`export-mobile-chromium.png`（未提交）

### 构建与生产启动

```bash
npm run build
npm start
```

- 构建成功，无阻塞警告。
- `/` 200；`/api/health` 返回 `{"ok":true}`。
- 生产环境 mock 被强制禁用；无 Key 时 `/api/session` 返回 `aiConfigured:false`，不伪造 AI 结果。

### 数据清理

```bash
npm run cleanup        # dry-run
npm run cleanup:apply  # 实际删除
```

- dry-run 已执行通过。
- 默认只预览，不删除。

---

## 3. 技术栈与关键决策

- Next.js 16.4 App Router + React 19 + TypeScript + Tailwind 3。
- Konva 10 + react-konva 19；排版文档 JSON；导出使用同一 Stage 2× 渲染。
- SQLite（better-sqlite3）+ `.data` 本地文件。
- 匿名 HttpOnly Cookie 会话（30 天，单浏览器，不跨设备）。
- 火山方舟 Seedream 5.0 Flash 适配器；mock 仅开发/测试。
- 任务状态：queued / processing / succeeded / failed / cancelled。
- 进程内队列并发 2；超时任务 10 分钟恢复。
- 单会话/全站每日额度、幂等键、同源校验、进程内限流。
- 画布：3:4（1200×1600）、4:3（1600×1200）、1:1（1400×1400）。
- 导出：2400×3200 / 3200×2400 / 2800×2800。
- 第一阶段预算上限 500 元；未购买任何资源、未充值、未部署。

---

## 4. 环境与启动

### 环境

- 项目使用 Node.js **22.23.3**。
- `better-sqlite3` 已针对 Node 22 重建（NODE_MODULE_VERSION 127）。
- 切换 Node 版本后必须：

```bash
npm rebuild better-sqlite3
```

- Playwright Chromium 已安装。

### 启动

```bash
cd ai-handdrawn-web
npm run dev
```

访问 `http://localhost:3000` 或 `http://127.0.0.1:3000`。

`next.config.ts` 已设置：

```ts
allowedDevOrigins: ['127.0.0.1', 'localhost']
```

否则通过 127.0.0.1 访问时客户端资源会被拦截，React 不 hydrate。

### 本地环境变量（示例）

仓库**不包含** `.env.local` 或任何真实 Key。需要真实 AI 时，复制 `.env.example` 为 `.env.local` 并自行填写：

```env
AI_PROVIDER=ark
ARK_API_KEY=你的真实Key
ARK_MODEL=doubao-seedream-5-0-flash-260915
AI_COST_CENTS_PER_IMAGE=12
ALLOW_MOCK_AI=false
DATA_DIR=../handdrawn-data
```

> 数据目录建议放在项目外，避免 `next dev` 监视上传/生成文件导致 HMR 刷新。
> 测试期间曾临时放宽每日额度与限流；正式环境应使用更严格的值。

生产环境必须 `ALLOW_MOCK_AI=false`。

---

## 5. 接入真实火山方舟

1. 火山引擎注册/实名认证。
2. 开通方舟与图像模型。本项目已实测 **Seedream 5.0 Flash**；4.0 需使用 `doubao-seedream-4-0-20260415` 并单独开通。
3. 创建最小权限 API Key，确认访问范围包含该模型。
4. 修改 `.env.local`（不要把 Key 发到聊天/提交仓库）：

```env
AI_PROVIDER=ark
ARK_API_KEY=真实Key
ARK_MODEL=doubao-seedream-5-0-flash-260915
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ALLOW_MOCK_AI=false
AI_COST_CENTS_PER_IMAGE=12
```

> Seedream 5.0 Flash / 5.0 Pro 不支持 `sequential_image_generation`；适配器会按模型自动省略。

5. 重启 dev server。
6. 访问 `/api/session`，确认 `provider.id="ark"`、`provider.isMock=false`、`aiConfigured=true`。
7. 用自有照片跑一次生成，记录任务 ID、尺寸、耗时、费用。
8. 再做 5 类题材 × 3 风格测试，填入 `docs/test-report.md`。

官方价格参考：Seedream 5.0 Flash 输出图约 **0.12 元/张**；4.0 约 **0.20 元/张**。输入免费；以实际账单为准。

### 2026-10-19 真实模型验证结果

- `GET /api/v3/models` 返回 200，Key 鉴权有效。
- 开通前尝试 5.0 flash / 5.0 pro / 4.0 `20260415`，均返回 `ModelNotOpen`；4.5 `251128` / 4.0 `250828` 返回 `InvalidEndpointOrModel.NotFound`（旧 ID retiring）。
- 用户开通 **Doubao-Seedream-5.0-Flash** 后，真实生成成功：
  - 水彩约 16.5s；
  - 彩铅约 16.6s；
  - 钢笔约 16.5s。
- 输出均为 1536×2048；3 张参考费用 0.36 元。
- 真实测试图片因包含自有照片，未包含在仓库中。
- 第一次未处理 EXIF 方向，输出 2048×1536 横图；脚本加入 `sharp().rotate()` 后重新生成竖图。
- 加入构图选项后于 2026-10-19 复跑 3 张，均 1536×2048，参考费用 0.36 元。
- 适配器已按模型省略 5.0 flash/pro 不支持的 `sequential_image_generation` 参数。

### 2026-10-19 手账留白接入 UI 与真实复测

- 参考“白纸留白 + 水彩/线稿”效果，在创建页新增“满版 / 手账留白”构图选项；构图写入任务并进入提示词，结果页显示构图；不自动添加日期或地点。
- 通过产品 API 重新生成 3 张风景手账图：水彩 16.5s、彩铅 16.6s、钢笔 18.5s，均 1536×2048，参考费用 0.36 元。
- 真实测试图片与报告未包含在仓库中。
- 仅靠提示词时模型留白不稳定；`src/lib/ai/composition.ts` 在 `sketchbook` 模式下把 AI 结果缩小到 72% 并置于米白纸张中央，保证四边留白。图片内容仍完全来自真实 AI。
- 产品验证脚本为 `scripts/ui-composition-check.ts`，需通过 `SOURCE=/path/to/photo.jpg` 指定自有照片。

---

## 6. 文档索引

| 文件 | 内容 |
|---|---|
| `README.md` | 安装、启动、Key 配置、脚本、目录、限制 |
| `docs/phase-0-feasibility.md` | 火山/腾讯官方资料核验 |
| `docs/architecture.md` | 架构、数据模型、任务状态机、AI/排版/导出 |
| `docs/api-spec.md` | 全部接口、错误码、限流、curl |
| `docs/test-report.md` | 单测/API/E2E/构建结果、未验证项、真实测试模板 |
| `docs/deployment.md` | 本地生产、Docker、Nginx、备份、备案合规清单 |
| `docs/security-privacy.md` | 数据清单、密钥、访问控制、第三方 AI、合规待办 |
| `docs/acceptance.md` | 验收表（未验证项明确标注） |

---

## 7. 已修复的关键问题

1. `better-sqlite3` ABI 不匹配 → `npm rebuild`。
2. Next 拦截 127.0.0.1 客户端资源 → `allowedDevOrigins`。
3. 极端竖图输出尺寸死循环 → 重写 `computeArkOutputSize`。
4. Windows 路径反斜杠导致上传 500 → POSIX 校验 + 分段 join。
5. 移动端 E2E 命中隐藏桌面面板 → `data-testid` 限定作用域。
6. 移动端保存按钮无名称 → `aria-label`。
7. 移动端 Header/编辑器顶栏拥挤 → 短标签 + 两行布局。
8. Vitest Windows 线程池挂起 → 单 fork。
9. Turbopack 动态路径追踪警告 → `turbopackIgnore`。
10. 上传文件触发 `next dev` HMR 页面重载，导致 E2E 偶发 `Execution context was destroyed` → 将 `DATA_DIR` 移出项目目录（`../handdrawn-data`）。
11. Seedream 5.0 Flash/Pro 不支持 `sequential_image_generation` → 适配器按模型自动省略。
12. 手机照片 EXIF Orientation 导致横竖比例错误 → 测试脚本用 `sharp().rotate()` 自动摆正；浏览器裁剪流程本身也会摆正。

---

## 8. 当前已知限制

### 高优先级

1. **完整真实题材矩阵未验证**：已完成食物 1 张（满版）× 3 风格、风景 1 张（手账留白）× 3 风格；其余人物、宠物、日常物品待测。
2. **腾讯 TokenHub 适配器未实现**（国内请求字段待核实）。
3. **公网部署/备案/合规未验证**。
4. 真实手机、Safari、微信浏览器未验证；仅 Chromium 移动模拟。
5. 真实图像质量/风格差异/失败率/账单未知。

### 中优先级

6. 进程内任务队列，只适合单实例持久 Node 进程；Serverless 会中断。
7. 没有登录/云同步；清除 Cookie 会失去作品访问权。
8. 没有历史版本浏览；保存覆盖当前排版文档。
9. 修改画布比例会缩放并居中元素，可能需手动微调。
10. 固定 2× 导出，没有 4K；系统字体跨平台差异。
11. 上传裁剪统一 JPEG 0.92，透明 PNG 会丢失透明通道。
12. 内容安全依赖供应商审核，无预审/申诉。
13. 进程内限流多实例失效；每日额度由 SQLite 保证。
14. 软删除文件不会立即物理删除，需清理脚本。
15. 没有作品缩略图原图；作品列表使用结果图作为缩略图。
16. 文字框高度固定，超长文字可能溢出。
17. 编辑器缺少多选、吸附、网格、锁定（P1）。
18. `.data` 需要持久化卷；Docker/部署文档已说明。
19. “手账留白”已接入产品 UI，但只在 1 张风景照片上做过真实生成；人物、宠物、食物等题材的留白效果仍需验证。留白构图不会自动添加日期/地点。

---

## 9. 剩余建议

### A. 真实 AI 验收（部分完成）

1. 已完成：食物 1 张 × 3 风格；风景 1 张 × 3 风格（手账留白）。
2. 待完成：人物、宠物、建筑/日常物品等题材；并分别验证“满版 / 手账留白”两种构图。
3. 首轮预算建议 ≤ 20 元。
4. 记录结果与账单，更新 `docs/test-report.md` 和 `docs/acceptance.md`。

### B. 第二服务商（可选）

核实腾讯 TokenHub 国内 `hy-image-v3` 的完整请求字段后，实现 `ImageProvider` 适配器并做对比测试。不要凭推测写死接口。

### C. 公网部署（需要你确认）

- 域名、服务器、备案、HTTPS；
- 隐私政策、服务条款、内容审核、AI 标识；
- 单实例 + 持久卷；
- 备份与清理定时任务；
- 未经同意不要购买任何资源。

### D. 产品增强（P1）

- 作品版本历史；
- 图片多选/对齐吸附；
- 4K/分档导出；
- 登录与跨设备同步；
- 视频生成（独立适配层，重新核实 Seedance）。

---

## 10. 暂停/恢复状态

- 所有后台开发/生产服务器已停止。
- 已产生真实 AI 测试调用：累计 15 次成功生成（含方向修正、构图提示词迭代与复跑），参考费用约 1.80 元；未购买资源、未部署。
- 当前数据目录为 `../handdrawn-data`；旧的 `.data` 可以删除。
- `.env.local` 为真实 Ark 模式，Key 已填写（不在文档中展示）。
- 恢复开发：

```bash
cd ai-handdrawn-web
npm run dev
```

---

## 11. 结论边界

- 可以说：本地 MVP 已实现；“满版 / 手账留白”构图已接入创建页与任务链路；真实 AI 已完成食物 1 张 + 风景 1 张 × 各 3 风格；mock 全链路、桌面/移动模拟浏览器、导出尺寸、作品重开均已验证。
- 不可以说：完整 5 类题材图像质量已达标、手账留白在所有题材上都稳定、已完成公网部署、已满足全部合规要求。
