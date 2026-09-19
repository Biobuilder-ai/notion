---
publish: true
created: 2026-09-18T08:57:10.300Z
modified: 2026-09-19T12:22:20.757Z
tags:
  - 生信agent
  - 标准
---

# Agent 数据标注与可追溯性标准

## Data Annotation & Provenance Standard v1.0

> 用途：将本文件交给 AI Agent，作为其执行科研数据整理、文件解析、数据标注、结果生成和分析任务时的强制质量标准。
>
> 核心目标：**高质量标注 + 可验证证据 + 完整数据血缘 + 可复现处理 + 禁止臆测。**

---

# 0. Agent 的最高优先级原则

在处理任何科研数据、基因组学文件、生物学数据、论文、实验结果或模型输入输出时：

1. **先确认对象，再进行标注。**
2. **每一个重要结论都必须能够追溯到输入证据。**
3. **每一个派生文件都必须记录“由什么输入、通过什么操作、使用什么版本和参数产生”。**
4. **不知道的信息必须标记为 `unknown` / `not_available`，不得猜测。**
5. **推断内容必须与原始事实分开，并明确标记为 `inference`。**
6. **不要把文件名、文件夹名或自然语言描述当作事实证据。**
7. **不得因为上下文“看起来合理”而自动补全缺失的样本、实验批次、参考基因组、软件版本或参数。**
8. **如果两个对象无法证明是同一个对象，不得强行合并。**
9. **如果无法完成准确溯源，应明确报告溯源缺口，而不是伪造完整链条。**
10. **最终输出必须能够回答：这个结果从哪里来？经过了什么？为什么得到这个结果？**

---

# 1. 四层元数据模型

所有科研数据优先按照以下四个层次组织。

| 层级 | 必须记录 | 目的 |
|---|---|---|
| 生物样本层 | 材料、组织、物种、个体、时间、处理、条件 | 定义“研究对象是谁” |
| 实验批次层 | batch、平台、试剂、实验人员、实验日期、仪器 | 追踪批次效应和实验条件 |
| 计算过程层 | 软件、版本、参数、脚本、容器、参考数据、校验值 | 保证结果可以复现 |
| 任务/标注层 | 来源、单位、阈值、标签定义、缺失规则、证据 | 保证模型训练/分析目标明确 |

任何一个层级如果适用但缺失，都必须记录缺失原因。

---

# 2. 数据血缘模型

将整个任务视为一个有向图：

```text
输入实体 Entity
      |
      | 经过 Activity
      v
输出实体 Entity
```

例如：

```text
Raw FASTQ
   |
   | QC / trimming
   | software + version + parameters
   v
Clean FASTQ
   |
   | alignment
   | reference + software + version + parameters
   v
BAM
   |
   | counting / annotation
   | annotation version + rules
   v
Count Matrix
   |
   | normalization / modeling
   | method + version + parameters
   v
Model Matrix / Result
```

必须能够沿着箭头反向追溯：

```text
最终结果
→ 模型矩阵
→ 对象表
→ BAM
→ Clean FASTQ
→ Raw FASTQ
```

---

# 3. 每个文件必须有唯一身份

不要仅使用：

```text
sample1.bam
result.csv
final.xlsx
```

作为身份。

每一个数据实体必须尽可能记录：

```yaml
entity_id:
entity_type:
file_name:
file_path:
file_format:
file_size:
checksum:
checksum_algorithm:
created_at:
source:
```

推荐：

```text
entity_id = ENT-000001
```

如果文件存在 SHA-256，应记录：

```yaml
checksum:
  algorithm: SHA-256
  value: "<hash>"
```

如果无法计算校验值：

```yaml
checksum:
  status: not_available
  reason: "<原因>"
```

禁止伪造 checksum。

---

# 4. 每一个样本必须建立 Sample ID

不要只依赖：

```text
SRR123456
sample1
A
control
```

必须尽可能建立结构化样本记录：

```yaml
sample_id:
sample_name:
species:
strain_or_line:
tissue:
cell_type:
developmental_stage:
individual_id:
sex:
collection_time:
treatment:
dose:
duration:
condition:
replicate:
experimental_group:
source_file_ids:
```

## 重要规则

### 4.1 生物学重复和技术重复不能混为一谈

必须区分：

```text
biological_replicate
technical_replicate
```

如果无法判断：

```yaml
replicate_type: unknown
```

不能根据样本编号自行猜测。

### 4.2 个体信息缺失

不要把：

```text
Sample1
Sample2
Sample3
```

自动解释成：

```text
Individual1
Individual2
Individual3
```

除非原始证据明确说明。

---

# 5. 实验批次 Batch 元数据

每个实验批次尽可能记录：

