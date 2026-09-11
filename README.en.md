# dsh-token-use

[中文](README.md) | English

A real-time token usage plugin for DeepSeek Harness: install it, then read your usage in **Settings → Token usage** (the plugin adds its own top-level Settings entry). The page refreshes every 5 seconds and stays quiet while the tab is hidden — no wasted polling.

## Features

- **Totals card** — total (input + output + cache), input, output, cache read, cache write, reasoning, calls.
- **Range tabs** — by day / by month / all, with a date or month picker; defaults to by day = today.
- **Model filter** — the dropdown beside the range tabs narrows every breakdown to one model (including that model's project and per-day rows); defaults to all models.
- **Trend chart** — five series (total, input, output, cache read, calls) over the last 30 days, drawn with a tree-shaken ECharts bundle that ships inside the plugin (no CDN). The token series share the left axis, calls use the right one, and the axis tooltip shows every dimension for the hovered day. Rendering is imperative, so moving the mouse never re-renders React.
- **Unit switch** — 亿 / 万 / 千 in Chinese, B / M / K in English; remembered per browser.
- **Detail tables** — by model, by day and by project, each with a total column.

## Why it is worth installing

You are burning tokens, but you cannot say where: which project costs the most, which model leans hardest on the cache, how much this week grew over last week.

**dsh-token-use turns that into numbers you can read at a glance.** It folds every call as it happens, then lays totals, input, output, cache hits, reasoning and call counts out in the settings page, with filters by model, day, month or project and a smooth trend line that tells the story. Install it and you are done: nothing to configure, no session restart, and it never pops up while you are coding.

The most expensive cost is the one you cannot see — make it visible.

![Token usage panel: range and model filters, totals cards, the 30-day trend chart and the by-model table](assets/token-usage.jpg)

## Install

```sh
dsh plugin --profile web add git+https://github.com/huangyuheng/dsh-token-use.git
```

Restart `dsh web` afterwards. To install from an unpacked zip instead:

```sh
dsh plugin --profile web add /path/to/dsh-token-use
```

## Performance design

- The host side **never polls, never writes to disk and sets no timers**: it folds usage in O(1) increments from the `session/event` bus (one dictionary addition per `assistant/message`).
- History is rebuilt **once** at boot by streaming `$DSH_HOME/sessions/**/session.jsonl.zstd` (native zstd from `node:zlib`), yielding the event loop between files (`scheduler.yield()`) so session handling is never blocked. A per-session sequence watermark de-duplicates the rebuild against live events, whatever order they arrive in.
- One read-only JSON endpoint is exposed: `GET /dsh-token-use` (loopback only, in-memory snapshot, `no-store`).

```sh
# everything
curl http://127.0.0.1:3080/dsh-token-use
# a date / a month
curl 'http://127.0.0.1:3080/dsh-token-use?month=2026-09'
curl 'http://127.0.0.1:3080/dsh-token-use?day=2026-09-10'
# a model (combinable with day/month)
curl 'http://127.0.0.1:3080/dsh-token-use?model=deepseek-v4-flash'
```

## Development

```sh
pnpm install          # development only (esbuild + echarts)
pnpm run build        # regenerate client/client.js (= tree-shaken ECharts + client/src.js)
```

`client/client.js` is a committed build artifact, so users install nothing and build nothing.

npm metadata (`repository` / `files` / `LICENSE`) is ready but **publishing is deferred**: the plugin currently installs from GitHub (`dsh plugin --profile web add github:huangyuheng/dsh-token-use`). Run `npm publish` whenever that changes.

## Field definitions

- `input` / `output` — input and output tokens as reported by the API.
- `cacheRead` / `cacheWrite` — prompt cache read/write tokens (the API counts cache reads on the input side for billing).
- `reasoning` — reasoning tokens.
- Model attribution — the model of the session's most recent `request/header`; small calls that carry no usage record (title generation, for example) are not counted.

## Compatibility

These differences are already handled before anyone else installs the plugin:

| Dimension | Notes |
| --- | --- |
| Runtime | Requires **dsh web ≥ 0.1.0-rc.6** (the settings sidebar `settings.section` slot). The host half uses Node built-ins only; zstd decoding uses `node:zlib` (built in from Node 22.15, and dsh itself requires ^22.19 \|\| >=24, so it is always present). |
| Data directory | Resolved from `$DSH_HOME` (environment variable, defaulting to `~/.dsh`), matching dsh's own `dsh-home-paths` rules; a custom home works too. The plugin is **read-only** — it writes nothing. |
| Session formats | Handles both `session.jsonl.zstd` (multi-frame zstd with checksums) and plaintext `session.jsonl`; `.bak` / `.corrupt-*` copies are skipped, and a single corrupt frame only raises `scan.skipped` without affecting the other sessions. |
| Directory layout | Follows the official JSONL persistence layout `sessions/<project dir>/<session dir>/`, reading every session independently. |
| Accounting | Some providers (the pi-ai adapter, for instance) fold reasoning tokens into output, so a `reasoning` column of 0 is normal there; calls that record no `usage` (title generation, web search) are not counted; model attribution uses the session's most recent `request/header`. |
| Network | The endpoint is **loopback-only** by default. On a LAN deployment (trustedHosts configured) set `allowRemote: true` in the profile patch; it still accepts same-origin requests only, and the client names the reason when it sees a 403. |
| Performance | The history rebuild runs on a **worker thread**, so the host event loop is never blocked; events arriving meanwhile are buffered and replayed after the scan, with the session sequence watermark keeping the two folds distinct. Only event increments happen afterwards. |
| Multiple instances | Every `$DSH_HOME` is counted separately; several profiles under one home share the `sessions` directory, so their usage is merged. |

## Configuration (overridable in cordis.patch.yml)

```yaml
- id: dsh-token-use
  name: 'dsh-token-use'
  config:
    endpoint: /dsh-token-use
    scanAtBoot: true    # false counts only usage recorded after the plugin starts
    allowRemote: false  # set true for LAN (non-loopback) access; same-origin only
```

## After installing

1. Restart `dsh web` (a bundle membership change only takes effect on restart);
2. Open **Settings → Token usage**;
3. Or from the command line: `curl 'http://127.0.0.1:3080/dsh-token-use?month=2026-09'`.
