# 第三方代码与接口来源

## chaoxing-sign-cli

拍照协议流程参考并改写自：
- https://github.com/xabyo/chaoxing-sign-cli/blob/master/src/functions/photo.js (blob c04f700757f441e243d7f32875439048400b8717)
- https://github.com/xabyo/chaoxing-sign-cli/blob/master/src/functions/user.js (blob dffb93d1e7941d8edd6f27df3515768aaa79cb24)
- https://github.com/xabyo/chaoxing-sign-cli/blob/master/src/configs/api.js (blob ccb31b18d22f872e7a391899e9a2fa1c4693c249)

原作者 miaochenxi，读取日期 2026-10-27。保留 token → multipart upload → objectId 的协议流程，使用当前项目 Got CookieJar 与代理配置；照片只在内存处理，不沿用共享临时文件，也不把凭据传给浏览器。旧项目接口不等同于官方稳定 API，真实服务需独立验收。

MIT License

Copyright (c) 2022 miaochenxi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Leaflet

Leaflet 1.9.4，BSD-2-Clause。通过 npm 依赖使用；完整许可随依赖发布。
https://github.com/Leaflet/Leaflet/tree/v1.9.4
https://leafletjs.com/examples/quick-start/

Copyright (c) 2010-2023, Volodymyr Agafonkin
Copyright (c) 2010-2011, CloudMade
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## 地图服务

- 显式启用 MAP_PROVIDER=osm 时的地图数据与瓦片：© OpenStreetMap contributors，署名始终显示于地图。https://www.openstreetmap.org/copyright
- 瓦片使用政策：https://operations.osmfoundation.org/policies/tiles/ 。仅交互加载，保留浏览器缓存，不下载离线地图，不预抓取。
- 国内默认地图：百度 JavaScript API 4.0，使用部署者自己的浏览器端 AK，保留 SDK 署名。https://lbs.baidu.com/docs/jsapi?title=jsapi4/guide/concepts/load
- 国内默认地点搜索：百度地点检索 V2，使用部署者的服务端 AK。https://lbsyun.baidu.com/docs/webapi?title=placev3/guide/webservice-placeapiV3/interfaceDocumentV2
- 仅 MAP_PROVIDER=osm 时使用 Photon 公共搜索 API：https://github.com/komoot/photon 。仅用户点击搜索时请求，服务端限流并缓存，保留 OSM 来源说明。公共实例不保证可用性，高流量部署应自建并设置 MAP_PHOTON_ENDPOINT。未复制 Photon 源码，未接入公共 Nominatim 服务。
