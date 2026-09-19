import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { ObsidianSource } from "./quartz/plugins/transformers/obsidianSource"
import { ObsidianIndent } from "./quartz/plugins/transformers/obsidianIndent"

const config = await loadQuartzConfig()

// 自定义 transformer（非 npm 插件，直接挂在配置里）。顺序有意义：
//   1. ObsidianSource  —— textTransform，在 remark 解析**之前**把行首缩进规范化成
//      NBSP 网格（修「① ② 断级」+ 让缩进层级规整）
//   2. ObsidianIndent  —— htmlPlugins，把量化后的行首缩进画成每级一条引导竖线
config.plugins.transformers.unshift(ObsidianSource())
config.plugins.transformers.push(ObsidianIndent())

export default config
export const layout = await loadQuartzLayout()
