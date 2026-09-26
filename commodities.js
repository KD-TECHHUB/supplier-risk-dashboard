// Commodity price feed for steel, aluminium and oil.
//
// Honest note for anyone reviewing this project: reliable free, key-less,
// browser-callable commodity price APIs do not really exist. The providers
// that do exist (EIA, MetalpriceAPI, Commodities-API, Freightos) all require
// a secret API key, and a key placed in client-side code on GitHub Pages
// would be public to anyone who views source, which is a real security
// mistake. So by default this dashboard runs a seeded random-walk simulation
// that starts from realistic current price levels and drifts a small amount
// on every refresh, clearly labeled "Simulated" in the UI.
//
// To make this feed genuinely live: deploy a small serverless function
// (Cloudflare Worker, Vercel function, or AWS Lambda all have free tiers)
// that holds your API key server-side and forwards the request. Then point
// COMMODITY_LIVE_ENDPOINT below at it and set CONFIG.liveCommodityFeed to
// true. See README.md, "Making commodities and freight fully live".

const COMMODITY_LIVE_ENDPOINT = null; // e.g. "https://your-worker.example.workers.dev/commodities"

const Commodities = {
  series: {
    steel: { unit: "USD / metric ton", history: [] },
    aluminum: { unit: "USD / metric ton", history: [] },
    oil: { unit: "USD / barrel (Brent)", history: [] }
  },
  status: "simulated",

  seedIfEmpty() {
    const seeds = { steel: 780, aluminum: 2380, oil: 82 };
    Object.keys(seeds).forEach((key) => {
      if (Commodities.series[key].history.length === 0) {
        Commodities.series[key].history.push(seeds[key]);
      }
    });
  },

  async load() {
    Commodities.seedIfEmpty();

    if (CONFIG.liveCommodityFeed && COMMODITY_LIVE_ENDPOINT) {
      try {
        const resp = await fetch(COMMODITY_LIVE_ENDPOINT);
        if (!resp.ok) throw new Error("Live commodity request failed");
        const data = await resp.json();
        ["steel", "aluminum", "oil"].forEach((key) => {
          if (typeof data[key] === "number") {
            Commodities.series[key].history.push(data[key]);
          }
        });
        Commodities.status = "live";
        Commodities.trim();
        return Commodities.status;
      } catch (err) {
        console.error("Live commodity feed failed, falling back to simulation:", err);
      }
    }

    // Simulated drift: small random percentage move per refresh, biased
    // slightly by category so the three series do not move identically.
    Commodities.step("steel", 0.006);
    Commodities.step("aluminum", 0.007);
    Commodities.step("oil", 0.012);
    Commodities.status = "simulated";
    Commodities.trim();
    return Commodities.status;
  },

  step(key, volatility) {
    const series = Commodities.series[key].history;
    const last = series[series.length - 1];
    const move = (Math.random() * 2 - 1) * volatility;
    const next = Math.max(1, last * (1 + move));
    series.push(Number(next.toFixed(2)));
  },

  trim() {
    Object.values(Commodities.series).forEach((s) => {
      if (s.history.length > 60) s.history = s.history.slice(-60);
    });
  },

  latest(key) {
    const h = Commodities.series[key].history;
    return h[h.length - 1];
  },

  changePct(key, lookback = 5) {
    const h = Commodities.series[key].history;
    if (h.length < 2) return 0;
    const idx = Math.max(0, h.length - 1 - lookback);
    const then = h[idx];
    const now = h[h.length - 1];
    return ((now - then) / then) * 100;
  },

  // 0-100 exposure score from the magnitude of the recent move.
  exposureScore(key) {
    const change = Math.abs(Commodities.changePct(key));
    return Math.min(100, (change / 6) * 100);
  }
};
