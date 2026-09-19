#!/usr/bin/env node
/**
 * Obsidian 缩进 → NBSP 迁移工具
 * ---------------------------------------------------------------------------
 * 背景（已实测确认）：
 *   行首的 Tab / 空格在 Markdown 规范里是"无意义空白"。quartz-syncer 同步时
 *   会走一次 remark round-trip（remark-obsidian + remark-stringify），按规范把
 *   段落内的行首空白全部删掉 —— 所以 Obsidian 里能看到的缩进，到 Quartz 就没了。
 *   实测结论：
 *     行首 Tab / 4 空格  → 被删除
 *     行首 NBSP (\u00A0) → 完整保留（NBSP 不是可折叠空白，任何渲染器都不会吞掉）
 *     嵌套列表           → 完整保留（另一种可选方案）
 *   Obsidian 官方文档也建议用 &nbsp; 来"防止空格被折叠"，所以这是官方认可的做法。
 *
 * 本脚本把"行首缩进"从 Tab/空格 换成 NBSP，从而让缩进能活着到达 Quartz。
 * 只处理"非结构性"行首缩进：以 - * + / 1. / > / # / | / ` 开头的行保持原样，
 * 避免破坏嵌套列表、引用块、表格、代码围栏的真实结构。
 *
 * 用法：
 *   node scripts/obsidian-indent-to-nbsp.mjs "E:\Obisidian\生信学习\生信学习手册\智能基因组手册.md"          # 预览（不写盘）
 *   node scripts/obsidian-indent-to-nbsp.mjs "E:\Obisidian\生信学习" --write                              # 写入
 *   node scripts/obsidian-indent-to-nbsp.mjs <path> --tab-size=4 --quiet
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const args = process.argv.slice(2)
const write = args.includes("--write")
const quiet = args.includes("--quiet")
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const tabSize = Number((args.find((a) => a.startsWith("--tab-size=")) ?? "--tab-size=4").split("=")[1])
const targets = args.filter((a) => !a.startsWith("--"))
if (targets.length === 0) {
  console.error("用法: node scripts/obsidian-indent-to-nbsp.mjs <文件或目录> [--write] [--tab-size=4]")
  process.exit(2)
}

const NBSP = "\u00A0"
const splitLines = (t) => t.split(/\r\n|\r|\n/)
/** 结构性行首：嵌套列表 / 引用 / 标题 / 表格 / 代码围栏 —— 不能动 */
const STRUCTURAL = /^([-*+]|\d+[.)]|>|#|\||`|\[!)/

function walk(p, out = []) {
  const st = fs.statSync(p)
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue
      if (["node_modules", "public", "quartz", "docs", "TaskLists", "TaskNotes", "Excalidraw"].includes(e.name))
        continue
      walk(path.join(p, e.name), out)
    }
  } else if (p.endsWith(".md")) {
    out.push(p)
  }
  return out
}

const toNbsp = (ws) => ws.replace(/\t/g, NBSP.repeat(tabSize)).replace(/ /g, NBSP)

let totalChanged = 0
let totalFiles = 0

for (const target of targets) {
  for (const file of walk(path.resolve(target))) {
    const raw = fs.readFileSync(file, "utf8")
    const eol = raw.includes("\r\n") ? "\r\n" : "\n"
    const ls = splitLines(raw)

    /* frontmatter 结束位置 */
    let bodyStart = 0
    if ((ls[0] ?? "").trim() === "---") {
      const end = ls.indexOf("---", 1)
      if (end !== -1) bodyStart = end + 1
    }

    let inFence = false
    let fenceMark = ""
    let changed = 0
    const samples = []

    for (let i = bodyStart; i < ls.length; i++) {
      const line = ls[i]
      const fence = /^\s*(`{3,}|~{3,})/.exec(line)
      if (fence) {
        const mark = fence[1][0]
        if (!inFence) {
          inFence = true
          fenceMark = mark
        } else if (mark === fenceMark) {
          inFence = false
        }
        continue
      }
      if (inFence) continue // 代码块里的缩进是内容，必须保留

      const m = /^([\t ]+)(\S.*)$/.exec(line)
      if (!m) continue
      const [, ws, rest] = m
      if (STRUCTURAL.test(rest)) continue // 真实结构，别碰
      // 单个空格视为误输入，不动；只有 Tab 或 ≥2 空格才算"有意缩进"
      if (!ws.includes("\t") && ws.length < 2) continue

      const next = toNbsp(ws) + rest
      if (next !== line) {
        ls[i] = next
        changed++
        if (samples.length < 3) {
          samples.push(`   L${i + 1}: ${JSON.stringify(ws)} → ${toNbsp(ws).length}×NBSP  ${rest.slice(0, 40)}`)
        }
      }
    }

    if (changed > 0) {
      totalChanged += changed
      totalFiles++
      if (!quiet) {
        console.log(`\n${path.relative(process.cwd(), file)}  (${changed} 行)`)
        for (const s of samples) console.log(s)
      }
      if (write) {
        // 保险：写盘前把原文件备份到系统临时目录（Obsidian 库通常没有版本控制）
        const backupDir = path.join(os.tmpdir(), "obsidian-indent-backup", stamp)
        const backupPath = path.join(backupDir, path.basename(file))
        fs.mkdirSync(backupDir, { recursive: true })
        fs.copyFileSync(file, backupPath)
        if (!quiet) console.log(`   备份 → ${backupPath}`)
        const trailingEol = raw.endsWith(eol) ? eol : ""
        fs.writeFileSync(file, ls.join(eol) + trailingEol, "utf8")
      }
    }
  }
}

console.log(
  `\n${write ? "已写入" : "预览模式（未写盘，加 --write 才会修改文件）"}` +
    `：${totalFiles} 个文件 / ${totalChanged} 行行首缩进转为 NBSP\n`,
)
