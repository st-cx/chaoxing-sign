# 第二轮：可操作的签到中心与地点选择

用户动作与验收：账号卡片直接打开拍照或其他签到 → 加载正在进行的活动 → 选择活动 → 准备该活动所需的照片、位置或签到码 → 明确提交 → 保留结果。照片未确认前不上传；失败保留照片；重复提交被阻止。原扫码队列继续独立运行。

接口与所有权：新 activities GET 和 manual_sign POST 都校验本站用户对学习通账号的数据库归属。服务端重新获取活动详情并校验课程，不信任客户端的签到类型。照片仅在 POST 中传递，格式和大小双端验证，用现有 Cx 会话上传云盘并获得 objectId，不向前端传 Cookie/token。

数据流：本站用户 → 所属学习通账号 → 服务器活动详情 → 所需输入 → 预签到/上传/提交 → 原日志与最近结果。照片草稿由当前签到弹窗持有；账号数据仍由 account Store 持有；所有地点组件只读写 locations Store。

地点交互：常用卡片点击即选，选中态始终可见；新增直接进入编辑，不先绕管理列表；地图点选、地址查找、当前位置、粘贴都填入同一草稿；主按钮保存并使用后关闭。按本站用户记住已选地点，兼容旧版本位置文件；导出仍不携带运行选择。坐标系统保留但放进高级选项。

复用来源：
- xabyo/chaoxing-sign-cli（原作者 miaochenxi，MIT）：src/functions/photo.js、src/functions/user.js、src/configs/api.js。参考其 token → multipart upload → objectId → photo sign 的协议流程；实现改用现有 Got 会话和内存 Buffer，移除公共临时文件与客户端凭据。许可见 THIRD_PARTY_NOTICES.md。
- Leaflet 1.9.4（BSD-2-Clause）：地图点击、拖拽和缩放；地图瓦片采用 OpenStreetMap，保留署名，不预抓取、不离线下载。
- 百度官方地理编码 V3 文档：地址查询复用 BAIDU_MAP_SERVER_AK，密钥只在服务端读取。未配置时默认使用 Photon 公共搜索服务，支持通过 MAP_PHOTON_ENDPOINT 指向自建服务。搜索点击后才请求，限流并缓存；网络失败仍可用地图点选/手动/浏览器定位。

验证边界：自动化测试、完整构建、示例真实组件浏览器操作与静态包加载必须通过。无真实账号、数据库与设备时，不声称真实签到或真机拍照验收。

- Photon 官方 API 使用说明：https://github.com/komoot/photon ，公共演示服务器仅适合合理请求量、不保证可用性。此处调用 API，未复制其服务端代码。
