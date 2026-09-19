import { Element, ElementContent, Root, Text } from "hast"
import { visit } from "unist-util-visit"

import { QuartzTransformerPlugin } from "../types"

/**
 * 正文缩进引导线（B3）
 *
 * Obsidian 里的"缩进"同步进 Quartz 后只剩行首的不间断空格（NBSP, U+00A0）——
 * 普通空格会被同步器吃掉（见 scripts/obsidian-indent-to-nbsp.mjs）。
 * 本插件给这些缩进行补一条灰色竖线（用 CSS border 画，不是输入字符），
 * 观感对齐 Obsidian 的缩进参考线。
 *
 * 做法：把「行首 NBSP 之后的内容」包进 <span class="obs-indent-guide">，
 * 该 span 的 border-left 正好落在缩进位置上；行首 NBSP 本身保留不动，
 * 因此文字位置与加插件前完全一致（零位移、零内容改动）。
 */

/** 只有这些容器里才可能出现"用 <br> 分行的行内缩进" */
const CONTAINERS = new Set(["p", "li", "td", "th"])

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

/** 行首缩进量：跳过换行符后数连续的 NBSP（HTML 里每行前常有 \n 文本节点） */
function leadingIndent(line: Line): number {
  const first = line[0]
  if (!first || first.type !== "text") return 0
  const m = /^[\r\n]*(\u00a0+)/.exec(first.value)
  return m ? m[1].length : 0
}

/**
 * 去掉行首残留的换行符。
 *
 * 背景：markdown 的换行被 hard-line-breaks 转成 <br/> 后，文本节点里的 \n 仍留着
 * （<br/>\n····正文）。white-space 正常时它只算个空格，但我们为了保留缩进开了
 * pre-wrap，于是这个 \n 又额外断了一次行 —— 每行之间多出一个空行（行距 24px→48px）。
 * 这里把它去掉，行距恢复成 Obsidian 的紧凑行距，缩进竖线也能连成一条整线。
 */
function stripLeadingNewline(line: Line): boolean {
  const first = line[0]
  if (!first || first.type !== "text") return false
  const m = /^\r?\n/.exec(first.value)
  if (!m) return false
  first.value = first.value.slice(m[0].length)
  return true
}

/**
 * 给一行加引导线：保留行首 NBSP，把它后面的内容包进带 border-left 的 span。
 * 返回 null 表示这行不需要处理（例如整行只有 NBSP 的空缩进行）。
 */
function withGuide(line: Line): Line | null {
  const first = line[0] as Text
  const m = /^([\r\n]*\u00a0+)([\s\S]*)$/.exec(first.value)
  if (!m) return null

  const [, prefix, rest] = m
  const inner: ElementContent[] = []
  if (rest.length > 0) {
    inner.push({ type: "text", value: rest })
  }
  inner.push(...line.slice(1))
  if (inner.length === 0) return null

  return [
    { type: "text", value: prefix },
    {
      type: "element",
      tagName: "span",
      properties: { className: ["obs-indent-guide"] },
      children: inner,
    },
  ]
}

function rehypeObsidianIndent() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
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
        if (stripLeadingNewline(line)) {
          changed = true
        }
        const guided = leadingIndent(line) > 0 ? withGuide(line) : null
        if (guided) {
          changed = true
          rebuilt.push(...guided)
        } else {
          rebuilt.push(...line)
        }
      })

      if (changed) {
        node.children = rebuilt
      }
    })
  }
}

export const ObsidianIndent: QuartzTransformerPlugin = () => ({
  name: "ObsidianIndent",
  htmlPlugins() {
    return [rehypeObsidianIndent]
  },
})
