# 信使 · macOS 应用身份

Dock 与应用菜单显示「信使」，应用内品牌仍为知交信使。桌面启动器从 npm Electron 原始应用复制独立运行时至 `.data/desktop-app/信使.app`，设置显示名、Bundle 名称和图标，并对本地副本重新签名。不会修改 npm 原始 Electron，也不安装到系统应用目录。首次启动或图标/运行时改变时重建；后续复用。主人授权的更新器也走此入口。

`.data` 内身份、聊天、CLI 配置保持原样；Electron 原有 userData 路径在改名时保留。不要单独双击缓存里的应用；继续使用 `npm run desktop` 或启动脚本。

## 图标

- 生产图标：`assets/app-icon.png`，真实透明背景。
- 原蓝紫轨道草稿：`assets/app-icon-orbit-draft.png`。
- 使用内置 imagegen 生成，提示词：

> Production macOS Dock icon for a personal AI messenger. Single centered rounded-square obsidian navy tile, satin material, restrained bevel, 8% transparent margin. Large sculpted folded envelope with upward soaring folded-paper wing, a small integrated cyan four-point spark at the fold. Electric indigo to ice cyan, bold silhouette legible at 32px, minimal polished native Mac feel. No letters, text, orbit rings, infinity loop, robot face, watermark or mockup scene. 1024 square, genuine alpha outside tile.
