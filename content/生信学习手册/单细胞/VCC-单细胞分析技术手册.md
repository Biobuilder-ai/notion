---
publish: true
created: 2026-09-04T07:12:51.298Z
modified: 2026-09-04T07:56:05.021Z
tags:
  - 单细胞
  - 基础指南
  - 原理
---

# VCC 单细胞分析技术手册

---

## 第一章：单细胞测序是什么、怎么做的

### 1.1 为什么需要单细胞

传统 RNA 测序（bulk RNA-seq）是把一堆细胞磨碎一起测，得到的是所有细胞的**平均表达量**。但组织里细胞类型千差万别——肿瘤细胞、免疫细胞、基质细胞混在一起，平均值会掩盖真实差异。

单细胞测序（scRNA-seq）的目标：**给每一个细胞单独测一遍基因表达**，从而分辨细胞类型、发现稀有群体、追踪状态变化。

### 1.2 10x Genomics 平台怎么工作

VCC 数据来自 10x Genomics Chromium 平台，核心流程：

```
组织 → 单细胞悬液 → 油滴包裹（GEM） → 逆转录 → PCR扩增 → 上机测序
```

关键步骤解释：

1. **单细胞悬液**：把组织消化成单个细胞悬浮在液体里。
2. **GEM（液滴）**：微流控芯片把每个细胞单独包进一个油滴里，同时放入一颗带条形码的磁珠（bead）。一个液滴 ≈ 一个细胞。
3. **逆转录**：细胞内的 mRNA 被反转成 cDNA，同时接上液滴里的条形码。
4. **PCR 扩增**：把 cDNA 扩增到足够测序的量。
5. **测序**：高通量测序仪读出短序列。

### 1.3 两层标签：Cell Barcode 和 UMI

每条测序读段（read）头上带两段标签：

| 标签 | 作用 | 类比 |
|---|---|---|
| **Cell Barcode（CB）** | 标记这条 read 来自哪个液滴（即哪个细胞） | 信封上的收件地址 |
| **UMI（Unique Molecular Identifier）** | 标记这条 read 来自哪一条原始 mRNA 分子 | 信封上的唯一编号 |

**为什么需要 UMI？**

PCR 扩增会把同一条 cDNA 复制很多份。如果不加 UMI，你测到某基因有 100 条 read，分不清是"这个细胞真有 100 个 mRNA 分子"还是"只有 1 个分子被 PCR 复制了 100 次"。

有了 UMI，规则很简单：**同一个 CB + 同一个基因 + 同一个 UMI = 同一条原始分子，只算 1 次**。这就是"去重"（deduplication）。去重后的计数叫 **UMI count**，代表该基因在该细胞中的真实 mRNA 分子数。

### 1.4 深覆盖 vs 浅覆盖

"覆盖"指每个细胞被测序的深度（即每个细胞平均测到多少条 read）。

| | 浅覆盖（如 10x 3'） | 深覆盖（如 Smart-seq2） |
|---|---|---|
| 每个细胞 read 数 | ~50,000 | ~1,000,000 |
| 检测到的基因数 | ~2,000-5,000 | ~10,000-15,000 |
| 通量 | 高（数万细胞） | 低（数百细胞） |
| 数据特点 | 稀疏（大量 0） | 相对稠密 |

VCC 数据属于**深覆盖**——每个细胞检测到的基因数中位数约 3,000-5,000，总 UMI count 中位数约 15,000-20,000。相比普通 10x 数据，VCC 的基因检出率更高，数据更"干净"。

### 1.5 最终得到的数据长什么样

测序仪输出的是几十亿条短 read。经过比对（alignment）和定量（quantification）后，变成一张**数字表格**：

```
         Gene1  Gene2  Gene3  ...  Gene33000
Cell1      0      5      0    ...      0
Cell2      3      0      0    ...      1
Cell3      0      0      8    ...      0
...
Cell177000 2      0      0    ...      0
```

