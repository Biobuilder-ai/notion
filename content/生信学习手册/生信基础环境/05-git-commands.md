---
publish: true
created: 2026-08-29T00:50:17.883Z
modified: 2026-08-29T01:51:39.474Z
tags:
  - 基础指南
  - 控制工具
  - git
---

# 04 git 常用命令

## 初始化与基本操作

```bash
git init                       # 把当前目录变成 git 仓库
git status                     # 查看当前状态（最常用！）
git add 文件名                  # 把一个文件加入暂存区
git add .                      # 把所有文件加入暂存区
git commit -m "说明"            # 提交（存档）
git commit -am "说明"           # 已跟踪文件：add + commit 一步到位
git log                        # 查看提交历史
git log --oneline              # 简洁版历史
git log --oneline --graph --all # 查看分支树
```

## 分支操作

```bash
git branch                     # 查看本地分支列表
git branch -a                  # 查看本地+远程分支
git switch -c 分支名            # 创建并切换到新分支
git switch 分支名               # 切换分支
git merge 分支名                # 把指定分支合并到当前分支
git branch -d 分支名            # 删除本地分支（已合并）
git branch -D 分支名            # 强制删除本地分支（未合并也能删）
```

## 远程与 GitHub

```bash
git remote add origin 远程地址   # 关联远程仓库
git push -u origin 分支名       # 推送并设跟踪关系
git push                       # 推送（已设跟踪后）
git pull                       # 拉取远程更新
git push origin --delete 分支名 # 删除远程分支
```

## 撤销操作

```bash
git restore --staged 文件名     # 撤销 add（保留修改）
git restore 文件名              # 放弃修改（会丢改动！）
git reset HEAD                 # 撤销所有 add
```

## .gitignore 规则

- 后缀匹配：`*.md`、`*.txt`
- 文件夹：`data/`、`results/`
- 例外：`!README.md`（不忽略 README.md）
- 注释：`# 说明`
- 只对**未跟踪**的新文件生效；已跟踪文件需 `git rm --cached 文件名` 解除跟踪
