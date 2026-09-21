#!/usr/bin/env node
/**
 * Obsidian → Quartz 兼容性体检
 * ---------------------------------------------------------------------------
 * 用法：
 *   node scripts/obsidian-compat-lint.mjs                # 体检 content/（= 实际上线的内容）
 *   node scripts/obsidian-compat-lint.mjs "E:\Obisidian\生信学习"  # 体检 Obsidian 库（更早发现问题）
 *   node scripts/obsidian-compat-lint.mjs content --quiet
 *
 * 退出码：有 error 时返回 1（可直接当 CI 门禁）
 */
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const rootDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "content")
const quiet = args.includes("--quiet")

const problems = []
const stats = { files: 0, images: 0, imagesNoWidth: 0, callouts: 0, wikilinks: 0, nbspIndent: 0 }

const splitLines = (t) => t.split(/\r\n|\r|\n/)

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue
    if (e.isDirectory()) {
      if (["node_modules", "public", "quartz", "docs", "TaskNotes", "Excalidraw"].includes(e.name))
        continue
      walk(path.join(dir, e.name), out)
    } else if (e.name.endsWith(".md")) {
      out.push(path.join(dir, e.name))
    }
  }
  return out
}

function getFrontmatter(text) {
  const ls = splitLines(text)
  if ((ls[0] ?? "").trim() !== "---") return { fm: "", bodyStart: 0 }
  const end = ls.indexOf("---", 1)
  if (end === -1) return { fm: "", bodyStart: 0 }
  return { fm: ls.slice(1, end).join("\n"), bodyStart: end + 1 }
}

const isPublished = (fm) => /^publish:\s*true\s*$/m.test(fm)

const files = walk(rootDir)

/* ── 第一遍：收集所有"已发布"笔记名，用于断链检测 ── */
const publishedNames = new Set()
for (const f of files) {
  const { fm } = getFrontmatter(fs.readFileSync(f, "utf8"))
  if (isPublished(fm)) publishedNames.add(path.basename(f, ".md"))
}

