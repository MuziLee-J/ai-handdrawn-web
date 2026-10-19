# 测试报告

> 日期：2026-10-19
> 环境：Windows 11 / Node.js 22.23.3 / Next.js 16.4.2 / Chromium Headless Shell 156
> 结论：**本地 mock 链路已通过；“满版 / 手账留白”构图已接入 UI 并由 E2E 覆盖；真实 AI 已完成食物、风景各 1 张 × 3 风格验证；完整题材矩阵未完成。**

---

## 1. 总结

| 测试层 | 结果 | 说明 |
|---|---|---|
| TypeScript 类型检查 | 通过 | `npm run typecheck` |
| Vitest 单元测试 | 通过 | 6 个文件、31 个测试 |
| API 冒烟（mock） | 通过 | 上传 → 生成 → 下载 → 作品 CRUD |
| Playwright 桌面 E2E | 通过 | 1440×900 Chromium，含导出与重开作品 |
| Playwright 移动 E2E | 通过 | Pixel 7 模拟（412×915），含导出与重开作品 |
| 生产构建 | 通过 | `npm run build` |
| 真实 AI 生成 | **部分通过** | Seedream 5.0 Flash，食物 1 张（满版）+ 风景 1 张（手账留白）× 各 3 风格成功；人物/宠物/日常物品待测 |
| 真实手机/Safari/微信 | **未验证** | 仅 Chromium 移动模拟 |
| 公网部署/备案 | **未验证** | 未部署 |

---

## 2. 单元测试

命令：

```bash
npm test
```

结果：`6 passed (6)`，`31 passed (31)`。

覆盖：

- `src/tests/prompt.test.ts`
  - 三种风格生成不同提示词；
  - 不含旅行/美食/宠物等题材硬编码；
  - faithful / artistic 指令不同；
  - 满版与手账留白构图生成不同指令，留白指令包含大面积留白且不含题材硬编码；
  - prompt/style 版本号存在。
- `src/tests/size.test.ts`
  - 1:1、3:4、4:3、16:9、9:16、4:1、1:4 等比例；
  - 输出总像素在 Ark 下限 921,600 与上限 16,777,216 之间；
  - 单边 ≤ 4096；
  - 无效尺寸抛错。
- `src/tests/composition.test.ts`
  - 手账留白模式把 AI 图缩小并居中到米白纸张；
  - 四角为纸张色、中心保留原图内容；
  - 满版模式原样返回，不做额外处理。
- `src/tests/images.test.ts`
  - PNG 尺寸识别；
  - JPEG/WebP magic bytes；
  - GIF 拒绝；
  - 超像素拒绝。
- `src/tests/editor.test.ts`
  - 四种模板均可通过 schema；
  - 元素更新、排序、复制、删除；
  - 画布比例切换；
  - 撤销/重做；
  - 重复元素 ID 拒绝。
- `src/tests/quota.test.ts`
  - 单会话每日额度预占；
  - 超额拒绝；
  - 退款后恢复；
  - 全站额度跨会话限制。

---

## 3. API 冒烟（mock）

前置：

```bash
npm run dev
npm run smoke
```

实际结果：`SMOKE TEST PASSED`。

| 步骤 | 结果 |
|---|---|
| `GET /api/session` | 200，provider=mock |
| 上传 PNG | 201，1024×796 |
| 创建任务 | 202，status=queued |
| 同幂等键再次创建 | 200，返回同一 task ID |
| 轮询任务 | succeeded |
| 下载结果 | 200，约 997KB |
| 无 Cookie 下载 | 404 |
| 创建作品 | 201 |
| 更新作品标题 | 200 |
| 作品列表包含该作品 | 通过 |
| 删除作品 | 200 |

> 本次使用程序化演示图，**不是真实 AI 生成**。

---

## 4. Playwright 端到端

命令：

```bash
npm run test:e2e
```

结果：`2 passed (2)`。

每个 project 都执行：

```text
首页
→ 上传 e2e-source.png
→ 裁剪并上传
→ 选择彩铅 + 手账留白 + 更艺术化
→ 创建 mock 生成任务
→ 轮询到 succeeded，结果显示“构图：手账留白”
→ 进入 Konva 编辑器
→ 添加中文标题
→ 查看图层
→ 修改背景
→ 撤销/重做
→ 导出 PNG
→ 保存
→ 作品集
→ 重新打开作品，确认标题元素恢复
```

