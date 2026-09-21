---
publish: true
created: 2026-08-28T16:25:56.741Z
modified: 2026-09-04T07:56:12.608Z
tags:
  - 基础指南
  - 控制工具
---

# 07 Miniconda 安装与用途指南

## 一、Miniconda 是什么？

**一句话**：Miniconda 是一个"软件/环境管理器"，专门用来管理 Python、R 和一堆生信工具。

**它解决的核心痛点**：生信要装几十上百个工具，不同工具需要的 Python 版本、依赖库常常互相冲突。Miniconda 能让你为**每个项目创建一个独立、隔离的环境**，互不干扰。

## 二、为什么要用它（vs 直接 pip install）

| 对比 | pip 单独装 | conda 环境 |
|------|-----------|-----------|
| 版本冲突 | 容易冲突 | 每个环境独立，不冲突 |
| 生信工具 | 很多没有/难装 | 生物信息通道丰富，好装 |
| 环境隔离 | 难 | 天然隔离 |
| 切换项目 | 要卸载重装 | `conda activate` 一键切换 |

> 生信从业者几乎人手 conda，是行业标配。

## 三、安装步骤（在 Ubuntu/WSL2 里）

### 1. 下载安装脚本

```bash
cd ~
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
```

> 如果 `wget` 不存在，先装：`sudo apt install wget -y`

### 2. 运行安装脚本

```bash
bash Miniconda3-latest-Linux-x86_64.sh
```

按提示操作：

- 许可证协议：一路按 `Enter` / `空格` 翻过
- 问 `Do you accept the license terms?` → 输入 **`yes`**
- 安装路径：直接回车用默认 `~/miniconda3`
- **关键**：问 `Do you wish the installer to initialize Miniconda3 by running conda init?` → 输入 **`yes`** ⚠️（不选 yes 会导致 `conda: command not found`）

### 3. 让 conda 生效并验证

```bash
source ~/.bashrc
conda --version
```

应输出如 `conda 26.7.1`。

### 4. 常见坑：必须接受官方源条款

新版 conda（26.x）会要求先接受官方源条款，否则装东西报错：

```bash
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r
```

直接分别复制这两条指令在终端

## 四、创建和使用环境（核心用法）

### 创建独立环境

```bash
conda create -n bio python=3.11 -y
# -n bio   : 环境名叫 bio
# python=3.11 : 用 Python 3.11（生信兼容性最好，避开太新的版本）
# -y       : 自动确认
```

### 激活 / 退出环境

```bash
conda activate bio      # 进入 bio 环境（提示符前出现 (bio)）
conda deactivate        # 退出，回 base
```

### 查看所有环境

```bash
conda env list          # 或 conda info --envs
```

### 删除环境

```bash
conda env remove -n bio
```

## 五、在环境里装软件

### 装 Python 包

```bash
conda install numpy pandas matplotlib -y
```

或

```bash
pip install 包名
```

### 装生信工具（推荐用 conda，生信通道丰富）

```bash
conda install -c bioconda -c conda-forge 工具名 -y
# -c bioconda : 使用生物信息通道
# -c conda-forge : 使用通用社区通道
```

## 六、核心概念：为什么环境能隔离

每个环境就像一台独立的"手机"，各自装不同版本的 Python 和包：

- base 是 Python 3.14，bio 是 Python 3.11，互不影响
- `conda activate bio` 之后，所有 `python`、`pip`、生信命令都指向 bio 环境的

**同一个 `python` 命令，在不同环境里运行的是不同版本**——这就是隔离的力量。

## 七、让每次打开终端自动进入 bio 环境（推荐）

```bash
conda config --set auto_activate_base false
echo 'conda activate bio' >> ~/.bashrc
```

重开终端后，提示符前直接出现 `(bio)`，不用每次手动激活。

## 八、速查表

| 操作 | 命令 |
|------|------|
| 创建环境 | `conda create -n 名字 python=3.11 -y` |
| 激活环境 | `conda activate 名字` |
| 退出环境 | `conda deactivate` |
| 查看环境 | `conda env list` |
| 装包 | `conda install 包名 -y` |
| 装生信工具 | `conda install -c bioconda -c conda-forge 工具名` |
| 删环境 | `conda env remove -n 名字` |
| 看版本 | `conda --version` |

## 九、和 Docker 的区别（别混淆）

| | conda | Docker |
|---|-------|--------|
| 本质 | 软件/环境管理器 | 打包整个系统环境 |
| 用途 | 日常管理 Python/R/工具 | 复现别人的完整环境 |
| 轻量 | 轻快 | 重，要启动虚拟机 |
| 日常生信 | ✅ 主战场 | 偶尔用（进阶） |

> 生信日常 99% 用 conda；Docker 是复现/进阶工具，现阶段用不太上，两者不冲突。
