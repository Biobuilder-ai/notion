#!/usr/bin/env node
/**
 * Obsidian 行首 NBSP 缩进 → 真列表（路线 3：结构用列表，视觉用缩进）
 * ---------------------------------------------------------------------------
 * 用法：
 *   node scripts/obsidian-indent-to-list.mjs "<文件或目录>"          # dry-run
 *   node scripts/obsidian-indent-to-list.mjs "<文件或目录>" --write  # 落盘（自动备份）
 *
 * 只处理一种明确模式：
 *   父行（无缩进）            →  - 父行
 *   ⇥×4 子行                 →    - 子行
 *   ⇥×8 孙行                 →      - 孙行
 *
 * 保守规则（一律不动 + 报告原因）：
 *   - 代码围栏内、表格、引用块、已经是列表的行（整块不参与）
 *   - 块首行就带缩进（找不到父行）
 *   - 缩进层级一次跳超过 1 级
 *   - 行首内容本身是块语法（# > | - * + 1. [ 等）→ 转列表会改变语义
 */
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const doWrite = args.includes("--write")
const targets = args.filter((a) => !a.startsWith("--"))
if (targets.length === 0) {
  console.log("用法: node scripts/obsidian-indent-to-list.mjs <文件或目录> [--write]")
  process.exit(1)
}

