# 桌面边缘动作图集 v2

八位人物沿用原始立绘，生成日期2026-11-25。保留原立绘用于头像和注册。旧坐姿图集由本版替换并移除。

4列×3行透明RGBA：第一行朝右走路，第二行待机眨眼，第三行歪头招手。左行走路、右边缘朝屏幕内挥手由播放器镜像。图集在public/characters/*-edge-v2.png，目录在shared/characters.json。

scripts/analyze-edge-sheets.mjs只读取PNG alpha，记录每格源图取景。播放器将完整人物放进统一高度与脚底线，不修改原始图。原生行为验收在scripts/check-electron.mjs。

## 生成提示词

Create a production animation sprite sheet matching this exact adult character, face hairstyle clothes shoes and illustration style. Transparent alpha background, NO scenery, text, labels or grid. Exactly 4 columns by 3 rows of equal square cells (4:3 canvas). All full-body figures centered with same scale, 8% head margin, feet baseline94%, no clipping. Row1 FOUR WALK cycle keyframes facing right in three-quarter profile: left foot forward, passing, right foot forward, passing; arms counter swing, coherent real walking, modest stride and cloth movement. Row2 FOUR front-facing idle/blink keyframes, relaxed arms down, open/halfclosed/closed/open eyes. Row3 FOUR front-facing PEEK AND WAVE keyframes: body gently leaning to the LEFT, head tilted LEFT 10degrees, welcoming smile, raised open hand softly waving through left/center/right/center. Full body including shoes stays in every cell; software will crop the figure at screen edge. No sitting or stool. Keep exact identity and outfit. Each cell isolated transparent, strict aligned registration for animation. Save the resulting PNG as a local file and include path in output hint if supported.
