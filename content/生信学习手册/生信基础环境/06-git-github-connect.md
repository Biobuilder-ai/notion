---
publish: true
created: 2026-08-29T00:50:18.464Z
modified: 2026-08-29T01:51:45.452Z
tags:
  - 基础指南
  - git
---

# 05 git 连接 GitHub

## 方式选择

推荐用 **SSH**（一次配置，永久免密）。

## 1. 生成 SSH 密钥

```bash
ssh-keygen -t ed25519 -C "你的邮箱@example.com"
# 一路回车即可
```

## 2. 查看公钥并复制

```bash
cat ~/.ssh/id_ed25519.pub
```

复制整行（从 `ssh-ed25519` 到邮箱结尾）。

## 3. 添加到 GitHub

1. 浏览器打开 https://github.com/settings/ssh/new
2. Title 填：WSL Ubuntu（或其他名字）
3. Key 粘贴公钥
4. 点 Add SSH key

## 4. 测试连接

```bash
ssh -T git@github.com
```

看到 `Hi 用户名! You've successfully authenticated` 就成功了。

## 5. 推送本地仓库到 GitHub

```bash
cd 你的项目目录
git remote add origin git@github.com:你的用户名/仓库名.git
git push -u origin master
```

## 6. 推送新分支

```bash
git push -u origin 分支名
```

## SSH vs HTTPS

- SSH：配密钥后免密，稳定
- HTTPS：需 Personal Access Token，每次可能要输
- 已配好 SSH 优先用 SSH 地址

## 常见坑

- 推送前确认 SSH 地址开头是 `git@github.com:` 而不是 `https://`
- 删除 GitHub 上的分支需单独操作：`git push origin --delete 分支名`
