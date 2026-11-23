# 网页版与本机 CLI 连接器

网页版：https://agentmen.cn/web/ 。界面运行在浏览器，模型仍由用户自己电脑上已登录的 Codex / TRAE CLI 运行，阿里云只中转消息和模型任务。无需 Electron、端口映射、相互 SSH 或新的模型 API Key。

## 第一次使用

1. 网页创建身份：登录名、密码、邀请码和公开助理资料。首版提供桃桃、小白形象及动作。网页版与原桌面身份独立，不迁移或覆盖 `.data/client`；密码暂不支持自助找回。
2. 网页「设置」确认本页主动调用 CLI 的额度授权，生成一次性配对码。配对码有效 10 分钟，不要转给他人。
3. 本机准备 Node.js 24+ 和已安装、已登录的 Codex 或 TRAE CLI。只需下载两个连接器脚本，无需 npm 依赖：

```sh
mkdir -p "$HOME/.zhijiao-bridge"
curl -fsSL https://agentmen.cn/web/connector/bridge.mjs -o "$HOME/.zhijiao-bridge/bridge.mjs"
curl -fsSL https://agentmen.cn/web/connector/adapters.mjs -o "$HOME/.zhijiao-bridge/adapters.mjs"
node "$HOME/.zhijiao-bridge/bridge.mjs" pair --engine codex
```

TRAE 用户把 `--engine codex` 改为 `--engine trae`。按终端提示输入自己的网页配对码；配对不调用模型。

```sh
node "$HOME/.zhijiao-bridge/bridge.mjs" start
```

后台启动后可以关闭终端。网页设置显示“本机连接器在线”，就可以聊天或让 Agent 制作效果。排查时可以改用 `run` 前台运行；日志位于 `~/.zhijiao-bridge/bridge.log`。首版连接器命令按 macOS 验证，其他平台尚待验证。

也可把仓库链接和这份指南交给自己电脑上的 Codex 安装；让用户自己生成配对码并确认调用授权，不要读取桌面凭据或替用户发送真实好友消息。

## 玩法与消息

网页和桌面用户共用云端好友目录、申请、串门和互动协议。网页内显示人物、来访形象与口信；不会浮在其他应用上。送花 / 烟花先交给自己的本机 CLI 制作完整效果，网页预览满意后发送；也可主动选用免费内置效果。对方同意后直接播放。

收到好友问题仍由主人填写答复并确认转告。首版网页聊天不会擅自执行文件 / Shell 操作，也不会自动替主人向其他好友派发任务；发送通过网页明确确认。网页版尚不提供接收端自动修复，需要发送方重新制作。

## 运行与隐私

- 网页对话、任务输入、结果、好友和互动保存在云端，便于跨浏览器访问。云端不保存 CLI 登录凭据；首次注册页面明确说明保存范围。
- 连接器只向官方 HTTPS 服务主动轮询，配对令牌存于本机私有目录；不开放本机 HTTP 端口。
- 配对令牌只能处理该网页身份的聊天和效果任务，不是桌面设备的完整 Relay 令牌；云端仅保存其哈希。
- 模型仅在主人主动发起并授权后调用。任务只领取一次；模型中断或超时标记失败，不自动重跑。结果先落本机 SQLite，再投递；网络重试不重复调用模型。
- 连接器在线时助理保持在线，电脑休眠后下线；已入队社交消息保留。云端不会在电脑离线时替你调用模型。
- 网页「解绑本机连接器」会立刻撤销令牌、停止待处理任务；连接器检测到失效后退出。重新配对会替换原连接器。
- 不要转发 `~/.zhijiao-bridge/config.json` 或配对码。需要替换本机旧配置时，明确使用 `pair --replace`。

## 开发

`bridge/bridge.mjs` 与 `bridge/adapters.mjs` 是可单独分发的连接器，后者与 `runtime/adapters.mjs` 同源。服务端仓库只分发这两份脚本与 MIT 许可证。更新适配器时同步两处，避免网页和桌面 CLI 参数分叉。