const NBSP = "\u00a0"
const UNIT = 4 // 一级缩进 = 4 个 NBSP（与 obsidian-indent-to-nbsp.mjs 一致）
const INDENT = "  " // 每级 2 个空格（不用 Tab、不用 4 空格）
const FENCE = /^\s*(```|~~~)/
// 遇到结构性行（标题 / 引用 / 表格）就断开成两个块，避免一行标题把整块卡住
const SPLIT = /^\s*(#{1,6}\s|>\s|\|)/
const BLOCK_START = /^(#|>|\||!?\[\[|\[[ xX]?\])/
const MARKER = /^([-*+]|\d+[.)])(\s|$)/
const MARKER_NOSEP = /^([-*+])(?=\S)/

function walk(p, out = []) {
  const st = fs.statSync(p)
  if (st.isFile()) {
    out.push(p)
    return out
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue
    const full = path.join(p, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.name.endsWith(".md")) out.push(full)
  }
  return out
}

const levelOf = (line) => {
  let n = 0
  while (n < line.length && line[n] === NBSP) n++
  return { nbsp: n, level: n >= UNIT ? Math.floor(n / UNIT) : 0 }
}

const strip = (line) => line.replace(/^\u00a0+/, "").replace(/^\s+/, "").replace(/\s+$/, "")


/**
 * 处理一个「连续非空行」块。
 * 返回：
 *   null                  → 整块没有行首缩进，不需处理
 *   { skip: "原因" }      → 有风险，整块不动，交给调用方记录
 *   { head, list, tail }  → 转换结果（head/tail 原样保留）
 *
 * 两条规则：
 *   A. 父行（无缩进）+ ⇥×N 正文行      → 正文行变成嵌套列表项（自动补 - ）
 *   B. 父行 + ⇥×N 已经自带 - / 1. 标记 → 保留原标记，只把 NBSP 换成 2 空格缩进
 *      （B 里用户已经写了标记，意图零歧义；-优点 这种漏空格的会补上并记录）
 */
function tryBlock(block) {
  const info = block.map(levelOf)
  const firstIndented = info.findIndex((x) => x.level > 0)
  if (firstIndented === -1) return null
  if (firstIndented === 0)
    return { skip: "整块每行都带缩进（找不到父行，需人工判断是不是列表）" }

  let last = firstIndented
  for (let k = info.length - 1; k > firstIndented; k--) {
    if (info[k].level > 0) {
      last = k
      break
    }
  }

  const head = block.slice(0, firstIndented - 1)
  const tail = block.slice(last + 1)
  const mid = block.slice(firstIndented - 1, last + 1)
  const midInfo = info.slice(firstIndented - 1, last + 1)
  if (midInfo[0].level !== 0) return { skip: "父行本身带缩进" }

  const notes = []
  const hasMarker = mid.some((x) => MARKER.test(strip(x)))
  const list = []

  for (let k = 0; k < mid.length; k++) {
    const c = strip(mid[k])
    const lvl = midInfo[k].level
    if (c === "") return { skip: "区间内有空行" }
    if (BLOCK_START.test(c))
      return {
        skip: "行首是块语法（标题/引用/表格/嵌入/任务框），转列表会改语义：" + c.slice(0, 30),
      }
    if (k > 0 && lvl > midInfo[k - 1].level + 1)
      return { skip: "缩进层级一次跳超过 1 级：" + c.slice(0, 30) }

    if (MARKER.test(c)) {
      list.push(INDENT.repeat(lvl) + c)
    } else if (hasMarker && MARKER_NOSEP.test(c)) {
      const fixed = c.replace(MARKER_NOSEP, "$1 ")
      notes.push("补列表标记后的空格：" + c.slice(0, 18) + " → " + fixed.slice(0, 20))
      list.push(INDENT.repeat(lvl) + fixed)
    } else {
      list.push(INDENT.repeat(lvl) + "- " + c)
    }
  }
  return { head, list, tail, notes }
}


function convertFile(file) {
  const raw = fs.readFileSync(file, "utf8")
  const eol = raw.includes("\r\n") ? "\r\n" : "\n"
  const lines = raw.split(/\r?\n/)
  let bodyStart = 0
  if ((lines[0] ?? "").trim() === "---") {
    const end = lines.indexOf("---", 1)
    if (end !== -1) bodyStart = end + 1
  }

  // 关键：先把 frontmatter 原样搬过去，否则整段 YAML 会被丢掉（曾踩过）
  const out = lines.slice(0, bodyStart)
  const notes = []
  let inFence = false
  let i = bodyStart
  let blocks = 0
  let items = 0

  while (i < lines.length) {
    const l = lines[i]
    if (FENCE.test(l)) {
      inFence = !inFence
      out.push(l)
      i++
      continue
    }
    if (inFence || l.trim() === "") {
      out.push(l)
      i++
      continue
    }
    let j = i
    while (j < lines.length && lines[j].trim() !== "" && !FENCE.test(lines[j]) && !SPLIT.test(lines[j])) j++
    if (j === i) { out.push(lines[i]) ; i++; continue }
    const block = lines.slice(i, j)
    const r = tryBlock(block)
    if (r && r.skip) {
      notes.push({ line: i + 1, why: r.skip })
      out.push(...block)
    } else if (r) {
      blocks++
      items += r.list.length
      for (const nn of r.notes ?? []) notes.push({ line: i + 1, why: nn })
      if (r.head.length) out.push(...r.head)
      if (out.length && out[out.length - 1].trim() !== "") out.push("")
      out.push(...r.list)
      if (r.tail.length) {
        out.push("")
        out.push(...r.tail)
      }
    } else {
      out.push(...block)
    }
    i = j
  }

  const text = out.join(eol)
  if (bodyStart > 0 && out.slice(0, bodyStart).join("\\n") !== lines.slice(0, bodyStart).join("\\n")) { return { text: raw, blocks: 0, items: 0, notes: [{ line: 1, why: "frontmatter 校验失败，放弃修改" }], changed: false, eol } }
  return { text, blocks, items, notes, changed: text !== raw, eol }
}


const base = process.env.TEMP ?? process.env.TMP ?? "."
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const tmpDir = path.join(base, "obsidian-indent-to-list")
const bakDir = path.join(base, "obsidian-indent-list-backup", stamp)
fs.mkdirSync(tmpDir, { recursive: true })

const flat = (f) => f.replace(/^[A-Za-z]:/, "drv").replace(/[\\/:*?\"<>|]+/g, "_") + ".md"

let touched = 0
let totalBlocks = 0
let totalItems = 0
let totalNotes = 0

for (const t of targets) {
  for (const file of walk(path.resolve(t))) {
    const r = convertFile(file)
    if (!r.changed) continue
    touched++
    totalBlocks += r.blocks
    totalItems += r.items
    totalNotes += r.notes.length

    console.log("\n=== " + file)
    console.log(
      "  转换 " + r.blocks + " 个块 / " + r.items + " 行列表项" +
        (r.notes.length ? "，跳过 " + r.notes.length + " 处" : ""),
    )
    for (const n of r.notes) console.log("  ⚠ L" + n.line + "  " + n.why)

    const preview = path.join(tmpDir, flat(file))
    fs.writeFileSync(preview, r.text, "utf8")
    console.log("  预览: " + preview)

    if (doWrite) {
      const bak = path.join(bakDir, flat(file))
      fs.mkdirSync(bakDir, { recursive: true })
      fs.copyFileSync(file, bak)
      fs.writeFileSync(file, r.text, "utf8")
      console.log("  ✔ 已写入，原文件备份: " + bak)
    }
  }
}

console.log(
  "\n合计: " + touched + " 个文件 / " + totalBlocks + " 个块 / " + totalItems +
    " 行列表项 / " + totalNotes + " 处跳过",
)
if (!doWrite) console.log("（dry-run，未修改任何文件；加 --write 才落盘）")
