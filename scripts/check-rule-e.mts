import { readFileSync, readdirSync } from "node:fs"
import { normalizeObsidianSource } from "../quartz/plugins/transformers/obsidianSource"

const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue
    const p = d + "/" + e.name
    if (e.isDirectory()) walk(p, out)
    else if (p.endsWith(".md")) out.push(p)
  }
  return out
}

let ins = 0,
  changedFiles = 0
const notes = []
for (const f of walk("content")) {
  const raw = readFileSync(f, "utf8")
  const bl = raw.split(/\r?\n/)
  const al = normalizeObsidianSource(raw).split(/\r?\n/)
  const delta = al.length - bl.length
  if (delta > 0) {
    ins += delta
    changedFiles++
    notes.push(`${f.replace("content/", "")}  +${delta} 空行`)
  }
  // 行数不变时逐行比对，确认只改了行首
  if (delta === 0) {
    let bad = 0
    for (let i = 0; i < bl.length; i++) if (bl[i].trim() !== al[i].trim()) bad++
    if (bad) notes.push(`${f.replace("content/", "")}  行内改动 ${bad}（行数不变）`)
  }
}
console.log(`插入空行总数=${ins}  涉及文件=${changedFiles}`)
console.log(notes.join("\n"))
