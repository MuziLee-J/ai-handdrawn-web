# 阶段 0：可行性与服务核验

> 核验日期：2026-10-18。以下“已确认”仅代表官方文档当前可查，不代表账号已开通、额度已领取或服务一定可用。价格以实际账单为准。

## 1. 结论

**第一阶段推荐：Next.js 全栈 + 火山方舟 Seedream 4.0 单图生图适配器 + 本地 SQLite/文件存储 + Konva 排版导出。**

理由：

1. Seedream 4.0 官方接口明确支持“单图生图”：输入一张参考照片 + 文本提示词，输出单张图片，适合做“照片 → 指定手绘媒介”的转换。
2. 接口为同步返回，MVP 不需要先搭建队列系统；服务端仍会保存任务状态（queued / processing / succeeded / failed），前端轮询真实状态。
3. 官方价格 0.20 元/张输出图，输入图免费；15 张首轮测试约 3 元，500 元预算充足。
4. Next.js Route Handlers 可以把密钥、上传校验、额度与任务状态都放在服务端；本地开发不需要域名、服务器或云数据库。
5. Konva 提供拖拽、缩放、旋转、图层与导出能力，适合先完成一个可编辑的海报模板，而不是自研完整画布引擎。

腾讯 TokenHub Hy-Image 作为第二候选：官方文档明确支持参考生图，价格约 0.15–0.20 元/张；但其国内接口的完整请求字段、图片传参格式和图片生成免费额度还需要在开通后的控制台/文档中确认，因此不作为第一阶段主链路。

## 2. 已确认事实

### 2.1 火山方舟 Seedream 4.0

- 接口：`POST https://ark.cn-beijing.volces.com/api/v3/images/generations`
- 模型 ID：`doubao-seedream-4-0-250828`（2026-10-19 实测：该旧 ID 在账号下返回 `InvalidEndpointOrModel.NotFound`，控制台当前 4.0 模型 ID 为 `doubao-seedream-4-0-20260415`；以后者为准，并需在控制台开通）
- 鉴权：`Authorization: Bearer <ARK_API_KEY>`
- 图生图：`image` 参数支持 URL 或 Base64；Base64 格式为 `data:image/<小写格式>;base64,<数据>`。
- 参考图限制：Seedream 4.0 最多 14 张；单张支持 jpeg/png/webp/bmp/tiff/gif/heic/heif，大小 ≤ 30MB，总像素 196–3600 万。
- 输出尺寸：支持 `1K` / `2K` / `4K`，也支持显式 `宽x高`；默认 `2048x2048`；总像素 921,600–16,777,216，宽高比 1/16–16。
- 单图模式：`sequential_image_generation` 设为 `disabled`。
- 返回：`response_format` 为 `url` 时，结果链接 24 小时内有效；也可用 `b64_json`。
- 水印：`watermark` 默认 `true`，可设为 `false`。
- 计费：输出图 0.20 元/张，输入图免费；审核失败未输出不计费；组图按实际生成张数计费。
- 调用模式：同步返回，官方未提供图片生成任务取消接口。

官方来源：
- 图片生成 API：https://ark.volcengine.com/region:cn-beijing/docs/image-generation-api
- 模型价格：https://ark.volcengine.com/region:cn-beijing/docs/model-pricing

### 2.1.1 2026-10-19 实机验证补充

- 实际开通并测试的是 **Doubao-Seedream-5.0-Flash**（`doubao-seedream-5-0-flash-260915`）。
- 价格参考：0.12 元/张输出图。
- 同一张食物照片生成水彩/彩铅/钢笔三种风格，输出 1536×2048，均成功；参考费用 0.36 元。
- Seedream 5.0 Flash / 5.0 Pro **不支持** `sequential_image_generation` 参数，适配器必须按模型省略；4.0/4.5/5.0 lite 才发送 `disabled`。
- 手机照片可能带 EXIF Orientation；直接上传原文件时需先 auto-orient，否则输出横竖比例会错。浏览器 UI 的 Canvas 裁剪会自动摆正。

### 2.2 腾讯云 TokenHub Hy-Image

- 平台：TokenHub，兼容 OpenAI API 协议；鉴权 `Authorization: Bearer <API_KEY>`。
- 国内接入地址：`https://tokenhub.tencentmaas.com`（备用 `https://tokenhub.tencentmaas.cn`）。
- 模型：
  - `hy-image-v3`（Hy-Image-3.0）：文生图 / 参考生图，同步；宽高 512–2048，面积 ≤ 1024×1024；prompt ≤ 8192 字符。
  - `hy-image-v3.5-preview`：文生图 / 参考生图 / 多轮编辑，同步；宽高 256–8192，面积 ≤ 4096×4096；Chat/Messages 协议。
- 计费（从官方 TokenHub 产品计费 PDF 提取）：
  - Hy-Image-3.0：约 0.20 元/张。
  - Hy-Image-3.5-preview：1K/2K 约 0.15 元/张，4K 约 0.20 元/张。