/* ── 第二遍：只体检会被发布的笔记 ── */
for (const f of files) {
  const rel = path.relative(rootDir, f).replaceAll("\\", "/")
  const text = fs.readFileSync(f, "utf8")
  const { fm, bodyStart } = getFrontmatter(text)
  if (!isPublished(fm)) continue

  stats.files++
  const ls = splitLines(text)
  const selfName = path.basename(rel, ".md")
  let inFence = false
  let fenceMark = ""

  for (let i = bodyStart; i < ls.length; i++) {
    const line = ls[i]
    const lineNo = i + 1

    /* 代码围栏跟踪 */
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
    if (inFence) {
      if (/dataview/i.test(line)) {
        problems.push({
          rel,
          lineNo,
          level: "error",
          msg: "dataview 查询：Quartz 不渲染（除非 quartz-syncer 已预渲染），建议不发布该笔记",
        })
      }
      continue
    }

    /* ① 缩进代码块风险：空行后以 Tab / 4 空格开头的正文 */
    if (/^(\t| {4})/.test(line) && (i === 0 || ls[i - 1].trim() === "")) {
      problems.push({
        rel,
        lineNo,
        level: "error",
        msg: `缩进代码块风险（空行后 Tab/4 空格开头，会被渲染成代码块）：${line.trim().slice(0, 40)}`,
      })
    }

    /* ② setext 标题风险：--- 紧跟非空行 */
    if (/^(---|===)\s*$/.test(line) && i > 0 && ls[i - 1].trim() !== "") {
      problems.push({
        rel,
        lineNo,
        level: "warn",
        msg: `setext 标题风险（上一行会被当成 H2）：${ls[i - 1].trim().slice(0, 40)}`,
      })
    }

    /* ③ 表格行里未转义的 wikilink / 竖线 */
    if (/^\s*\|/.test(line) && /!?\[\[/.test(line) && !/\\\|/.test(line)) {
      problems.push({
        rel,
        lineNo,
        level: "error",
        msg: "表格单元格里的 wikilink/图片未转义竖线：应写成 ![[img.png\\|200]]",
      })
    }

    /* ④ 行首缩进（非结构性）→ 同步器按 Markdown 规范会丢掉，提示迁移 */
    if (/^(\t| {2,})/.test(line) && !/^(\t| )*([-*+](?=\s)|\d+[.)](?=\s)|>|#|\||`)/.test(line)) {
      problems.push({
        rel,
        lineNo,
        level: "info",
        msg: "行首缩进会被视为无意义空白（同步器会删除）→ 跑 scripts/obsidian-indent-to-nbsp.mjs",
      })
    }

    /* ⑧ 非结构性缩进（NBSP）：能渲染出竖线，但不进大纲、换行点两端不一致 → 提示改写 */
    const nbspIndent = /^(\u00a0+)/.exec(line)
    if (nbspIndent && nbspIndent[1].length >= 4) {
      stats.nbspIndent++
      problems.push({
        rel,
        lineNo,
        level: "info",
        msg: `非结构性缩进（${nbspIndent[1].length} 个 NBSP）：不进大纲、换行点与 Obsidian 不一致 → 建议改成嵌套列表或 #### 小标题（见 OBSIDIAN-WRITING.md）：` +
          line.replace(/^(\u00a0+)/, "").trim().slice(0, 30),
      })
    }

    /* ⑤ 图片嵌入：统计 + 不支持的语法 */
    for (const m of line.matchAll(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)) {
      stats.images++
      const target = m[1].trim()
      const alias = (m[2] ?? "").trim()
      if (/\.base$/i.test(target)) {
        problems.push({
          rel,
          lineNo,
          level: "error",
          msg: `Bases 视图嵌入（Quartz 不支持）：${target}`,
        })
      } else if (/\.excalidraw$/i.test(target)) {
        problems.push({
          rel,
          lineNo,
          level: "error",
          msg: `Excalidraw 嵌入（Quartz 不渲染）：${target} → 请导出 PNG 后嵌入`,
        })
      } else if (!/\d+(x\d+)?$/.test(alias)) {
        stats.imagesNoWidth++
        problems.push({
          rel,
          lineNo,
          level: "info",
          msg: `图片未指定宽度（显示尺寸会随列宽变化）：${target}`,
        })
      }
    }

    /* ⑥ 标准图片语法里的 |尺寸：Obsidian 支持，Quartz 不解析 */
    if (/!\[[^\]]*\|[^\]]*\]\(/.test(line)) {
      problems.push({
        rel,
        lineNo,
        level: "warn",
        msg: "标准图片语法 ![]( ) 里的 |尺寸 Quartz 不解析 → 改用 ![[图片|宽度]]",
      })
    }

    stats.wikilinks += (line.match(/\[\[/g) ?? []).length
    if (/^\s*>\s*\[!/.test(line)) stats.callouts++

    /* ⑦ 链接到未发布笔记 → 线上断链（(?<!!) 排除图片嵌入 ![[...]]） */
    for (const m of line.matchAll(/(?<!!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]*)?\]\]/g)) {
      const target = path.basename(m[1].trim(), ".md")
      if (target !== selfName && !publishedNames.has(target)) {
        problems.push({ rel, lineNo, level: "warn", msg: `链接到未发布笔记（线上断链）：${target}` })
      }
    }
    for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+\.md)\)/g)) {
      const target = path.basename(decodeURIComponent(m[1]), ".md")
      if (target !== selfName && !publishedNames.has(target)) {
        problems.push({ rel, lineNo, level: "warn", msg: `链接到未发布笔记（线上断链）：${target}` })
      }
    }
  }

  if (inFence) problems.push({ rel, lineNo: ls.length, level: "error", msg: "代码围栏未闭合" })
}

/* ── 输出 ── */
const order = { error: 0, warn: 1, info: 2 }
problems.sort(
  (a, b) => order[a.level] - order[b.level] || a.rel.localeCompare(b.rel) || a.lineNo - b.lineNo,
)

const errors = problems.filter((p) => p.level === "error").length
const warns = problems.filter((p) => p.level === "warn").length
const infos = problems.filter((p) => p.level === "info").length
const icon = { error: "✖", warn: "⚠", info: "ℹ" }

if (!quiet) {
  let last = ""
  for (const p of problems) {
    if (p.rel !== last) {
      console.log(`\n── ${p.rel}`)
      last = p.rel
    }
    console.log(`  ${icon[p.level]} L${p.lineNo}  ${p.msg}`)
  }
}

console.log(
  `\n体检目录: ${rootDir}\n` +
    `发布笔记 ${stats.files} 篇 ｜ 图片 ${stats.images}（其中 ${stats.imagesNoWidth} 张未指定宽度）` +
    ` ｜ Callout ${stats.callouts} ｜ 双链 ${stats.wikilinks} ｜ 非结构性缩进 ${stats.nbspIndent} 行\n` +
    `结果: ${errors} error / ${warns} warn / ${infos} info\n`,
)

process.exit(errors > 0 ? 1 : 0)
