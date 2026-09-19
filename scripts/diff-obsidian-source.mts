import { readFileSync, readdirSync, statSync } from "node:fs"
import { normalizeObsidianSource } from "../quartz/plugins/transformers/obsidianSource"

const NBSP = "\u00A0"
const enc = (t) => {
  let lead = ""
  for (const ch of t) {
    if (ch === NBSP) lead += "N"
    else if (ch === " ") lead += "s"
    else if (ch === "\t") lead += "T"
    else break
  }
  return lead
}

const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue
    const p = d + "/" + e.name
    if (e.isDirectory()) walk(p, out)
    else if (p.endsWith(".md")) out.push(p)
  }
  return out
}

const only = process.argv[2]
const lines = []
for (const f of walk("content")) {
  if (only && !f.includes(only)) continue
  const raw = readFileSync(f, "utf8")
  const bl = raw.split(/\r?\n/)
  const al = normalizeObsidianSource(raw).split(/\r?\n/)
  let fence = false
  const changed = []
  for (let i = 0; i < bl.length; i++) if (bl[i] !== al[i]) changed.push(i)
  if (!changed.length) continue
  lines.push(`\n### ${f}  (${changed.length} 行改动)`)
  for (const i of changed) {
    const isFenceCtx = (() => {
      let inF = false
      for (let k = 0; k < i; k++) if (/^\s*(```|~~~)/.test(bl[k])) inF = !inF
      return inF
    })()
    lines.push(
      `  L${i + 1}${isFenceCtx ? " [代码块内!]" : ""}  B[${enc(bl[i]).padEnd(9)}] ${bl[i].replace(/^[\s\u00A0]*/, "").slice(0, 44)}`,
    )
    lines.push(
      `           A[${enc(al[i]).padEnd(9)}] ${al[i].replace(/^[\s\u00A0]*/, "").slice(0, 44)}`,
    )
  }
}
process.stdout.write(lines.join("\n") + "\n")