```yaml
batch_id:
experiment_id:
experiment_date:
operator:
platform:
instrument:
library_preparation:
reagent_lot:
kit:
protocol_version:
lab:
location:
```

如果存在批次信息，应把：

```text
sample → batch
```

建立明确关系。

如果没有证据，不得根据日期或文件名自行创建 batch。

---

# 6. 计算过程 Activity 记录

每一个产生新数据的计算步骤都必须记录为一个 Activity。

推荐格式：

```yaml
activity_id:
activity_type:
description:

inputs:
  - entity_id:

outputs:
  - entity_id:

software:
  name:
  version:

parameters:
  ...

reference_data:
  name:
  version:
  accession:
  checksum:

script:
  path:
  version:
  checksum:

environment:
  os:
  container:
  container_version:
  python_version:
  R_version:

started_at:
ended_at:

operator_or_agent:
```

---

# 7. 软件与版本必须分开记录

不要只写：

```text
STAR
```

必须尽可能写：

```yaml
software:
  name: STAR
  version: "2.7.11b"
```

对于脚本：

```yaml
script:
  name:
  repository:
  commit:
```

对于容器：

```yaml
container:
  name:
  image:
  digest:
```

如果版本未知：

```yaml
version: unknown
```

不得猜测。

---

# 8. 参数必须原样保存

不要只写：

```text
进行了质量控制
```

应该记录：

```yaml
parameters:
  quality_threshold: 20
  minimum_length: 30
  adapter_removal: true
```

如果 Agent 调用了命令行程序，尽可能保存完整命令：

```yaml
command:
  "<完整命令>"
```

如果参数很多：

```yaml
parameter_file:
  path:
  checksum:
```

不要只保存“关键参数”而丢失其余参数，除非明确说明哪些参数被省略。

---

# 9. 参考数据必须版本化

基因组学尤其必须记录：

```yaml
reference:
  name:
  version:
  accession:
  source:
  release:
  checksum:
```

例如：

```yaml
reference:
  name: GRCh38
  release: GENCODE v47
```

不要把：

```text
GRCh38
```

和：

```text
GENCODE v47
```

混成一个字段。

它们分别代表：

- reference genome
- annotation release

---

# 10. 标注 Annotation 标准

每一个标注都应该尽可能具有以下结构：

```yaml
annotation_id:
subject_id:
label:
label_definition:
value:
unit:

source:
  entity_id:
  file:
  location:

evidence:
  type:
  quote_or_value:
  location:

provenance:
  activity_id:
  agent:

confidence:
status:
inference:
```

---

# 11. “事实”和“推断”必须严格分开

### 原始事实

```yaml
status: observed
inference: false
```

例如：

```text
文件中明确写明 tissue = leaf
```

### 计算得到

```yaml
status: derived
inference: false
```

例如：

```text
根据 FASTQ + 参考基因组 + 参数计算得到 read count
```

### 模型推断

```yaml
status: inferred
inference: true
```

例如：

```text
根据表达模式推断该样本可能属于某类细胞
```

禁止把：

```text
inferred
```

伪装成：

```text
observed
```

---

# 12. 每个重要标注必须有证据定位

“来源于某文件”是不够的。

应尽可能定位到：

```yaml
source:
  file: sample_metadata.tsv
  row: 17
  column: tissue
```

对于 PDF：

```yaml
source:
  file:
  page: 6
  figure: Figure 2
  panel: B
```

对于 FASTA / BED / VCF：

```yaml
source:
  file:
  chromosome:
  start:
  end:
  record_id:
```

对于 JSON：

```yaml
source:
  file:
  json_path: "$.samples[3].tissue"
```

对于网页：

```yaml
source:
  url:
  accessed_at:
```

对于数据库：

```yaml
source:
  database:
  accession:
  version:
```

---

# 13. 基因组坐标必须记录坐标体系

涉及 genomic coordinates 时，必须明确：

```yaml
coordinate_system:
  basis: 0-based | 1-based
  interval: half-open | closed
```

例如 BED：

```yaml
coordinate_system:
  basis: 0-based
  interval: half-open
```

例如 VCF POS：

```yaml
coordinate_system:
  basis: 1-based
  interval: single-position
```

禁止看到数字后自行假设坐标体系。

---

# 14. 单位必须显式记录

不要写：

```text
expression = 20
```

应该写：

```yaml
value: 20
unit: TPM
```

或者：

```yaml
value: 20
unit: counts
```

或者：

```yaml
value: 20
unit: "ng/mL"
```

如果单位未知：

```yaml
unit: unknown
```

禁止根据常见习惯猜单位。

---

# 15. 缺失值标准

允许：

```text
unknown
not_available
not_applicable
not_measured
withheld
```

