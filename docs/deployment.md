# 部署说明

> 当前状态：**未部署**。本文档是可执行方案，不代表已经完成公网验证、备案或合规审查。
> 未经你明确同意，不要购买服务器、域名、资源包或任何付费服务。

---

## 1. 部署形态选择

本项目使用：

- Next.js 单进程 Node 服务；
- SQLite 本地数据库；
- 本地文件存储（`.data/files`）；
- 进程内任务队列（并发 2）。

因此推荐：

**一台小型 Linux 服务器 / 云主机 + Node.js 22 + 反向代理 + 持久化数据盘。**

### 不适合直接使用的形态

- Vercel/Netlify 等 Serverless：后台任务可能在响应返回后被中断；本地文件系统不持久。
- 多实例水平扩容：每个实例有独立进程内队列和 SQLite；需要先改造为外部数据库 + 对象存储 + 外部队列。
- 无持久化磁盘的容器：`.data` 会丢失。

如果未来要上 Serverless 或多实例，先完成：

1. SQLite → PostgreSQL；
2. 本地文件 → 对象存储（OSS/COS/S3）+ 签名 URL；
3. 进程内队列 → Redis/BullMQ 或云任务队列；
4. 限流 → Redis/网关。

---

## 2. 环境变量

生产环境使用平台 Secret 或 `.env.production`，不要提交到仓库。

最小生产配置：

```env
NODE_ENV=production
PORT=3000

AI_PROVIDER=ark
ARK_API_KEY=真实Key
ARK_MODEL=doubao-seedream-4-0-250828
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ALLOW_MOCK_AI=false
AI_COST_CENTS_PER_IMAGE=20

DATA_DIR=/var/lib/handdrawn/.data
DAILY_LIMIT_PER_SESSION=3
DAILY_LIMIT_GLOBAL=30
MAX_UPLOAD_MB=15
MAX_IMAGE_PIXELS=36000000
TASK_CONCURRENCY=1
STALE_TASK_MINUTES=10
```

说明：

- 生产必须 `ALLOW_MOCK_AI=false`；无 Key 时接口返回 `AI_NOT_CONFIGURED`，不会伪造结果。
- 公开测试期建议把单会话/全站额度调低，避免误刷。
- `DATA_DIR` 必须指向持久化卷。
- 不要把 `ARK_API_KEY` 写进 Dockerfile、前端代码或日志。

---

## 3. 本地生产模式

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
# {"ok":true}
```

> `better-sqlite3` 必须与运行 Node 版本匹配。切换 Node 后执行 `npm rebuild better-sqlite3`。

---

## 4. Docker 部署

### 构建

```bash
docker build -t handdrawn-web:latest .
```

### 运行

```bash
docker volume create handdrawn-data

docker run -d \
  --name handdrawn \
  -p 127.0.0.1:3000:3000 \
  --env-file .env.production \
  -v handdrawn-data:/app/.data \
  --restart unless-stopped \
  handdrawn-web:latest
```

- 只绑定 `127.0.0.1`，由 Nginx/Caddy 暴露公网 HTTPS。
- 数据卷挂载到 `/app/.data`。
- 保持单实例；不要在同一数据卷上跑多个副本。

### 更新

```bash
docker build -t handdrawn-web:latest .
docker stop handdrawn && docker rm handdrawn
# 重新执行 docker run，保留同一数据卷
```

更新前备份 `.data`。

---

## 5. Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # 上传上限要大于应用层 15MB
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 150s;
        proxy_send_timeout 150s;
    }
}
```

注意：

- 必须保留 `Host` 头，应用的 Origin/Host 同源校验依赖它。
- `client_max_body_size` 至少 20m。
- AI 生成可能持续数十秒，代理读取超时要大于 `ARK_TIMEOUT_MS`。
- 生产 Cookie 带 `Secure`，必须 HTTPS。

---

## 6. 数据持久化与备份

需要备份：

- SQLite：`$DATA_DIR/app.db`、`app.db-wal`、`app.db-shm`
- 文件：`$DATA_DIR/files/uploads`、`$DATA_DIR/files/generated`

