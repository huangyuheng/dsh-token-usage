# dsh-token-usage

DeepSeek Harness 实时 Token 用量插件：安装后在 **设置 → Token 用量** 查看总量、按模型/按日期/按项目明细，页面每 5 秒刷新（页面隐藏时暂停，零轮询浪费）。

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

## 安装后

1. 重启 `dsh web`（bundle 成员变化必须重启才生效）；
2. 打开 **设置 → Token 用量**；
3. 也可以用命令行：`curl 'http://127.0.0.1:3080/dsh-token-usage?month=2026-09'`。