但是必须区分。

### unknown

理论上存在，但目前不知道。

### not\_available

应该存在，但当前数据中没有提供。

### not\_applicable

这个字段不适用于该对象。

### not\_measured

这个变量理论上可以测量，但实验没有测。

### withheld

存在，但出于权限/隐私等原因不能提供。

禁止把所有缺失值都写成：

```text
NA
```

除非原始数据本身明确如此。

---

# 16. 文件之间必须建立 Derivation 关系

推荐：

```yaml
derivation:
  output: ENT-000005
  activity: ACT-000004
  inputs:
    - ENT-000001
    - ENT-000002
```

例如：

```text
ENT-001 Raw FASTQ
       |
       | ACT-001 trimming
       |
       v
ENT-002 Clean FASTQ
       |
       | ACT-002 alignment
       |
       v
ENT-003 BAM
```

这样可以构建完整 provenance graph。

---

# 17. 一个完整示例

```yaml
entity_id: ENT-000003
entity_type: BAM
file_name: sample_A.bam

source:
  inputs:
    - ENT-000001
    - ENT-000002

generation:
  activity_id: ACT-000002

activity:
  type: alignment
  software:
    name: "<software>"
    version: "<version>"

  parameters:
    "<parameter>": "<value>"

  reference:
    name: "<reference genome>"
    version: "<version>"
    checksum: "<sha256>"

  command:
    "<full command>"

checksum:
  algorithm: SHA-256
  value: "<sha256>"
```

---

# 18. Agent 执行任务时的标准流程

## Step 1：盘点输入

首先列出：

```text
输入文件
输入数据
数据库
参考文件
用户要求
```

不要立即开始分析。

---

## Step 2：建立实体 ID

为所有关键对象建立：

```text
ENT-xxxxxx
```

例如：

```text
ENT-000001 Raw FASTQ
ENT-000002 Sample metadata
ENT-000003 Reference genome
```

---

## Step 3：提取元数据

提取：

```text
sample
experiment
batch
file
software
version
reference
parameters
coordinate system
unit
```

---

## Step 4：建立证据链

每一个重要字段记录：

```text
字段 → 值 → 来源 → 定位
```

例如：

```text
sample.tissue
→ leaf
→ metadata.tsv
→ row 17 / column tissue
```

---

## Step 5：执行计算

记录：

```text
input
activity
software
version
parameters
reference
environment
output
```

---

## Step 6：生成输出校验值

尽可能为重要输出计算：

```text
SHA-256
```

---

## Step 7：建立 provenance graph

最终形成：

```text
INPUT
  ↓
ACTIVITY
  ↓
OUTPUT
  ↓
ACTIVITY
  ↓
OUTPUT
```

---

## Step 8：执行质量检查

在交付之前必须检查：

- 是否存在没有来源的关键字段？
- 是否存在没有版本的软件？
- 是否存在没有版本的参考数据？
- 是否存在没有参数的计算步骤？
- 是否存在没有坐标体系的基因组位置？
- 是否存在没有单位的数值？
- 是否把推断写成事实？
- 是否存在无法解释的文件？
- 是否存在断裂的数据血缘？
- 是否能够从最终结果追溯到原始输入？

---

# 19. Provenance 完整性等级

每个最终结果给出一个等级，但**不得用等级掩盖缺失信息**。

### P0 — 不可追溯

只有结果，没有可靠来源。

### P1 — 基础追溯

知道输入文件和输出文件，但缺少软件/参数/参考版本。

### P2 — 可复现追溯

输入、输出、软件、版本、关键参数、参考数据均有记录。

### P3 — 完整科研溯源

P2 +

- 文件 checksum
- 样本元数据
- 实验批次
- 代码版本
- 运行环境
- 证据定位
- 完整 derivation graph

### P4 — 机器可验证溯源

P3 +

- 结构化 provenance
- 可自动验证的实体 ID
- 可验证 checksum
- 可执行 workflow / workflow definition
- 机器可读 metadata
- 能自动检查 provenance consistency

---

# 20. 禁止行为

Agent MUST NOT：

1. 猜测缺失的实验信息。
2. 猜测样本身份。
3. 猜测 biological replicate / technical replicate。
4. 猜测软件版本。
5. 猜测参考基因组版本。
6. 猜测单位。
7. 猜测坐标体系。
8. 把推断当成事实。
9. 修改原始数据而不创建新版本。
10. 用“final”“latest”“new”等模糊名称代替版本号。
11. 覆盖旧结果而不保留 provenance。
12. 删除导致无法追溯的中间结果。
13. 声称“已验证”但没有记录验证方法。
14. 声称“可复现”但没有足够的输入、软件、参数和参考数据。
15. 发现冲突数据后静默选择其中一个。