### 4.1 桌面

- Viewport：1440×900。
- 首页/作品集横向溢出检查：通过（≤1px）。
- 导出文件：本地 `test-results/export-desktop-chromium.png`（未提交）。
- 实际尺寸：**2400 × 3200** PNG。
- 本地截图（未提交）：
  - `test-results/screenshots/home-desktop-chromium.png`
  - `style-desktop-chromium.png`
  - `result-desktop-chromium.png`
  - `editor-desktop-chromium.png`
  - `works-desktop-chromium.png`

### 4.2 手机

- Playwright `Pixel 7` 模拟：412×915，DPR 2.625。
- 移动端底部工具栏、底部抽屉、保存/导出、作品重开均通过。
- 首页/作品集横向溢出检查：通过。
- 导出尺寸：2400×3200 PNG。
- 本地截图（未提交）：
  - `home-mobile-chromium.png`
  - `style-mobile-chromium.png`
  - `result-mobile-chromium.png`
  - `editor-mobile-chromium.png`
  - `works-mobile-chromium.png`

### 4.3 视觉检查

已人工查看桌面与手机截图：

- 首页风格卡片为 SVG 示意，并标注“风格示意”。
- 创建页有“满版 / 手账留白”两张构图卡片，选中状态和说明清楚；截图见 `style-*.png`。
- 结果页显示“构图：手账留白”，mock 结果也被排到纸张中央，证明服务端构图链路生效。
- 移动端 Header 不再换行：手机上显示“绘相 / 作品 / 创作”。
- 编辑器移动端顶栏改为两行：标题一行，撤销/重做/预览/保存/导出一行。
- 底部工具栏不与抽屉冲突。
- 导出画布无选择框/Transformer，文字与背景正常。
- 作品列表对 mock 结果显示“演示图 · 非 AI”徽标。
- 编辑器对 mock 作品显示黄条提示，避免把演示图误认为真实 AI 结果。

---

## 5. 构建与生产启动

命令：

```bash
npm run build
npm start
```

结果：

- 生产构建成功，所有路由生成完成；
- 已用 `/* turbopackIgnore: true */` 处理 `DATA_DIR` 动态路径追踪警告；
- `GET /` 返回 200；
- `GET /api/health` 返回 `{"ok":true}`；
- 生产环境 `NODE_ENV=production` 下 mock 被强制禁用，`/api/session` 返回 `aiConfigured:false`，不会把演示图伪装成 AI 结果。

部署提醒：`.data` 必须作为运行时持久化卷挂载，不能依赖构建产物内的文件。

---

## 6. 数据清理

命令：

```bash
npm run cleanup        # dry-run
npm run cleanup:apply  # 实际删除
```

当前 dry-run 输出：

```text
[cleanup] mode=DRY RUN
[cleanup] 软删除超过 30 天的作品：0
[cleanup] 失败/取消超过 30 天的任务：0
[cleanup] 可删除的孤立素材：0
```

> 默认不删除；需要显式 `--apply`。详见 `src/scripts/cleanup.ts`。

---

## 7. 测试中发现并修复的问题

