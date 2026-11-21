# 宽基 ETF 价值投资回测

覆盖上证50、沪深300、中证500、中证1000、创业板指和科创50。研究快照截至 2026-11-20。网页提供共同区间、前后段、各自最长区间、两档交易成本、日频风险指标和月度净值曲线。

[纯 PE 十年回测](https://leejiazhi88-gif.github.io/etf-value-lab/pe10.html) 从 2016-11-21 至 2026-11-20 逐日计算。PE 分位不高于 20% 时一次满仓，不低于 80% 时全部退出。使用 `research/pe10.cjs` 生成页面数据。以上一页的 Tushare 文件为基础，上市较早的四只 ETF 增加 2016-11-18 至 2017-12-31 行情和复权因子（文件名起始年 2016），除科创50以外的指数增加 2013-10-01 至 2014-12-31 的估值预热段（文件名起始年 2013）。

## 数据与复现

页面提供模拟结果及口径。回测引擎位于 `research/build.cjs`。运行时，从工作目录下的 `work/` 读取以下 JSON，生成 `work/site/results.js`。原始行情请使用已授权的数据源获取。

- `fund_daily-{ETF TS代码}-{起始年}.json` 和 `fund_adj-{ETF TS代码}-{起始年}.json` 来自 Tushare 同名接口。按 2018–2020、2021–2023、2024–2026-11-20 分段。字段分别为 `trade_date,open,close,amount` 与 `trade_date,adj_factor`。
- `val-{指数 TS代码}-{起始年}.json` 来自 Tushare `index_dailybasic`。按 2015–2018、2019–2022、2023–2026-11-20 分段。字段为 `trade_date,pe_ttm,pb`。
- 项目 1 的 `work/{valuation_data,official_sentiment_events,retail_sentiment_data,national_team_etf_history,etf_flow_data}.json` 保存为 `work/p0-{文件名}.json`，估值用于宽口径背景，其余用于信号。文件快照可按仓库树 `6dd47c55fe92222df5c1e0e38819c5395ed8dd76` 查找。
- 项目 2 的 `outputs/market_modules_data.json` 保存为 `work/p1-market_modules_data.json`，用于个股市场温度。树 `b316b3e496291ad71efeaee3effe5eb3eac24f77`。
- 项目 2.2 的 `data-manifest.json` 保存为 `work/p2-data-manifest.json`，用于行业背景。树 `c8abe6265a33b7ad122224aa37991ed02b131f8a`。
- 项目 6 的 `work/{valuation_data,star_official_history,retail_index_metrics}.json` 保存为 `work/p3-{文件名}.json`，提供创业板周度 PB、两只成长指数换手率和科创50 PE 对照。树 `c112a9b6559fd5717db65d92668c7935108f5d70`。

建立 `work/site/` 后运行 `node research/build.cjs`。页面加载静态研究快照。
