import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { ObsidianIndent } from "./quartz/plugins/transformers/obsidianIndent"

const config = await loadQuartzConfig()

// 自定义 transformer（非 npm 插件，直接挂在配置里）：
// 正文缩进引导线 —— 见 quartz/plugins/transformers/obsidianIndent.ts
config.plugins.transformers.push(ObsidianIndent())

export default config
export const layout = await loadQuartzLayout()
