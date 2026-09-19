import { QuartzTransformerPlugin } from "../types"

/**
 * Obsidian 源文本规范化（在 remark 解析之前改写原始 Markdown）
 * ============================================================================
 * 背景：quartz-syncer 同步时会对 Markdown 走一次 remark round-trip，它会
 *   1. 把行首 Tab 展开成 2 个空格
 *   2. 把列表标记 `*` 规范化成 `-`
 *   3. 给「被判定为列表续行」的行凭空补上前导空格
 *
 * 实测对照（生信学习手册/智能基因组手册.md）：
 *   vault 原文                    →  content/ 同步后
 *   `② Shortcut：捷径`   (无缩进)  →  `····②Shortcut：捷径`   → 被吞进上一个列表项 ⇒ 断级
 *   `\t* 同源序列…`      (Tab)     →  `··- 同源序列…`          → 合法开启真列表 ⇒ 断级
 *   `    测试集信息…`    (4 NBSP)  →  `··    测试集信息…`      → 缩进被抬高
 *
 * 关键判据（本插件的核心思路）：
 *   · 用户在 Obsidian 里的真实缩进是 **NBSP**（由 scripts/obsidian-indent-to-nbsp.mjs 迁移而来，
 *     因为只有 NBSP 不会被 round-trip 吃掉）
 *   · 所以 content/ 里出现的**行首普通空格**基本都是同步器伪影
 *
 * 规则清单：
 *   A. 非结构行：剥掉行首普通空格（同步器伪影），保留 Tab + NBSP 并量化到 4 的整数倍
 *   B. 带缩进的列表标记行：若上一行不是真列表项（没有可嵌套的父列表）→ 判定为「视觉缩进的伪列表」，
 *      把行首空格转成 NBSP 令其退化为普通文本 —— 与 Obsidian 一致（Obsidian 里它们就是字面 `*`）
 *   C. 真嵌套列表（上一行确实是列表项）保持原样，交给 CommonMark 正常嵌套
 *   D. 只含空白的行归一化成真空行
 *   E. **列表终止**：CommonMark 的 lazy continuation 会把「紧跟在列表项后面、顶格、又不是列表」
 *      的行吞进上一个列表项；Obsidian 则在遇到顶格普通行时结束列表。
 *      这里在两者之间补一个空行，让网页与 Obsidian 一致。
 *      （实测：L272 `- 测试集…` 与 L273 `==数据划分原则…==` 之间没有空行，
 *        导致 L273-298 整块被吞进 <li>，① ② 全部掉进列表里。）
 *
 * 安全性：全库扫描「带缩进的列表标记行」共 13 处 —— 真嵌套 3 处（VCC 手册 450-452，父项是 `3.`）、
 * 伪列表 10 处（智能基因组手册 280-284 / 288-292，父行是普通文本）。规则 C 保住前者、B 修掉后者。
 */

const NBSP = "\u00A0"
/** Obsidian 默认 tab 宽度 = 4 列；一级缩进 = 4 个 NBSP */
const INDENT_UNIT = 4

/** 结构性行首：默认交给 CommonMark 正常解析（列表标记另走伪列表判定） */
const STRUCTURAL = /^(>|#|\||`|\[!|={3,}$|-{3,}$|\*{3,}$)/
const LIST_MARK = /^([-*+]|\d+[.)])\s/
const FENCE = /^\s*(`{3,}|~{3,})/

type Lead = { width: number; raw: string; nbsp: number; tabs: number }

/** 量一行前导空白：分别统计「列宽」「NBSP 个数」「Tab 个数」 */
function readLead(line: string): Lead {
  let width = 0
  let nbsp = 0
  let tabs = 0
  let i = 0
  for (; i < line.length; i++) {
    const ch = line[i]
    if (ch === "\t") {
      width += INDENT_UNIT
      tabs += 1
    } else if (ch === " ") width += 1
    else if (ch === NBSP) {
      width += 1
      nbsp += 1
    } else break
  }
  return { width, raw: line.slice(0, i), nbsp, tabs }
}

/** 列宽量化到层级（四舍五入；1~2 列这种同步器伪影会归零） */
function toLevels(width: number): number {
  return Math.round(width / INDENT_UNIT)
}

/** 把层级还原成 NBSP 前缀 */
const indentOf = (levels: number): string => NBSP.repeat(Math.max(0, levels) * INDENT_UNIT)

export function normalizeObsidianSource(src: string): string {
  const lines = src.split(/\r\n|\r|\n/)
  const eol = src.includes("\r\n") ? "\r\n" : "\n"

  let bodyStart = 0
  if ((lines[0] ?? "").trim() === "---") {
    const end = lines.indexOf("---", 1)
    if (end !== -1) bodyStart = end + 1
  }

  const out: string[] = lines.slice(0, bodyStart)

  let inFence = false
  let fenceMark = ""
  /** 上一条已输出行是否为「真列表项」，及其缩进层级 */
  let prevIsItem = false
  let prevItemLevel = -1
  /** 上一条已输出行是否为空行 */
  let prevBlank = true

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i]

    if (FENCE.test(line)) {
      const mark = FENCE.exec(line)![1][0]
      if (!inFence) {
        inFence = true
        fenceMark = mark
      } else if (mark === fenceMark) {
        inFence = false
      }
      out.push(line)
      prevIsItem = false
      prevItemLevel = -1
      prevBlank = line.trim() === ""
      continue
    }
    if (inFence) {
      // 代码块内的缩进是内容本身，必须原样保留
      out.push(line)
      continue
    }

    if (line.trim() === "") {
      out.push("")
      prevBlank = true
      continue // 空行不改变 prevIsItem：CommonMark 里空行后仍可续列表
    }

    const lead = readLead(line)
    const rest = line.slice(lead.raw.length)
    const level = toLevels(lead.width)
    const isMark = LIST_MARK.test(rest)
    const isStruct = STRUCTURAL.test(rest)

    let text: string
    let isItem = false

    if (isStruct) {
      // 真结构（引用 / 标题 / 表格 / 围栏 / callout）：原样保留
      text = line
    } else if (isMark) {
      if (lead.width === 0) {
        text = line
        isItem = true
      } else {
        // 同级(>=)或更深(>)都算真嵌套：CommonMark 里兄弟列表项缩进相同
        const canNest = prevIsItem && level >= prevItemLevel
        if (canNest) {
          text = line // 保持原样，CommonMark 会正确嵌套
          isItem = true
        } else {
          // 伪列表：转成 NBSP 缩进的普通文本（Obsidian 里它们本就是字面 `*`）
          text = indentOf(Math.max(1, level)) + rest
        }
      }
    } else if (lead.width === 0) {
      // 顶格普通行：不动
      text = line
    } else {
      // 普通行：剥掉同步器伪影（行首空格），保留用户真实缩进（Tab + NBSP）并量化
      text = indentOf(lead.tabs + toLevels(lead.nbsp)) + rest
    }

    // 规则 E：顶格普通行紧跟在列表项之后 → 补空行终止列表（对齐 Obsidian）
    if (
      prevIsItem &&
      !isItem &&
      !isStruct &&
      readLead(text).width === 0 &&
      !prevBlank
    ) {
      out.push("")
    }

    out.push(text)
    prevBlank = false
    prevIsItem = isItem
    if (isItem) prevItemLevel = level
    else prevItemLevel = -1
  }

  return out.join(eol)
}

export const ObsidianSource: QuartzTransformerPlugin = () => ({
  name: "ObsidianSource",
  textTransform(_ctx, src) {
    return normalizeObsidianSource(src)
  },
})