| 问题 | 影响 | 修复 |
|---|---|---|
| `better-sqlite3` ABI 115 vs 127 | dev server 500 | `npm rebuild better-sqlite3`（Node 22） |
| Next dev 拦截 127.0.0.1 客户端资源 | React 不 hydrate，按钮无反应 | `allowedDevOrigins: ['127.0.0.1','localhost']` |
| 极端竖图输出尺寸死循环 | 单元测试挂起 | 重写 `computeArkOutputSize` 的横竖方向与循环上界 |
| Windows 路径反斜杠 | 上传 500 “非法的存储路径” | POSIX 化校验 + 分段 path.join |
| 移动端 E2E 命中隐藏桌面面板 | 测试失败 | 增加 `data-testid="mobile-tool-sheet"`，限定作用域 |
| 移动端保存按钮图标无名称 | 测试无法定位 | 增加 `aria-label="保存"/"预览"` |
| 移动端保存状态胶囊隐藏 | 测试断言失败 | 改用用户可见的“作品已保存。”toast |
| 移动端 Header 文字换行 | 视觉拥挤 | 手机显示短标签，隐藏副标题 |
| 移动端编辑器顶栏标题被挤压 | 标题只剩“未命” | 移动端顶栏两行布局 |
| Vitest 默认线程池在 Windows 挂起 | `npm test` 超时 | `pool: forks` + `singleFork` |
| 上传/生成文件在 `.data` 内触发 `next dev` HMR 重载 | E2E 偶发 `Execution context was destroyed` | 本地 `DATA_DIR` 改到项目外 `../handdrawn-data` |
| Playwright 默认清空 `test-results/` 根目录 | 真实 AI 测试图片被删除 | `playwright.config.ts` 设置 `outputDir: './test-results/e2e'` |

---

## 8. 未验证项（不得视为通过）

1. **真实火山方舟调用**：已完成食物 1 张（满版）× 3 风格、风景 1 张（手账留白）× 3 风格；其余 3 类题材未测。
2. **图像质量**：已完成食物和风景各 1 张；人物、宠物、建筑、日常物品等题材的主体保真、结构错误、失败率仍未知。
3. **腾讯 TokenHub**：未实现适配器；国内请求字段未核实。
4. **真实手机**：仅 Chromium 模拟，未在 iOS Safari、Android Chrome/微信内置浏览器验证。
5. **导出与预览像素级一致性**：导出尺寸与内容已检查，但未做逐像素 diff。
6. **大图/低内存设备导出**：未测试 4K/低端机 Canvas 内存上限。
7. **并发与限流**：未做高并发压测；进程内限流只在单实例有效。
8. **内容安全**：未接入预审；仅依赖供应商错误映射。
9. **部署/备案/合规**：未部署，未做 ICP、公安备案、生成式 AI 相关核查。
10. **数据清理执行**：只跑了 dry-run，未在真实数据上执行 `--apply`。

---

## 9. 真实模型开通与验证（2026-10-19）

### 9.1 鉴权与激活过程

- `GET /api/v3/models` 返回 HTTP 200，Key 鉴权有效。
- 初始尝试时模型未开通：5.0 flash / 5.0 pro / 4.0 `20260415` 返回 `404 ModelNotOpen`；4.5 `251128` / 4.0 `250828` 返回 `InvalidEndpointOrModel.NotFound`。
- 用户开通 **Doubao-Seedream-5.0-Flash** 后，项目接口成功完成 3 个真实任务。

### 9.2 真实生成结果

| 风格 | 耗时 | 输出尺寸 | 参考费用 |
|---|---|---|---|
| 水彩 | 16.5s | 1536×2048 | ¥0.12 |
| 彩铅 | 16.6s | 1536×2048 | ¥0.12 |
| 钢笔速写 | 16.5s | 1536×2048 | ¥0.12 |

- 模型：`doubao-seedream-5-0-flash-260915`
- 输入：一张自有食物照片，原始 3024×4032，EXIF Orientation=6
- 这是加入“满版 / 手账留白”构图选项后的复跑结果；默认 `composition=full`。
- 真实照片、任务 ID 与结果文件因隐私未包含在仓库中。

### 9.3 质量观察

- 主体：食物包装、食物、手部与桌面关系基本保留；包装小字可辨但有轻微变形。
- 水彩：透明色层、晕染边缘、纸张颗粒明显。
- 彩铅：可见排线、叠色与纸纹颗粒。
- 钢笔：线稿与交叉排线，细节概括更强。
- 三者视觉差异明显，不是同一张图换滤镜。
- 衣服上的英文字样有变形/拼写变化，属于当前模型的小字问题。
- 第一次生成未处理 EXIF 方向，输出为 2048×1536 横图；脚本加入 `sharp().rotate()` 后重新生成 1536×2048 竖图。
- 2026-10-19 加入构图选项后复跑 3 张，均为 1536×2048，参考费用 **0.36 元**。

### 9.4 适配器变更

Seedream 5.0 Flash / 5.0 Pro 不支持 `sequential_image_generation` 参数。适配器已按模型自动省略该字段；4.x 与 5.0 lite 继续发送 `disabled`。

