// Live foreign exchange data.
// Frankfurter (frankfurter.app) mirrors European Central Bank reference rates,
// is free, requires no API key, and allows browser-side requests, so this
// part of the dashboard is genuinely live once deployed.

const FX = {
  latest: null,
  weekAgo: null,
  status: "pending", // "live" | "stale" | "error"
  asOf: null,

  async load() {
    const symbols = CONFIG.trackedCurrencies.join(",");
    try {
      const latestResp = await fetch(
        `https://api.frankfurter.app/latest?from=${CONFIG.baseCurrency}&to=${symbols}`
      );
      if (!latestResp.ok) throw new Error("FX latest request failed");
      const latestData = await latestResp.json();

      const sevenDaysAgo = FX.daysAgo(7);
      const historyResp = await fetch(
        `https://api.frankfurter.app/${sevenDaysAgo}?from=${CONFIG.baseCurrency}&to=${symbols}`
      );
      if (!historyResp.ok) throw new Error("FX history request failed");
      const historyData = await historyResp.json();

      FX.latest = latestData.rates;
      FX.weekAgo = historyData.rates;
      FX.asOf = latestData.date;
      FX.status = "live";
    } catch (err) {
      console.error("FX feed error, keeping last known rates:", err);
      FX.status = FX.latest ? "stale" : "error";
    }
    return FX.status;
  },

  daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  },

  // Percent change of a currency against the base currency over the last week.
  // A positive number means the currency weakened against the base (more
  // local currency needed per unit of base currency), which raises cost risk
  // for a supplier invoicing in that currency.
  weeklyChangePct(currencyCode) {
    if (!FX.latest || !FX.weekAgo) return 0;
    const now = FX.latest[currencyCode];
    const then = FX.weekAgo[currencyCode];
    if (!now || !then) return 0;
    return ((now - then) / then) * 100;
  },

  // A simple 0-100 exposure score from the magnitude of the weekly swing.
  // Anything beyond a 4 percent weekly move is treated as maximum exposure.
  exposureScore(currencyCode) {
    const change = Math.abs(FX.weeklyChangePct(currencyCode));
    return Math.min(100, (change / 4) * 100);
  }
};
