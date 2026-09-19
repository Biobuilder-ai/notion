import { readFileSync } from "node:fs"
import { normalizeObsidianSource } from "../quartz/plugins/transformers/obsidianSource"

const file = process.argv[2] ?? "content/生信学习手册/智能基因组手册.md"
const before = readFileSync(file, "utf8")
const after = normalizeObsidianSource(before)

const bl = before.split(/\r?\n/)
const al = after.split(/\r?\n/)

const show = (label: string, s: number, e: number) => {
  console.log(`\n===== ${label}  行 ${s}-${e} =====`)
  for (let i = s - 1; i < Math.min(e, bl.length); i++) {
    const enc = (t: string) => {
      let lead = ""
      for (const ch of t) {
        if (ch === "\u00A0") lead += "N"
        else if (ch === " ") lead += "s"
        else if (ch === "\t") lead += "T"
        else break
      }
      return lead
    }
    console.log(`${String(i + 1).padStart(4)} | B[${enc(bl[i] ?? "").padEnd(10)}] ${bl[i] !== undefined ? bl[i].replace(/^\s*/, "").replace(/\u00A0/g, "N").slice(0, 40) : ""}`)
    console.log(`     | A[${enc(al[i] ?? "").padEnd(10)}] ${al[i] !== undefined ? al[i].replace(/^\s*/, "").replace(/\u00A0/g, "N").slice(0, 40) : ""}`)
  }
}

show("问题四：① 层级", 273, 296)
show("问题二：DNA-seq 缩进", 36, 62)

// 统计：NBSP 是否全部落在 4 的网格上
let offGrid = 0
let total = 0
for (const l of al) {
  const m = /^(\u00A0+)/.exec(l)
  if (m) {
    total++
    if (m[1].length % 4 !== 0) offGrid++
  }
}
console.log(`\nNBSP 缩进行=${total}  不在 4 网格上=${offGrid}`)
const stillSpaceIndent = al.filter((l) => /^ +/.test(l) && !/^\s*(```|~~~)/.test(l)).length
console.log(`仍以空格缩进开头的行=${stillSpaceIndent}（应仅剩真实列表/引用/表格）`)