- 免费体验：TokenHub 对新主账号提供一次性免费体验包，但官方免费额度页当前明确列出的是语言模型、视频、3D、多模态理解；图片生成是否包含、具体张数需在控制台“新人福利免费体验”领取页确认。
- 迁移提示：原腾讯混元生图平台（产品 1668）已提示逐步迁移至 TokenHub，新购模型服务应走 TokenHub。

官方来源：
- TokenHub API 使用说明：https://cloud.tencent.com/document/product/1823/130078
- Hy 生图调用指南：https://cloud.tencent.com/document/product/1823/135745
- 新人免费体验包：https://cloud.tencent.com/document/product/1823/130053
- 产品计费 PDF：https://main.qcloudimg.com/raw/document/product/pdf/1823_130052_cn.pdf

## 3. 待核实事项

1. 你的火山引擎账号是否已完成实名认证、是否已开通方舟与 Seedream 4.0、是否已有可用的 API Key。
2. 你的腾讯云账号是否已开通 TokenHub、是否能领取图片生成免费额度。
3. 火山方舟当前是否有图片生成的新用户免费额度或活动；目前只确认了按量价格，不能把“输入免费”当作免费生成。
4. 腾讯 TokenHub 国内 `hy-image-v3` 的完整请求体字段（`images` 的格式、Base64/URL 要求）与结果返回结构；需要在开通后的官方文档或控制台调试中确认。
5. 两家服务的数据处理、存储地域、商业使用与内容审核条款；公开上线前需要逐条核对。
6. 实际风格效果、主体保真度、失败率和耗时；必须用你的真实照片做至少 5 类题材测试后才能判断。
7. 部署目标、域名、备案与服务器费用；当前不购买任何资源。

## 4. 500 元验证计划

| 项目 | 数量/规格 | 预估费用 |
|---|---|---|
| 火山 Seedream 4.0 首轮风格测试 | 5 类照片 × 3 风格 = 15 张 | 约 3 元 |
| 提示词迭代与重复测试 | 15–30 张 | 约 3–6 元 |
| 腾讯 Hy-Image 对比测试（可选） | 15 张 | 约 2.25–3 元 |
| 本地开发 | Next.js、SQLite、本地文件 | 0 元 |
| 合计 | 不超过 45 张真实生成 | 约 10–15 元 |

预算上限 500 元是硬约束；在未获得你明确同意前，不购买资源包、不充值、不部署付费服务器、不注册域名。若后续需要公网部署，再单独列出域名、备案、服务器与带宽费用。

## 5. 架构决策

- 前端与后端：Next.js App Router + TypeScript，Route Handlers 作为服务端 API。
- 样式：Tailwind CSS；统一颜色、间距、圆角与字体变量。
- 排版：Konva / react-konva；作品文档为可序列化 JSON；Canvas 导出 PNG/JPEG。
- 数据：本地 SQLite（better-sqlite3）+ `.data` 文件目录；匿名 HttpOnly 会话 Cookie 区分浏览器。
- AI：统一 `ImageProvider` 接口；Ark 适配器为主，mock 仅用于开发和测试且在界面明确标识。
- 任务：服务端保存 queued / processing / succeeded / failed / cancelled；同步供应商调用，前端轮询真实状态。
- 费用控制：服务端每日单会话与全局额度、幂等键、重复点击禁用、每次成功生成记录供应商/模型/费用。
- 保存：当前为单浏览器会话作品，不承诺跨设备同步；后续可替换为登录 + 云数据库/对象存储。

## 6. 目前不能确认的事项

- 没有 API Key 时，不能宣称真实 AI 图生图已完成；只能用 mock 验证 UI 与流程，并在界面和测试报告中标注“演示模式”。
- 没有真实照片时，不能完成五类题材的图像质量验收。
- 没有域名/备案/服务器时，不能宣称已公网部署或手机网络可用。
- 没有在真实浏览器中运行前，不能宣称响应式适配通过。
- 腾讯接口的国内完整调用细节未核实前，不实现其生产适配器。

## 7. 需要你亲自完成的最少操作

1. **火山引擎**：注册/登录 → 实名认证 → 开通方舟 → 开通/确认 Seedream 4.0 → 创建 API Key（最小权限）→ 将 Key 写入项目 `.env.local` 的 `ARK_API_KEY`，不要发到聊天或提交到仓库。
2. **（可选）腾讯云**：注册/登录 → 实名认证 → 开通 TokenHub → 领取新人免费体验包 → 创建 API Key。用于第二家对比测试。
3. **测试照片**：提供 5 类你拥有权利的照片（风景、人物、宠物、食物、日常物品），或明确授权我使用可商用图库素材。
4. **费用确认**：确认首轮真实生成测试预算上限（建议 20 元，最多不超过 500 元），并确认不会自动购买资源包。
5. **后续部署**：如要公网访问，再提供域名、服务器/托管平台与备案情况；当前阶段不需要。
