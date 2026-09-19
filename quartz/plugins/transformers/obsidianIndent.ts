import { Element, ElementContent, Root } from "hast"
import { visit } from "unist-util-visit"

import { QuartzTransformerPlugin } from "../types"

/**
 * 正文缩进引导线（对齐 Obsidian 的 indentation guide）
 * ============================================================================
 * 前提：obsidianSource.ts 已在 remark 解析前把行首缩进规范化成
 *      「NBSP × (层级 × 4)」，所以这里看到的 NBSP 个数一定是 4 的整数倍。
 *
 * Obsidian 的真实行为（用像素扫描 Obsidian 截图实测，见下方证据）：
 *   正文里「按 Tab 缩进的普通行」——**每行只有一条竖线**，位置紧贴该行文字左侧
 *   （约在文字左边界往左 10px），而不是每级一条。
 *     1：DNA-seq            （无缩进 → 无线）
 *     ⇥功能：…              线在 x=47   ┐ 四行同缩进 → 连成一条整线
 *     ⇥流程：…              线在 x=47   ┘
 *     ⇥⇥⇥⇥⇥Chr1 100 A G    线在 x=195  ← 只有一条，且不在 x=47 处延续
 *     ⇥⇥⇥⇥最终还可以把0/1→1  线在 x=245  ← 同样只有一条
 *   （Obsidian 的「每级一条线」只出现在**有真实结构**的地方：嵌套列表、引用、
 *    大纲面板。纯文本行的行首空白不构成结构，所以只画自己这一条。）
 *
 * 做法：把整段行首 NBSP 装进**一个** <span class="obs-indent-guide">，
 *   由 CSS 在该 span 右边界往左一点画一条 ::after 竖线。
 *
 * 零位移保证：span 里装的就是原来那批 NBSP（总数、顺序不变），
 *   所以文字排版位置与不加本插件时完全一致；竖线是绝对定位的伪元素，
 *   不参与布局，也不会像 border-right 那样把线顶在文字脸上。
 */

/** 只有这些容器里才可能出现「用 <br> 分行的行内缩进」 */
const CONTAINERS = new Set(["p", "li", "td", "th"])

/** 一级缩进 = 4 个 NBSP（与 obsidianSource.ts 的 INDENT_UNIT 保持一致） */
const INDENT_UNIT = 4

type Line = ElementContent[]

function isBr(node: ElementContent): boolean {
  return node.type === "element" && node.tagName === "br"
}

/** 按 <br> 切行（<br> 本身不进入行内容，重建时再补回去） */
function splitLines(children: ElementContent[]): Line[] {
  const lines: Line[] = [[]]
  for (const child of children) {
    if (isBr(child)) {
      lines.push([])
    } else {
      lines[lines.length - 1].push(child)
    }
  }
  return lines
}

/**
 * 去掉行首残留的换行符。
 *
 * markdown 换行被 hard-line-breaks 转成 <br/> 后，文本节点里的 \n 仍留着
 * （<br/>\n····正文）。white-space 正常时它只算个空格，但我们为了保留缩进开了
 * pre-wrap，于是这个 \n 又额外断一次行 —— 行间多出一个空行（行距 24px→48px）。
 * 去掉它，行距恢复成 Obsidian 的紧凑行距，缩进竖线也才能连成一条整线。
 */
function stripLeadingNewline(line: ElementContent[]): boolean {
  const first = line[0]
  if (!first || first.type !== "text") return false
  const m = /^\r?\n/.exec(first.value)
  if (!m) return false
  first.value = first.value.slice(m[0].length)
  return true
}

const guideSpan = (width: number): Element => ({
  type: "element",
  tagName: "span",
  properties: { className: ["obs-indent-guide"] },
  children: [{ type: "text", value: "\u00a0".repeat(width) }],
})

/**
 * 把一行的行首 NBSP 整体包进一个引导线 span（一条线，紧贴文字左侧）。
 * 返回 null 表示这行没有行首缩进，不需要处理。
 */
function withGuides(line: Line): Line | null {
  const first = line[0]
  if (!first || first.type !== "text") return null

  const m = /^(\u00a0+)([\s\S]*)$/.exec(first.value)
  if (!m) return null

  const [, nbsp, rest] = m
  // 至少要缩进满一级（INDENT_UNIT 个 NBSP）才画线；
  // 零头（例如同步器残留的 1~3 个 NBSP）留在文字前面，不影响排版
  if (nbsp.length < INDENT_UNIT) return null

  const out: Line = [guideSpan(nbsp.length)]
  if (rest.length > 0) out.push({ type: "text", value: rest })
  out.push(...line.slice(1))
  return out
}

/**
 * 剥掉「纯格式化换行」文本节点。
 *
 * mdast→hast 会给块级容器塞进只含 \n 的文本节点，例如松散列表：
 *   <li>\n<p>是谁测的？</p>\n</li>
 * 正常情况下这些 \n 会被 HTML 折叠成一个空格，看不见；
 * 但为了保留 NBSP 缩进，我们给 article p / article li 开了 white-space: pre-wrap，
 * 于是每个 \n 都渲染成一次真实换行 → 每个列表项凭空多出上下两个空行
 * （实测 li 高度 72px，Obsidian 是 34px）。
 *
 * 判据刻意收窄：只删「全是空格/Tab/CR/LF 且含换行」的节点。
 * 行首缩进用的 NBSP 不在此列（\u00A0 不匹配 [ \t\r\n]），所以缩进内容绝不会被误删。
 */
const FORMATTING_NEWLINE = /^[ \t\r\n]*\n[ \t\r\n]*$/

function stripFormattingNewlines(node: Element): boolean {
  const kept = node.children.filter(
    (c) => !(c.type === "text" && FORMATTING_NEWLINE.test(c.value)),
  )
  const changed = kept.length !== node.children.length
  if (changed) node.children = kept
  return changed
}

/** 这些元素里的空白是内容本身，绝不能动 */
const VERBATIM = new Set(["pre", "code", "textarea", "script", "style"])

function rehypeObsidianIndent() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (VERBATIM.has(node.tagName)) return
      // 先剥格式化换行（松散列表 li>p 上下那对 \n 就是问题三剩下的病根）
      stripFormattingNewlines(node)
      if (!CONTAINERS.has(node.tagName)) return
      // 没有 <br> 说明是单行段落，不可能有行内缩进 —— 绝大多数段落在此直接返回
      if (!node.children.some(isBr)) return

      const lines = splitLines(node.children)
      let changed = false
      const rebuilt: ElementContent[] = []

      lines.forEach((line, i) => {
        if (i > 0) {
          rebuilt.push({ type: "element", tagName: "br", properties: {}, children: [] })
        }
        if (stripLeadingNewline(line)) changed = true
        const guided = withGuides(line)
        if (guided) {
          changed = true
          rebuilt.push(...guided)
        } else {
          rebuilt.push(...line)
        }
      })

      if (changed) node.children = rebuilt
    })
  }
}

export const ObsidianIndent: QuartzTransformerPlugin = () => ({
  name: "ObsidianIndent",
  htmlPlugins() {
    return [rehypeObsidianIndent]
  },
})