- 行 = 细胞（VCC context\_A 有 ~177,000 个细胞）
- 列 = 基因（~33,000 个基因）
- 值 = UMI count（该基因在该细胞中有多少个 mRNA 分子）
- **绝大多数格子是 0**（一个细胞只表达基因总数的一小部分）

---

## 第二章：环境配置

### 2.1 系统要求

- Linux 服务器（VCC 数据 ~2GB，处理峰值内存需要 5GB+）
- Python 3.10+

### 2.2 Conda 环境

```bash
conda create -n bio python=3.11
conda activate bio #你想起啥名起啥名
pip install scanpy anndata numpy scipy pandas matplotlib jupyter
```

### 2.3 当前版本

| 包 | 版本 |
|---|---|
| scanpy | 1.11.5 |
| anndata | 0.12.19 |
| numpy | 2.4.6 |
| scipy | 1.17.1 |
| pandas | 2.3.3 |

### 2.4 数据文件

VCC 的对照数据（context A/B/C）是真实 10x Flex 单细胞数据，需要通过官方 CLI 下载。

**前提条件：**

| 需要的          | 从哪来                                                                  |
| ------------ | -------------------------------------------------------------------- |
| 挑战赛账号        | 去 [virtualcellchallenge.org](https://virtualcellchallenge.org/) 注册团队 |
| API key      | 登录后到 virtualcellchallenge.org/app/credentials 生成（只显示一次）              |
| Python 3.11+ | bio 环境已满足                                                            |
![[Pasted image 20260904081546.png]]
**安装 CLI + 下载数据：**

```bash
# 1. 装 uv（包管理工具）
pip install uv

# 2. 装 vcc CLI（uv 会把它隔离到独立目录，不影响 bio 环境）
uv tool install vcc-cli
vcc --version

# 3. 用 API key 登录
echo "你的API_KEY" | vcc login --token-stdin
vcc whoami

# 4. 查看可用数据集
vcc datasets list

# 5. 下载对照数据解压
vcc datasets download controls -d ~/vcc
cd ~/vcc
python -m zipfile -e vcc_2026_controls.zip ~/vcc
```

**下载得到的文件：**

```
/home/yangluhang/vcc/data/
├── context_A.h5ad    # 未处理的原始数据（~215MB）
├── context_B.h5ad
└── context_C.h5ad
```

每个 `.h5ad` 文件就是一个 AnnData 对象（见第三章），包含 X（UMI count 矩阵）+ obs/var 元数据，可以直接 `sc.read_h5ad` 读入分析。

---

## 第三章：AnnData 数据结构

### 3.1 整体结构

AnnData 是单细胞分析的标准数据容器，可以理解为**一张主表 + 若干附属信息**：![[Pasted image 20260901202701.png|400]]

```
AnnData
├── X          → 主表：细胞 × 基因 的表达量矩阵
├── obs        → 每个细胞的备注（如 QC 指标、聚类标签）
├── var        → 每个基因的备注（如基因名、是否线粒体基因）
├── layers     → X 的"副本"（如保存原始 count）
├── obsm       → 细胞级多维数据（如 PCA 坐标、UMAP 坐标）
├── varm       → 基因级多维数据
├── obsp       → 细胞×细胞 的关系矩阵（如邻接图）
└── varp       → 基因×基因 的关系矩阵
```

### 3.2 各部分详解

#### X（表达量矩阵）

- 形状：`(n_cells, n_genes)`，例如 `(177213, 33538)`
- 内容：UMI count（原始数据）或归一化后的值
- 存储格式：**稀疏矩阵**（见 3.3）

#### obs（细胞备注表）

- 形状：`(n_cells, n_columns)`，每行对应 X 的一行（一个细胞）
- 内容举例：

| 列名 | 含义 |
|---|---|
| `n_genes_by_counts` | 该细胞检测到多少个基因（count > 0） |
| `total_counts` | 该细胞所有基因的 UMI 总和 |
| `pct_counts_mt` | 线粒体基因占比（%） |
| `leiden` | 聚类标签（后续分析产生） |

#### var（基因备注表）

- 形状：`(n_genes, n_columns)`，每行对应 X 的一列（一个基因）
- 内容举例：

| 列名 | 含义 |
|---|---|
| `mt` | 是否是线粒体基因（True/False） |
| `highly_variable` | 是否是高变基因（后续分析产生） |

#### layers（数据副本）

- 和 X 形状完全一样的额外矩阵
- 典型用法：归一化前把原始 count 存进 `layers['counts']`，这样 X 可以被改写为归一化值，原始数据不丢失

### 3.3 稀疏矩阵 vs 稠密矩阵（重点）

#### 问题背景

VCC 数据有 177,213 个细胞 × 33,538 个基因 = **约 59 亿个格子**，但其中只有约 1.1 亿个非零值（不到 2%）。如果用普通表格（稠密矩阵）存，98% 的空间浪费在存 0 上。

#### 稠密矩阵（Dense Matrix）

```python
import numpy as np
X = np.array([[0, 5, 0],
              [3, 0, 0],
              [0, 0, 8]])
```

- 每个格子都存，不管是不是 0
- 内存 = 行数 × 列数 × 每元素字节数
- 本数据如果稠密存储：59亿 × 4字节(float32) ≈ **23.6 GB** → 直接爆内存

#### 稀疏矩阵（Sparse Matrix）

只存非零值及其位置。常用两种格式：

**CSR（Compressed Sparse Row，按行压缩）：**

```
data:    [5, 3, 8]           ← 非零值本身
indices: [1, 0, 2]           ← 每个非零值在第几列
indptr:  [0, 1, 2, 3]        ← 每行从 data 的第几个位置开始
```

- 适合**按行操作**（取/删细胞）
- 本数据 CSR 内存：1.1亿非零值 × (4字节值 + 4字节列号) ≈ **880 MB**

**CSC（Compressed Sparse Column，按列压缩）：**

- 结构对称，适合**按列操作**（取/删基因）
- 内存量相同，只是组织方式不同

#### 对比总结

| | 稠密矩阵 | 稀疏矩阵 |
|---|---|---|
| 存储内容 | 所有值（含 0） | 只存非零值 + 位置 |
| 本数据内存 | ~23.6 GB | ~880 MB |
| 适合场景 | 数据大部分非零 | 数据大部分是 0（单细胞就是这种） |
| 操作限制 | 任意 numpy 操作 | 部分操作需要先转格式 |

#### 实际注意事项

- `adata.X` 默认是 CSR 稀疏矩阵，**不要调用 `.toarray()`**（会转成稠密，直接爆内存）
- 删基因（按列操作）时，CSR 格式效率低，可以先转 CSC 再删，删完转回 CSR
- scanpy 的函数内部会自动处理稀疏/稠密，一般不需要手动转换

---

## 第四章：数据处理流程

### 4.1 流程概览

```
原始数据 → QC质控 → 过滤低质量细胞/基因 → 归一化 → 降维 → 聚类 → 注释
```

### 4.2 QC 质控

目的：剔除技术噪音（空液滴、死细胞、双细胞）和低质量基因。

**关键 QC 指标：**

| 指标 | 含义 | 异常说明 |
|---|---|---|
| `total_counts` | 细胞总 UMI 数（总共有多少转录本分子） | 过低=空液滴/死细胞；过高=双细胞 |
| `n_genes_by_counts` | 检测到的基因数（检出了多少种不同基因） | 过低=细胞质量差 |
| `pct_counts_mt` | 线粒体基因占比 | 过高=细胞破裂，胞质RNA流失 |

### 4.3 代码：读入数据 + 计算 QC 指标

```python
import scanpy as sc
import anndata, gc
anndata.settings.allow_write_nullable_strings = True

# 读入原始文件
adata = sc.read_h5ad('/home/yangluhang/vcc/data/context_A.h5ad')

# 给 var 加一列:哪些基因是线粒体基因
adata.var['mt'] = adata.var_names.str.startswith('MT-').to_numpy(dtype=bool)

# 给每个细胞算 QC 指标(总表达量、检测到的基因数、线粒体占比)
sc.pp.calculate_qc_metrics(adata, qc_vars=['mt'], percent_top=None, log1p=False, inplace=True)
print("preselect-shape:", adata.shape)
adata.obs[['n_genes_by_counts', 'total_counts', 'pct_counts_mt']].describe()
```

**输出：**

```
preselect-shape: (18400, 18533)
```

| | n\_genes\_by\_counts | total\_counts | pct\_counts\_mt |
|---|---|---|---|
| count | 18400.0 | 18400.0 | 18400.0 |
| mean | 5973.4 | 21133.5 | 0.351 |
| std | 1185.5 | 9704.9 | 0.291 |
| min | 2205.0 | 3275.0 | 0.0 |
| 25% | 5296.0 | 13986.0 | 0.156 |
| 50% | 6147.0 | 20109.0 | 0.270 |
| 75% | 6842.0 | 27234.5 | 0.451 |
| max | 8453.0 | 52420.0 | 3.348 |

**如何读 describe()：**

count/mean/std/min/25%/50%/75%/max 是分布的骨架：

- min / 25% → 看左尾巴（有没有异常低的坏细胞）
- 50%（中位数） → 看典型值
- 75% / max → 看右尾巴（有没有异常高的离群/双细胞）

**逐列分析：**

**① n\_genes\_by\_counts（每细胞检出了多少种不同基因）**

min 2205 | 25% 5296 | 50% 6147 | 75% 6842 | max 8453

- 连最差的细胞都有 2205 个基因，中位 6147。没有"检出基因极少"的低质量群体（空液滴通常只有几十~几百基因，这里完全没有）。
- 这是深覆盖的体现：基因检出率很高。
- 典型教程的 `min_genes=200` 在这里滤不掉任何东西（所有细胞都远超 200）。

**② total\_counts（每细胞总共有多少个转录本分子）**

min 3275 | 25% 13986 | 50% 20109 | 75% 27234 | max 52420

- 中位 2 万 UMI/细胞，属于深覆盖。
- max 52420 ≈ 中位的 2.6 倍 → 右尾巴偏长，少数细胞可能是双细胞（两个细胞混进一个液滴）。
- 左端（min 3275）不算低，低端干净。
- 这列主要关心右尾巴（双细胞），需剔除 total\_counts 异常高的。

**③ pct\_counts\_mt（线粒体基因占比 %）**

min 0 | 25% 0.156 | 50% 0.270 | 75% 0.451 | max 3.35

- 中位仅 0.27%、最高 3.35%。几乎没有线粒体污染，这批细胞很健康。
- 常规的 `pct_counts_mt < 20%` 在这里也滤不掉任何东西（全部 < 3.35%）。

**关键结论：这是高质量/深覆盖数据，别套教程默认阈值**

| 指标                | 本数据表现         | 教程默认阈值        | 会不会滤东西       |
| ----------------- | ------------- | ------------- | ------------ |
| n\_genes\_by\_counts | min 2205，无坏细胞 | min\_genes=200 | 几乎不滤         |
| pct\_counts\_mt     | max 3.35%，很干净 | <20%          |  不滤          |
| total\_counts      | max 5.2万（右长尾） | —             | ⚠️ 主要靠这个防双细胞 |

教训：阈值要看自己数据的分布来定，不能照搬别人。这批数据真正的"脏东西"是右尾巴（可能双细胞/异常高表达），不是低质量的左尾巴。

### 4.4 代码：过滤异常细胞

```python
# 筛选异常细胞（包含线粒体基因过高的细胞和总表达量过高的细胞）
cell_mask = (
    (adata.obs['pct_counts_mt'] < 10) &        # 线粒体占比 < 10%
    (adata.obs['n_genes_by_counts'] >= 1000) & # 至少检测到1000个基因
    (adata.obs['total_counts'] < 50000)         # 总表达量 < 50000
)

adata = adata[cell_mask].copy()
del cell_mask          # 用完的标记删掉,省内存
gc.collect()           # 叫 Python 立刻回收没用的大对象

print("filtered-cell-shape:", adata.shape)
```

**输出：**

```
filtered-cell-shape: (18328, 18533)
```

**分析：** 从 18400 个细胞过滤到 18328 个，只去掉了 72 个细胞（0.4%）。这印证了前面的判断——数据质量很高，绝大多数细胞都满足条件。被去掉的主要是 `total_counts > 50000` 的右尾细胞（可能双细胞）。

### 4.5 代码：过滤低表达基因

```python
# 筛选异常基因，至少在某数量的细胞中表达
# 删"不常出现的基因"这一步列数会变少，但对 CSR 格式按列删很费内存，
# 所以先转成 CSC 这种"按列删更划算"的格式，删完再转回 CSR。

adata.X = adata.X.tocsc()
sc.pp.filter_genes(adata, min_cells=3)
adata.X = adata.X.tocsr()
gc.collect()

adata.layers['counts'] = adata.X.copy()

print("filtered-gene-shape:", adata.shape)
print('标记的线粒体基因数:', adata.var['mt'].sum())
```

**输出：**

```
filtered-gene-shape: (18328, 14751)
标记的线粒体基因数: 12
```

**分析：**

- 基因数从 18533 降到 14751，去掉了 3782 个基因（20%）。这些基因在少于 3 个细胞中被检测到，几乎可以确定是技术噪音（背景污染或极低表达）。
- 线粒体基因保留了 12 个（人类线粒体基因组编码 13 个蛋白，这里 12 个说明有 1 个在过滤中被去掉了，可能表达量极低）。
- `layers['counts']` 在这一步之后才复制，此时矩阵已经缩小到 18328×14751，==比一开始就复制省很多内存==，官方的教程在最开始就直接copy了一份，电脑就一直带着那个内存跑，后续的处理直接就崩了，如果你的运存够大，当我没说，可以在一开始就copy一份。

### 4.6 代码解释

1. `anndata.settings.allow_write_nullable_strings = True`：新版 anndata 写文件时的兼容性开关，不加后续 `write_h5ad` 会报错。

2. `adata.var['mt'] = ...`：标记线粒体基因。人类线粒体基因名以 `MT-` 开头（如 `MT-CO1`）。`.to_numpy(dtype=bool)` 是必须的——新版 pandas 的 `str.startswith()` 返回可空布尔类型（`BooleanArray`），直接传给 scipy 会报 `.nonzero()` 错误。

3. `sc.pp.calculate_qc_metrics(...)`：对每个细胞计算三个指标，结果写入 `adata.obs`：
   - `total_counts`：该细胞所有基因 count 之和（总共有多少转录本分子）
   - `n_genes_by_counts`：该细胞 count > 0 的基因种类数（检出了多少种不同基因）
   - `pct_counts_mt`：线粒体基因 count 占总 count 的百分比

4. `adata[cell_mask].copy()`：过滤是"读旧+造新"，`.copy()` 把视图压实成独立对象并释放旧内存。合并三个条件成一个掩码只做一次 copy，比分别过滤三次省内存。

5. `adata.X.tocsc()` → `filter_genes` → `adata.X.tocsr()`：删基因是按列操作，CSC 格式下效率更高，避免 scipy 内部隐式转换产生临时大矩阵。

6. `adata.layers['counts'] = adata.X.copy()`：在过滤完成、矩阵已经缩小之后再存原始 count 备份，这样后续归一化改写 X 时不丢失原始数据。
   这就是我们分析的起点。
