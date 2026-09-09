# dsh-token-usage

DeepSeek Harness 实时 Token 用量插件：安装后在 **设置 → 插件 → Token 用量** 查看总量、按模型/按日期/按项目明细，页面每 5 秒刷新（页面隐藏时暂停，零轮询浪费）。

## 安装

```sh
dsh plugin --profile web add git+https://github.com/huangyuheng/dsh-token-usage.git
```

重启 `dsh web` 后生效。下载 zip 解压后的本地目录安装：

```sh
dsh plugin --profile web add /解压路径/dsh-token-usage
```

## 性能设计

- 宿主侧 **不轮询、不写盘、不加定时器**：通过 `session/event` 事件总线做 O(1) 增量累加（每条 `assistant/message` 一次字典加法）。
- 启动时做 **一次性**历史重建：流式解压 `$DSH_HOME/sessions/**/session.jsonl.zstd`（`node:zlib` 原生 zstd），每读一个文件主动让出事件循环（`scheduler.yield()`），不阻塞会话处理；重建与实时事件用「会话 seq 水位」去重，任意先后顺序都不会重复计数。
- 只暴露一个只读 JSON 接口 `GET /dsh-token-usage`（仅回环可访问，内存快照，`no-store`）。

```sh
curl http://127.0.0.1:3080/dsh-token-usage
```

## 字段口径

- `input` / `output`：API 上报的输入/输出 tokens。
- `cacheRead` / `cacheWrite`：提示词缓存读/写 tokens（API 计费口径中缓存读也计入输入侧）。
- `reasoning`：推理 tokens。
- 模型归属：该会话最近一次 `request/header` 的 model；标题生成等无 usage 记录的小调用不在统计内。

## 配置（cordis.patch.yml 可覆盖）

```yaml
- id: dsh-token-usage
  name: 'dsh-token-usage'
  config:
    endpoint: /dsh-token-usage
    scanAtBoot: true   # false 则只统计插件启动之后的实时用量
```

## 别人怎么安装

零依赖、零构建，拿到文件就能装。三种方式任选其一（都需要 dsh ≥ 0.1.0-rc.6，实测 0.1.2-rc.1）：

### 方式一：直接拷目录（最快）

把 `dsh-token-usage` 整个目录发给对方（zip 或网盘），对方解压后执行：

```sh
dsh plugin --profile web add /解压路径/dsh-token-usage
# 重启 dsh web 生效
```

### 方式二：Git 仓库

```sh
# 使用者（本插件已发布在 GitHub，无需对方自己建仓库）：
dsh plugin --profile web add git+https://github.com/huangyuheng/dsh-token-usage.git
```

本插件没有 `prepare` 脚本，Git 安装不会被 pnpm 的 allowBuilds 拦截。

### 方式三：发布到 npm（一劳永逸）

```sh
# 发布方：
npm publish

# 使用者：
dsh plugin --profile web add dsh-token-usage
```

## 安装后

1. 重启 `dsh web`（bundle 成员变化必须重启才生效）；
2. 打开 **设置 → 插件 → Token 用量**；
3. 也可以用命令行：`curl 'http://127.0.0.1:3080/dsh-token-usage?month=2026-09'`。
