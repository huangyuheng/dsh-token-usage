window.__ModuleLoader__.load({ id: "dsh-token-usage", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  var react = require("react");
  var useEffect = react.useEffect;
  var useState = react.useState;
  var h = react.createElement;

  var NS = "settings.tokenUsage";
  var inject = ["slots", "locale"];

  var zh = {
    tab: "Token 用量",
    totals: "总用量（历史重建 + 实时累计）",
    total: "总计",
    input: "输入",
    output: "输出",
    cacheRead: "缓存读",
    cacheWrite: "缓存写",
    reasoning: "推理",
    calls: "调用次数",
    byModel: "按模型",
    byDay: "按日期",
    byProject: "按项目",
    trend: "用量趋势",
    trendNote: "每条折线按自身峰值归一化；悬停查看当日明细",
    trendEmpty: "当前范围不足两天数据，切换到「按月」或「全部」查看趋势",
    peak: "峰值",
    filterAll: "全部",
    filterDay: "按天",
    filterMonth: "按月",
    filterLabel: "范围",
    modelLabel: "模型",
    modelAll: "全部模型",
    unitLabel: "单位",
    unitZh: "中文",
    unitEn: "英文",
    scanPending: "正在重建历史用量…",
    scanDone: "已扫描 {sessions} 个会话 · {files} 个日志 · {ms} ms",
    scanFailed: "历史重建失败：{error}",
    updated: "更新于 {time}",
    loading: "加载中…",
    error: "读取失败",
    retry: "重试"
  };
  var en = {
    tab: "Token usage",
    totals: "Totals (history rebuild + live fold)",
    total: "Total",
    input: "Input",
    output: "Output",
    cacheRead: "Cache read",
    cacheWrite: "Cache write",
    reasoning: "Reasoning",
    calls: "Calls",
    byModel: "By model",
    byDay: "By day",
    byProject: "By project",
    trend: "Usage trend",
    trendNote: "Each line is normalized to its own peak; hover for daily detail",
    trendEmpty: "Fewer than two days in range — switch to By month or All for a trend",
    peak: "Peak",
    filterAll: "All",
    filterDay: "By day",
    filterMonth: "By month",
    filterLabel: "Range",
    modelLabel: "Model",
    modelAll: "All models",
    unitLabel: "Unit",
    unitZh: "中文",
    unitEn: "English",
    scanPending: "Rebuilding history…",
    scanDone: "Scanned {sessions} sessions · {files} logs · {ms} ms",
    scanFailed: "History rebuild failed: {error}",
    updated: "Updated {time}",
    loading: "Loading…",
    error: "Failed to load",
    retry: "Retry"
  };

  var css = ".dshtu_wrap{max-width:860px;display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary);font-size:13px}.dshtu_card{background:var(--dsw-alias-bg-layer-3);border-radius:14px;box-shadow:var(--dsw-elevation-stroke);padding:14px 16px}.dshtu_bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dshtu_bar label{color:var(--dsw-alias-label-tertiary);font-size:12px}.dshtu_bar select,.dshtu_bar input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:4px 8px;font-size:12.5px}.dshtu_bar select{width:168px;text-overflow:ellipsis;white-space:nowrap}.dshtu_field{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.dshtu_seg{display:inline-flex;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;overflow:hidden}.dshtu_seg button{border:0;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;padding:4px 10px;font-size:12.5px}.dshtu_seg button[data-on=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dshtu_grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}.dshtu_stat{background:var(--dsw-alias-bg-module-platform);border-radius:10px;padding:10px 12px}.dshtu_stat b{display:block;font-size:16px;line-height:24px;font-variant-numeric:tabular-nums}.dshtu_stat span{color:var(--dsw-alias-label-tertiary);font-size:12px}.dshtu_stat[data-main=true]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,var(--dsw-alias-bg-module-platform))}.dshtu_stat[data-main=true] b{color:var(--dsw-alias-state-business-primary);font-size:20px}.dshtu_table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.dshtu_table th,.dshtu_table td{text-align:right;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l2);font-weight:400}.dshtu_table th:first-child,.dshtu_table td:first-child{text-align:left}.dshtu_table th{color:var(--dsw-alias-label-tertiary);font-size:12px}.dshtu_table td:first-child{overflow-wrap:anywhere;max-width:300px;color:var(--dsw-alias-label-secondary)}.dshtu_meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dshtu_err{color:var(--dsw-alias-state-error-primary);display:flex;align-items:center;gap:10px}.dshtu_err button{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:4px 10px}.dshtu_chart{width:100%;height:260px}";

  function trimNum(v, decimals) {
    var f = v.toFixed(decimals);
    if (f.indexOf(".") !== -1) f = f.replace(/0+$/, "").replace(/\.$/, "");
    return f;
  }

  function fmtValue(v, unit) {
    v = v || 0;
    if (unit === "en") {
      if (v >= 1e9) return trimNum(v / 1e9, 2) + "B";
      if (v >= 1e6) return trimNum(v / 1e6, 2) + "M";
      if (v >= 1e3) return trimNum(v / 1e3, 1) + "K";
      return String(v);
    }
    if (v >= 1e8) return trimNum(v / 1e8, 2) + "亿";
    if (v >= 1e4) return trimNum(v / 1e4, 1) + "万";
    if (v >= 1e3) return trimNum(v / 1e3, 1) + "千";
    return String(v);
  }

  var fmtTime = function (ms) {
    var d = new Date(ms);
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  };

  var today = function () { return new Date().toISOString().slice(0, 10); };
  var thisMonth = function () { return new Date().toISOString().slice(0, 7); };

  function statBox(t, label, value, unit, main) {
    return h("div", { className: "dshtu_stat", "data-main": main === true },
      h("b", null, fmtValue(value, unit)),
      h("span", null, label));
  }

  function table(t, keyLabel, rows, unit) {
    var keys = Object.keys(rows || {});
    if (keys.length === 0) return null;
    return h("div", { className: "dshtu_card" },
      h("table", { className: "dshtu_table" },
        h("thead", null,
          h("tr", null,
            h("th", null, keyLabel),
            h("th", null, t("total")),
            h("th", null, t("input")),
            h("th", null, t("output")),
            h("th", null, t("cacheRead")),
            h("th", null, t("reasoning")),
            h("th", null, t("calls")))),
        h("tbody", null, keys.map(function (key) {
          var row = rows[key];
          return h("tr", { key: key },
            h("td", null, key),
            h("td", null, fmtValue(row.total, unit)),
            h("td", null, fmtValue(row.input, unit)),
            h("td", null, fmtValue(row.output, unit)),
            h("td", null, fmtValue(row.cacheRead, unit)),
            h("td", null, fmtValue(row.reasoning, unit)),
            h("td", null, fmtValue(row.calls, unit)));
        }))));
  }

  var CHART_SERIES = [
    { key: "total", label: "total", color: "#3b82f6", axis: 0, area: true },
    { key: "input", label: "input", color: "#10b981", axis: 0 },
    { key: "output", label: "output", color: "#f59e0b", axis: 0 },
    { key: "cacheRead", label: "cacheRead", color: "#8b5cf6", axis: 0 },
    { key: "calls", label: "calls", color: "#ef4444", axis: 1 }
  ];

  function buildChartOption(t, unit, trend) {
    var days = Object.keys(trend.days || {}).sort();
    return {
      animation: false,
      grid: { left: 6, right: 6, top: 34, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: function (value) { return fmtValue(value, unit); }
      },
      legend: { top: 0, right: 0, icon: "roundRect", itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 12 } },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: days.map(function (d) { return d.slice(5); }),
        axisTick: { show: false }
      },
      yAxis: [
        { type: "value", axisLabel: { formatter: function (v) { return fmtValue(v, unit); } }, splitLine: { lineStyle: { opacity: 0.15 } } },
        { type: "value", axisLabel: { formatter: function (v) { return String(v); } }, splitLine: { show: false } }
      ],
      series: CHART_SERIES.map(function (s) {
        return {
          name: t(s.label),
          type: "line",
          yAxisIndex: s.axis,
          smooth: false,
          symbol: "none",
          showSymbol: false,
          lineStyle: { width: 2, color: s.color },
          itemStyle: { color: s.color },
          emphasis: { focus: "series" },
          areaStyle: s.area ? { opacity: 0.08, color: s.color } : undefined,
          data: days.map(function (d) { return (trend.days[d] || {})[s.key] || 0; })
        };
      })
    };
  }

  function TrendChart(props) {
    var t = props.t;
    var unit = props.unit;
    var trend = props.trend || { days: {} };
    var holder = react.useRef(null);
    var chart = react.useRef(null);
    var days = Object.keys(trend.days || {}).length;

    useEffect(function () {
      var echarts = globalThis.__DSHTU_ECHARTS__;
      if (!echarts || !holder.current || days < 2) return undefined;
      if (chart.current === null) chart.current = echarts.init(holder.current, null, { renderer: "canvas" });
      chart.current.setOption(buildChartOption(t, unit, trend), true);
      var onResize = function () { if (chart.current) chart.current.resize(); };
      window.addEventListener("resize", onResize);
      return function () { window.removeEventListener("resize", onResize); };
    }, [t, unit, trend, days]);

    useEffect(function () {
      return function () {
        if (chart.current) {
          chart.current.dispose();
          chart.current = null;
        }
      };
    }, []);

    if (days < 2) {
      return h("div", { className: "dshtu_card dshtu_meta" }, t("trendEmpty"));
    }
    return h("div", { className: "dshtu_card" },
      h("div", { className: "dshtu_meta" }, t("trend") + " · " + trend.from + " ~ " + trend.to),
      h("div", { className: "dshtu_chart", ref: holder }));
  }

  function Tab(props) {
    var t = props.t;
    var _a = useState(null), data = _a[0], setData = _a[1];
    var _b = useState(null), error = _b[0], setError = _b[1];
    var _c = useState(0), tick = _c[0], setTick = _c[1];
    var _d = useState("day"), mode = _d[0], setMode = _d[1];
    var _e = useState(today()), day = _e[0], setDay = _e[1];
    var _f = useState(thisMonth()), month = _f[0], setMonth = _f[1];
    var _g = useState(""), model = _g[0], setModel = _g[1];
    var _h = useState(function () {
      try { return localStorage.getItem("dshtu.unit") === "en" ? "en" : "zh"; } catch (err) { return "zh"; }
    }), unit = _h[0], setUnit = _h[1];

    var parts = [];
    if (mode === "day") parts.push("day=" + day);
    if (mode === "month") parts.push("month=" + month);
    if (model) parts.push("model=" + encodeURIComponent(model));
    var query = parts.length > 0 ? "?" + parts.join("&") : "";

    useEffect(function () {
      var stopped = false;
      var controller = null;
      var load = function () {
        if (controller) controller.abort();
        controller = new AbortController();
        fetch("/dsh-token-usage" + query, { signal: controller.signal })
          .then(function (res) {
            if (!res.ok) throw new Error("http " + res.status);
            return res.json();
          })
          .then(function (json) {
            if (!stopped) { setData(json); setError(null); }
          })
          .catch(function (err) {
            if (!stopped && err.name !== "AbortError") setError(String(err));
          });
      };
      load();
      var timer = setInterval(function () {
        if (!document.hidden) load();
      }, 5000);
      var onVisible = function () { if (!document.hidden) load(); };
      document.addEventListener("visibilitychange", onVisible);
      return function () {
        stopped = true;
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
        if (controller) controller.abort();
      };
    }, [query, tick]);

    useEffect(function () {
      var el = document.getElementById("dshtu-style");
      if (!el) {
        el = document.createElement("style");
        el.id = "dshtu-style";
        el.textContent = css;
        document.head.appendChild(el);
      }
    }, []);

    var switchUnit = function (next) {
      setUnit(next);
      try { localStorage.setItem("dshtu.unit", next); } catch (err) {}
    };

    var seg = function (value, label) {
      return h("button", { key: value, "data-on": unit === value, onClick: function () { switchUnit(value); } }, label);
    };

    var modeTab = function (value, label) {
      return h("button", { key: value, "data-on": mode === value, onClick: function () { setMode(value); setTick(tick + 1); } }, label);
    };

    if (error) {
      return h("div", { className: "dshtu_wrap" },
        h("div", { className: "dshtu_card dshtu_err" },
          h("span", null, t("error") + ": " + error),
          h("button", { onClick: function () { setError(null); setTick(tick + 1); } }, t("retry"))));
    }
    if (!data) {
      return h("div", { className: "dshtu_wrap" },
        h("div", { className: "dshtu_card dshtu_meta" }, t("loading")));
    }
    var totals = data.totals || {};
    var models = (data.models && data.models.length > 0 ? data.models : Object.keys(data.byModel || {}));
    var metaParts = [];
    if (data.scan && data.scan.done) {
      metaParts.push(t("scanDone").replace("{sessions}", data.scan.sessions).replace("{files}", data.scan.files).replace("{ms}", data.scan.ms));
    } else if (data.scan && data.scan.error) {
      metaParts.push(t("scanFailed").replace("{error}", data.scan.error));
    } else {
      metaParts.push(t("scanPending"));
    }
    metaParts.push(t("updated").replace("{time}", fmtTime(data.updatedAt)));
    return h("div", { className: "dshtu_wrap" },
      h("div", { className: "dshtu_card" },
        h("div", { className: "dshtu_bar" },
          h("label", null, t("filterLabel")),
          h("span", { className: "dshtu_seg" },
            modeTab("day", t("filterDay")),
            modeTab("month", t("filterMonth")),
            modeTab("all", t("filterAll"))),
          mode === "day" ? h("input", { type: "date", value: day, onChange: function (e) { setDay(e.target.value); setTick(tick + 1); } }) : null,
          mode === "month" ? h("input", { type: "month", value: month, onChange: function (e) { setMonth(e.target.value); setTick(tick + 1); } }) : null,
          h("span", { className: "dshtu_field" },
            h("label", null, t("modelLabel")),
            h("select", { value: model, onChange: function (e) { setModel(e.target.value); setTick(tick + 1); } },
              h("option", { value: "" }, t("modelAll")),
              models.map(function (name) { return h("option", { key: name, value: name }, name); }))),
          h("span", { style: { flex: "1" } }),
          h("label", null, t("unitLabel")),
          h("span", { className: "dshtu_seg" }, seg("zh", t("unitZh")), seg("en", t("unitEn")))),
        h("div", { className: "dshtu_meta" }, t("totals")),
        h("div", { className: "dshtu_grid" },
          statBox(t, t("total"), totals.total, unit, true),
          statBox(t, t("input"), totals.input, unit),
          statBox(t, t("output"), totals.output, unit),
          statBox(t, t("cacheRead"), totals.cacheRead, unit),
          statBox(t, t("cacheWrite"), totals.cacheWrite, unit),
          statBox(t, t("reasoning"), totals.reasoning, unit),
          statBox(t, t("calls"), totals.calls, unit))),
      h(TrendChart, { t: t, unit: unit, trend: data.trend }),
      table(t, t("byModel"), data.byModel, unit),
      table(t, t("byDay"), data.byDay, unit),
      table(t, t("byProject"), data.byProject, unit),
      h("div", { className: "dshtu_meta" }, metaParts.join(" · ")));
  }

  function apply(ctx) {
    ctx.effect(function () {
      ctx.locale.register(NS, { zh: zh, en: en });
    }, "dsh-token-usage: dictionaries");
    var t = ctx.locale.bind(NS);
    ctx.slots.inject("settings.section", function () {
      return ctx.slots.register({
        name: "settings.section",
        id: "token-usage",
        order: 90,
        label: function () { return t("tab"); },
        locale: NS,
        inject: function () { return { t: t }; }
      }, function (props) { return h(Tab, props); });
    });
  }

  exports.NS = NS;
  exports.apply = apply;
  exports.inject = inject;
  return module.exports;
} });
