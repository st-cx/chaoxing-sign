# 国内地图：申请与配置

国内部署默认使用百度地图（`MAP_PROVIDER=baidu`）。地图展示、点击选点、中文地点检索走百度服务，不请求 OpenStreetMap 瓦片或 Photon。需要自己的两个 AK；未配置时界面显示配置提示，已有坐标库、手动粘贴和浏览器定位仍可使用。

## 1. 申请入口

打开 [百度地图开放平台控制台](https://lbs.baidu.com/apiconsole/key)，登录并按平台要求完成开发者认证。在“应用管理 → 我的应用 → 创建应用”中分别创建下列两种应用。账号认证及协议确认由账号持有人完成。

| 项目 | 浏览器端应用 | 服务端应用 |
| --- | --- | --- |
| 建议名称 | 签到工作台地图 | 签到工作台地点服务 |
| 应用类型 | 浏览器端 | 服务端 |
| 需要的服务 | JavaScript API | 地点检索、地理编码、全球逆地理编码 |
| 访问限制 | Referer 白名单填写实际访问网站的域名或 IP，按控制台提示匹配协议、端口 | 选 IP 白名单校验，填写后端服务器的公网出口 IP |
| 对应配置项 | `BAIDU_MAP_BROWSER_AK` | `BAIDU_MAP_SERVER_AK` |

两个类型不能混用。浏览器端 AK 会随地图请求公开给浏览器，应限制可用站点；服务端 AK 只保存在服务器中，不返回网页。不要使用别人的示例密钥。

## 2. 配置位置

编辑部署目录的 `.env`，保留原数据库连接、认证密钥和其他配置，只添加或更新以下项目：

```dotenv
MAP_PROVIDER=baidu
BAIDU_MAP_BROWSER_AK=填写浏览器端应用的AK
BAIDU_MAP_SERVER_AK=填写服务端应用的AK
```

systemd 部署示例：

```shell
nano /home/ubuntu/apps/chaoxing-sign/.env
chmod 600 /home/ubuntu/apps/chaoxing-sign/.env
sudo systemctl restart chaoxing-sign
systemctl is-active chaoxing-sign
```

密钥只填在服务器 `.env` 中，不写入源码或 GitHub。上述环境变量由服务器运行时读取，修改后重启并刷新网页即可，不需要重新构建。

## 3. 验证

1. 登录网站，打开“添加地点”，不再显示“地图等待管理员启用”。
2. 确认百度底图正常显示；搜索“江门 五邑大学 南主楼”一类城市＋学校＋楼名组合。
3. 选择候选或点击地图，检查名称、地址和坐标后“保存并使用”。百度选点保存为 BD-09，浏览器定位保留 WGS-84，不要手动改错坐标来源。
4. 刷新页面，确认选定的地点仍在。地点数据仍只保存在当前浏览器。

能显示地图不等于真实签到成功；位置签到还依赖服务端逆地理解析和实际活动规则。

## 常见问题

- **地图配置提示仍在**：核对变量名称、systemd 的 `EnvironmentFile`、重启结果，并完整刷新页面。
- **地图加载失败/超时**：核对浏览器端 AK 类型、JavaScript API 权限、Referer 白名单，以及浏览器到百度服务的网络。
- **地点搜索未获授权**：核对服务端 AK、地点检索权限和服务器出口 IP 白名单。
- **搜索无结果**：补上城市和学校全名，或直接在已经加载的地图上选点。地图数据不保证包含每栋校内建筑。
- **额度/频率受限**：在自己的百度控制台查看服务额度，按平台规则调整；本项目不会自动切到别人的密钥或海外服务。

## 海外部署可选

仍保留 `MAP_PROVIDER=osm`，明确设置后才会使用 Leaflet / OpenStreetMap 瓦片和 Photon 搜索。该模式依赖对应网络和服务政策；不保证中国大陆可用，也不是百度故障时的自动回退。`MAP_PHOTON_ENDPOINT` 仅在此模式下生效。位置签到的服务端地址解析仍需要百度服务端 AK。

官方参考：[AK 申请流程](https://lbsyun.baidu.com/faq/details?id=2298&title=2639)、[JSAPI 接入准备](https://lbs.baidu.com/docs/jsapi?title=jsapi4/quickstart/prepare)、[Referer 白名单](https://lbs.baidu.com/faq/details?id=2293&title=2584)。