---

# 21. 冲突数据处理

如果出现：

```text
metadata.tsv：tissue = leaf
实验记录：tissue = root
```

不得自行选择。

必须记录：

```yaml
conflict:
  field: tissue
  values:
    - source: metadata.tsv
      value: leaf
    - source: experiment_record
      value: root
  resolution: unresolved
```

然后向用户报告冲突。

---

# 22. 版本更新规则

任何重要修改都产生新版本。

例如：

```text
D1 → D2
```

必须记录：

```yaml
derived_from: D1
change:
  "<what changed>"
reason:
  "<why>"
```

不要直接覆盖：

```text
model_matrix.csv
```

而应该使用：

```text
model_matrix_v1
model_matrix_v2
```

或者稳定的 entity ID + version metadata。

---

# 23. 推荐最终输出结构

每一个任务完成后，Agent 应尽可能输出：

```text
01_input_inventory
02_sample_metadata
03_experiment_metadata
04_processing_steps
05_software_versions
06_parameters
07_reference_data
08_annotations
09_outputs
10_provenance_graph
11_quality_control
12_unresolved_issues
```

---

# 24. 最终报告模板

## A. 输入

| Entity ID | 文件 | 类型 | Checksum | 来源 |
|---|---|---|---|---|

## B. 样本

| Sample ID | 材料 | 组织 | 个体 | 处理 | Batch | Replicate |
|---|---|---|---|---|---|---|

## C. 计算步骤

| Activity ID | 输入 | 操作 | 软件 | 版本 | 参数 | 输出 |
|---|---|---|---|---|---|---|

## D. 标注

| Annotation ID | Subject | Label | Value | Unit | Evidence | Source |
|---|---|---|---|---|---|---|

## E. 参考数据

| Reference ID | 名称 | 版本 | Accession | Checksum |
|---|---|---|---|---|

## F. 未解决问题

必须明确列出：

```text
字段：
问题：
影响：
可能原因：
需要用户确认的信息：
```

---

# 25. 最终交付前自检

Agent 必须逐项检查：

```text
[ ] 所有关键输入都有 Entity ID
[ ] 所有关键输出都有 Entity ID
[ ] 所有输出都能找到输入
[ ] 所有 Activity 都有输入和输出
[ ] 软件名称和版本已记录
[ ] 关键参数已记录
[ ] 参考数据版本已记录
[ ] 基因组坐标体系已记录
[ ] 数值单位已记录
[ ] 样本元数据已记录
[ ] 实验批次已记录
[ ] 重要标注有证据定位
[ ] 事实与推断已分开
[ ] 缺失值已分类
[ ] 冲突信息未被静默覆盖
[ ] 重要输出有 checksum
[ ] 最终结果可以反向追溯到原始输入
[ ] 无任何凭空补全的信息
```

如果任何关键项失败，Agent 必须在最终报告中明确列出，而不是宣称任务已经“完整完成”。

---

# 26. 建议的数据结构

对于需要机器长期处理的项目，建议最终保存为：

```text
project/
├── raw/
├── metadata/
├── reference/
├── intermediate/
├── results/
├── scripts/
├── workflows/
├── provenance/
│   ├── entities.yaml
│   ├── activities.yaml
│   ├── derivations.yaml
│   └── annotations.yaml
└── README.md
```

如果项目规模较大，可以进一步使用 JSON / JSON-LD 保存机器可读 provenance。

---

# 27. 标准的核心思想

不要只问：

> “这个结果是什么？”

必须同时回答：

> **“这个结果来自什么？”**

> **“谁/什么过程产生了它？”**

> **“使用了什么软件和版本？”**

> **“使用了什么参数？”**

> **“依赖哪个参考数据版本？”**

> **“原始证据在哪里？”**

> **“哪些是事实，哪些是推断？”**

> **“如果重新运行，别人能否得到同一个结果？”**

最终目标：

```text
数据
 ↓
元数据
 ↓
证据
 ↓
计算过程
 ↓
版本
 ↓
输出
 ↓
完整 provenance graph
```

**任何无法回答来源的问题，都必须被视为 provenance gap（溯源缺口）。**

---

# 28. 标准依据

本标准的核心思想参考：

- W3C PROV：用 Entity、Activity、Agent 表达数据产生过程和责任关系。
- RO-Crate：用机器可读元数据描述数据实体、上下文实体、软件、工作流及其 provenance。

本文件是在这些通用 provenance 思路之上，为科研/基因组学 Agent 任务定制的操作规范；它不是对 W3C PROV 或 RO-Crate 的完整实现。

版本：v1.0
用途：科研数据 Agent / 生物信息学 Agent / 数据标注 Agent
