---
publish: true
created: 2026-08-29T01:50:16.516+01:00
modified: 2026-08-29T02:51:27.437+01:00
tags:
  - 基础指南
  - Jupyter
---

# 02 Jupyter Notebook 使用

## 装 Miniconda

```bash
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh
# 协议一路 Enter，同意 yes；最后 "initialize conda?" 一定要选 yes！
source ~/.bashrc
conda --version
```

## 创建独立环境

```bash
conda create -n bio python=3.11 -y
conda activate bio
python --version    # 应为 3.11.x
```

## 设自动进入 bio 环境

```bash
conda config --set auto_activate_base false
echo 'conda activate bio' >> ~/.bashrc
```

重开终端后提示符前出现 `(bio)`。

## 安装启动 Jupyter

```bash
conda install jupyter notebook -y
jupyter notebook   # 或 jupyter lab
```

- 浏览器自动打开 http://localhost:8888
- 终端窗口别关（关了 Jupyter 就停），退出按 Ctrl+C

## 为什么用 conda 环境

- 每个环境隔离（不同 Python 版本/包），互不干扰
- 切换：`conda activate 名` / `conda deactivate`
- 生信不同项目版本容易冲突，各建一个环境

## 常见坑

- 新版 conda 要先接受官方源条款：
  `conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main`
- conda 找不到命令：多半没选 initialize yes，重装并选 yes
