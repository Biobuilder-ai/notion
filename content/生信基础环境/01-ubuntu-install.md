---
publish: true
created: 2026-08-29T01:50:15.937+01:00
modified: 2026-08-29T02:51:20.418+01:00
tags:
  - 基础指南
  - Linux
---

# 01 Ubuntu 安装与迁移

## 前提

- Windows 上安装 WSL2，并装一个真正的 Linux 发行版（Ubuntu）。
- 亲测：只装 docker-desktop 不是可用的 Linux，生信必须在 Ubuntu 里做。

## 安装步骤

1. 管理员 PowerShell：`wsl --update` 更新内核
2. `wsl --install -d Ubuntu` 安装发行版（或去 Microsoft Store 装）
3. 首次进入设置用户名和密码，验证：`python3 --version`、`git --version`

## 迁移到 E 盘（默认装 C 盘，生信数据大，建议迁走）

流程 = 导出 → 注销 → 导入：

```powershell
wsl --shutdown
wsl --export Ubuntu E:\Ubuntu-backup.tar
New-Item -ItemType Directory -Path 'E:\WSL\Ubuntu' -Force
wsl --unregister Ubuntu
wsl --import Ubuntu 'E:\WSL\Ubuntu' 'E:\Ubuntu-backup.tar' --version 2
```

## 常见坑

- 导出报"拒绝访问"：先 `wsl --shutdown` 再导出，或换到用户目录/E盘路径
- 导入后默认用户变 root：写 `/etc/wsl.conf` 恢复：
  `printf '[user]\ndefault=用户名' | sudo tee /etc/wsl.conf`
- wsl.conf 写错会报错，用 `wsl -d Ubuntu -u root -- sh -c "printf ... > /etc/wsl.conf"` 修复

## 确认命令

```powershell
wsl -l -v
wsl --set-default Ubuntu
```