### 一致性备份

SQLite 使用 WAL。直接复制运行中的数据库文件可能不一致。推荐：

```bash
# 容器内或宿主机安装 sqlite3
sqlite3 /var/lib/handdrawn/.data/app.db ".backup '/backup/app-$(date +%F).db'"
tar -czf /backup/files-$(date +%F).tar.gz /var/lib/handdrawn/.data/files
```

或者停止容器后再复制整个 `.data`。

### 恢复

1. 停止服务；
2. 恢复 `app.db` 与 `files`；
3. 启动服务；
4. 用 `/api/health` 与一个测试会话验证。

---

## 7. 清理任务

```bash
# 预览
npm run cleanup

# 容器内执行
docker exec handdrawn npm run cleanup

# 实际删除（确认后）
docker exec handdrawn npm run cleanup:apply
```

建议每周执行一次 dry-run，每月执行一次 `--apply`。清理策略见 `src/scripts/cleanup.ts`。

---

## 8. 监控与告警

建议监控：

- `/api/health` 200/503；
- 磁盘使用率（`.data` 增长）；
- 任务失败率（`tasks.status='failed'`）；
- 供应商错误码分布（`AUTH_FAILED` / `RATE_LIMITED` / `CONTENT_BLOCKED` / `TIMEOUT`）；
- 每日生成数量（`global_usage`）；
- 进程是否多实例（必须为 1）。

日志中不得记录：

- `ARK_API_KEY`；
- 完整请求体/Base64 图片；
- 用户照片内容；
- 完整 Cookie。

---

## 9. 公网发布前必须核实

以下事项**尚未完成**，不能声称已经合规：

1. **ICP 备案**：中国大陆服务器 + 域名通常需要 ICP 备案；以工信部/服务商最新要求为准。
2. **公安备案**：按当地要求办理。
3. **隐私政策**：明确收集照片、上传、第三方 AI 处理、保存期限、删除方式、联系方式。
4. **用户同意**：上传前告知照片会发送给第三方 AI 服务。
5. **生成式 AI 相关要求**：公开提供生成式 AI 服务可能涉及备案/安全评估/内容标识等要求；以国家网信办及服务商最新规定为准。
6. **AI 生成内容标识**：按适用规定对生成内容进行标识。
7. **内容安全**：接入审核/关键词/图片审核或人工复核，提供申诉渠道。
8. **商业使用条款**：核实火山方舟的数据处理、地域、商业使用与内容政策。
9. **未成年人保护**：如面向未成年人，需要额外评估。
10. **服务条款**：明确额度、失败计费、免责声明、禁止用途。

本项目不构成法律意见；上述事项必须由你或专业顾问完成核查。

---

## 10. 费用

当前未产生任何付费资源。可能产生持续费用的项目：

- 云服务器/带宽；
- 域名；
- ICP 备案（通常免费但需时间）；
- HTTPS 证书（可用免费证书）；
- 火山方舟按量生成（官方参考价 0.20 元/张输出图，以实际账单为准）；
- 对象存储/数据库（如果后续替换本地设施）。

第一阶段硬上限 500 元。**任何购买/充值/开通付费资源前必须先征得你的明确同意。**

---

## 11. 部署检查清单

- [ ] 服务器 Node 22，`better-sqlite3` 可加载
- [ ] `.data` 持久化卷已挂载
- [ ] `ALLOW_MOCK_AI=false`
- [ ] `ARK_API_KEY` 只存在于 Secret/环境变量
- [ ] HTTPS 证书有效
- [ ] `Host` 头正确转发
- [ ] 上传大小限制 ≥ 20MB（代理层）
- [ ] `/api/health` 返回 200
- [ ] 单实例运行
- [ ] 备份任务已配置
- [ ] 清理任务已配置
- [ ] 隐私政策/服务条款已上线
- [ ] ICP/公安/生成式 AI 合规已核实
- [ ] 真实 AI 测试已完成并记录
- [ ] 未执行未经同意的付费操作
