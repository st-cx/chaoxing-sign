# 部署与升级指南

适用于本仓库的拍照与地图版。需要 PostgreSQL、Node.js 20 或 22、pnpm 9.15.9，以及可访问学习通和地图服务的网络。示例路径和域名须替换为自己的配置。

## 首次部署

1. 将源码放到 `/home/ubuntu/apps/chaoxing-sign`，创建仅应用使用的 PostgreSQL 数据库与角色。
2. 按 [README](../README.md) 从 `.env.example` 创建 `.env`，设置随机 `AUTH_SECRET`、数据库连接和实际 HTTPS 地址。使用 `HOST=127.0.0.1`、`PORT=8050`，保持注册和自动重连默认关闭。
3. 安装、初始化并构建：

```shell
pnpm install --frozen-lockfile
pnpm exec prisma db push
pnpm build
chmod 600 .env
```

`prisma db push` 仅在已检查数据库模型的首次初始化场景使用；不要把它作为每次升级的固定步骤。2–4 GB 内存服务器可用 `NODE_OPTIONS=--max-old-space-size=2304 pnpm build` 控制构建堆内存。

### systemd

创建 `/etc/systemd/system/chaoxing-sign.service`，将示例用户与目录改成真实应用用户和路径：

```ini
[Unit]
Description=Chaoxing Sign Workspace
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/apps/chaoxing-sign
EnvironmentFile=/home/ubuntu/apps/chaoxing-sign/.env
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
UMask=0077

[Install]
WantedBy=multi-user.target
```

用 `command -v node` 确认 Node 路径。确保运行用户能读取配置，并能写 `.env` 及父目录，使临时注册窗口到期后可以关闭。

```shell
sudo systemctl daemon-reload
sudo systemctl enable --now chaoxing-sign
systemctl --no-pager status chaoxing-sign
```

直接运行 `.output/server/index.mjs` 时由 systemd 注入环境变量，不依赖 Node 自动读取 `.env`。不要同时启动第二个 PM2 或手动实例：扫码队列和事件流保存在单个 Node 进程中。

### Caddy

在已有配置中添加独立站点，不覆盖其他服务：

```caddyfile
sign.example.com {
    reverse_proxy 127.0.0.1:8050 {
        flush_interval -1
    }
}
```

将域名解析到服务器，确认所需端口可访问，校验配置后重载 Caddy。`AUTH_ORIGIN` 和 `NEXTAUTH_URL` 必须与公开 HTTPS 地址一致。若使用 Nginx，见 README 的替代配置，开启事件流转发并将请求体上限设为至少 10 MB，以容纳 5 MB 照片的 Base64 JSON。

首次注册时临时将 `ALLOW_WEB_REGISTRATION=true` 并重启，注册窗口为 5 分钟；已有账号升级不需要重新注册。

## 地图与照片配置

- 国内默认百度地图：设置 `MAP_PROVIDER=baidu`，分别配置 `BAIDU_MAP_BROWSER_AK` 与 `BAIDU_MAP_SERVER_AK`，详见 [申请与配置指南](MAP_SETUP.md)。未配置时显示提示，不请求海外服务。
- `BAIDU_MAP_SERVER_AK` 用于位置签到的服务端地址解析；搜索使用百度地点检索。开通地点检索、地理编码、全球逆地理编码，并配置服务端出口 IP 权限。
- 手动拍照签到使用当前学习通账号的会话上传，无需配置公共云盘凭据，也不必提前上传 `0.jpg`。原自动签到照片查找能力另行保留。
- HTTPS 是摄像头和定位权限正常工作的前提；手机系统相机的具体行为由浏览器决定。

## 已有版本升级

1. 保存当前提交或版本号；在服务器本地私有目录备份 `.env`、systemd/代理配置，并使用 `pg_dump -Fc` 备份数据库，检查备份可读。
2. 在独立目录下载目标提交，复制现有 `.env`，安装依赖并构建。不要覆盖为 `.env.example`，否则可能丢失数据库连接和登录会话密钥。
3. 比对 Prisma 模型。本次拍照与地图版没有修改数据库模型，无需重建数据库或执行迁移。
4. 构建成功后停止旧应用服务，保留旧目录作为回退目录，将新目录切换为 systemd 指定的工作目录，再启动服务。
5. 检查服务状态、本地 HTTP、公开 HTTPS、登录会话、账号数量、签到中心和地图搜索。失败则停新服务，恢复旧目录再启动。
6. 验证成功后将旧程序移入回收站或按自己的保留策略清理；保留数据库、配置备份及当前服务需要的数据。

坐标库与上次选择存于浏览器，不在 PostgreSQL 中。换域名、端口或设备前应在原站点导出坐标库；服务器备份无法备份浏览器中的地点。

## 部署验收范围

服务返回 HTTP 200 只证明网站可访问。还应检查账号、活动和地图请求；真实拍照上传及签到必须在实际活动中另行确认，不能用示例预览的成功提示替代。

仓库中的旧 `Dockerfile`、`ecosystem.config.js` 和 `.github/workflows/ci.yml` 含上游历史运行时或部署占位配置，不能原样用于生产。本版不会通过旧工作流自动部署；使用前应按自己的环境重写配置和凭据。