---

## 10. 真实 AI 测试记录

| 编号 | 题材 | 风格 | 输入尺寸 | 任务 ID | 模型 | 耗时 | 结果尺寸 | 主体保真 | 构图 | 风格辨识度 | 结构错误 | 费用 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R04-01 | 食物 | 水彩 | 3024×4032 | — | 5.0 Flash | 16.5s | 1536×2048 | 高 | 满版 | 强 | 小字轻微 | ¥0.12 | 通过 |
| R04-02 | 食物 | 彩铅 | 3024×4032 | — | 5.0 Flash | 16.6s | 1536×2048 | 高 | 满版 | 强 | 小字轻微 | ¥0.12 | 通过 |
| R04-03 | 食物 | 钢笔 | 3024×4032 | — | 5.0 Flash | 16.5s | 1536×2048 | 高 | 满版 | 强 | 文字概括明显 | ¥0.12 | 通过 |
| R01 | 风景 | 3 风格 | | | | | | | | | | | 待测 |
| R02 | 人物 | 3 风格 | | | | | | | | | | | 待测 |
| R03 | 宠物 | 3 风格 | | | | | | | | | | | 待测 |
| R05 | 日常物品 | 3 风格 | | | | | | | | | | | 待测 |

测试要求：

- 使用自有/已授权照片。
- 每类至少 3 种风格，共 15 张起。
- 记录实际账单，不把估算当承诺。
- 失败/审核未通过也要记录。
- 结果写入本文件并更新结论。

---

## 11. 手账留白构图接入 UI 后的验证（2026-10-19）

参考“白纸留白 + 水彩/线稿”效果，在产品中增加“满版 / 手账留白”构图选项，并使用一张自有风景照片通过**产品 API**（不是直接调用 Ark）验证。

### 11.1 结果

| 风格 | 耗时 | 输出尺寸 | 参考费用 |
|---|---|---|---|
| 水彩手账 | 16.5s | 1536×2048 | ¥0.12 |
| 彩铅手账 | 16.6s | 1536×2048 | ¥0.12 |
| 钢笔速写手账 | 18.5s | 1536×2048 | ¥0.12 |

- 模型：`doubao-seedream-5-0-flash-260915`
- 提示词版本：`handdrawn-2026-10-19.v3`
- 构图参数：`composition=sketchbook`，保真度 `balanced`
- 请求路径：`POST /api/upload` → `POST /api/generate` → 轮询 `/api/tasks/{id}` → 下载结果。
- 真实照片、任务 ID、结果文件与报告因隐私未包含在仓库中。

### 11.2 观察

- 三张都出现大面积米白纸张留白、主体不规则边缘；主体位于纸张中央，接近参考图的手账/速写风格。
- 主体与主要环境元素保留辨识度；背景大幅概括，符合“不需要完全匹配照片”的要求。
- 水彩晕染柔和；彩铅排线与叠色明显；钢笔线稿和交叉排线最强。
- 局部枝干与细节在钢笔风格中被简化；未发现明显主体结构错误。
- 未生成日期、地点、标题、签名或边框。
- 说明：仅靠提示词时，模型给的留白不稳定；因此服务端在 `sketchbook` 模式下会把 AI 结果缩小并置于米白纸张中央（72% 尺寸），保证四边留白。图片内容仍来自真实 AI，这一步只做纸张排版，不替换画面。

### 11.3 产品状态

“满版 / 手账留白”已作为创建页的正式构图选项接入：

- UI：`src/app/create/CreateClient.tsx`；
- API 校验与任务字段：`src/app/api/generate/route.ts`、`src/lib/server/tasks.ts`、SQLite `tasks.composition`；
- 提示词：`src/lib/ai/prompt.ts` 的 `COMPOSITION_CLAUSES`；
- 留白排版：`src/lib/ai/composition.ts`；
- 日期/地点：生成图不会自动添加；排版编辑器的模板中如带有日期元素，可由用户自行删除或修改。

原 `scripts/sketchbook-convert.ts` 保留用于直接对比测试；产品验证脚本为 `scripts/ui-composition-check.ts`。
