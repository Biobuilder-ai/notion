# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

（推断，来源：用户 brief + 仓库证据，待确认）作者本人与同好读者：正在学习生物信息学（单细胞/测序分析方向）的中文使用者，在桌面浏览器查阅《生信学习手册》笔记；场景是检索概念、沿大纲/文件树连续阅读、经反链与图谱发现关联笔记。

## Product Purpose

把 Obsidian vault（content/）原样发布为可检索、可漫游的在线知识库《生信学习手册》。成功 = 读者数秒内定位一条笔记并舒适读完，且网页排版与 Obsidian 阅读视图保持一致。

## Positioning

「Obsidian 观感的公开知识库」：单换行、行首缩进、可读行宽、列表/缩进引导线等排版细节与 Obsidian 阅读视图逐像素对齐（quartz/styles/custom.scss 兼容层 + `npm run lint:compat` 体检），相邻产品做不到。

## Operating Context

- 内容源：Obsidian vault（content/，中文笔记 + Pasted image 截图）；private / templates / .obsidian / TaskNotes / Excalidraw 不发布。
- 构建：Quartz v5（node ≥22，npm ≥10.9.2），配置在 quartz.config.yaml；`npm run install-plugins` 后 `node quartz/bootstrap-cli.mjs build --serve -d content` 本地预览。
- 发布：GitHub Pages（biobuilder-ai.github.io/notion），Plausible 统计；SPA + popovers 开启；界面 zh-CN。
- 布局约定：左栏 = 内容大纲（TOC，h1~h6 全量），右栏 = 内容目录（explorer 文件树）+ 图谱 + 反链；移动端大纲隐藏、文件树抽屉化。

## Capabilities and Constraints

- 功能：全文搜索、文件树浏览、目录跟随滚动高亮、反链、关系图谱、暗色模式、阅读模式、面包屑、LaTeX（MathJax）、代码高亮、页面属性、加密页、RSS/sitemap。
- 硬约束（用户指定）：**不改动 content/ 中任何知识内容**；左大纲 / 右目录布局不动；本次只做前端视觉与动效美化。
- 硬约束（仓库既有承诺）：Obsidian 兼容排版层（700px 可读行宽、系统字体栈含中文回退、列表/缩进引导线、单换行渲染、行首空白保留）必须保留；字体本地化，不引入 Google Fonts 等网络字体。
- 工具约束：图像转换工具（cwebp / sips / magick / ffmpeg）均不可用，sharp 可用；素材以 PNG 交付。

## Brand Commitments

- **迷你小猪素材（用户明确绑定）**：8 张 PNG，位于 `E:\Obisidian\生信学习\网页设计素材\`——6 张蜡笔手绘小猪（摸头+爱心、拿扫帚扫地、读绿皮书、戴耳机听歌、躺平、趴在黑狗头上）+ 2 张真实迷你猪照片。手绘系列自带视觉基因：薄荷绿底、腮红粉皮肤、深褐描边、黄/红/绿小点缀。
- 站名《生信学习手册》（quartz.config.yaml pageTitle），界面文案 zh-CN。
- （推断）视觉基调：以手绘小猪贴纸为核心形象的「治愈绘本」气质（薄荷绿 / 奶油白 / 腮红粉 / 可可描边）；此条来自素材气质与 brief 推断，待用户确认。

## Evidence on Hand

- 小猪素材 8 张（路径见上）：真实存在，可裁切、抠底、组合使用。
- content/ 生信学习手册 现有笔记与截图：内容事实的唯一来源，不得虚构其中未写的结论或数据。
- 无用户调研、无读者数据、无既有品牌规范文件；未来工作不得编造这三类材料。

## Product Principles

1. 内容呈现忠于 Obsidian：排版兼容层的像素级约定优先于任何视觉偏好。
2. 形象只用真实素材：小猪世界由既有手绘贴纸承担，不用几何图形假冒插画。
3. 动效解释状态与连续性：进场、导航、反馈各司其职；prefers-reduced-motion 下保留含义、去掉位移。
4. 阅读优先：治愈感落在周边（侧栏、页脚、404、空状态），不干扰正文阅读节奏。
