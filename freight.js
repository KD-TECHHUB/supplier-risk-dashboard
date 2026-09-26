// Freight and shipping disruption index, focused on the Suez / Red Sea
// corridor that most Dubai-facing trade lanes from Asia and Europe depend on.
//
// Same honesty note as commodities.js: a genuinely live version of this index
// (Freightos Baltic Index, IMF PortWatch transit counts, or a news-sentiment
// feed) needs a server-side key. This ships simulated by default, wired for
// a real endpoint through FREIGHT_LIVE_ENDPOINT.

const FREIGHT_LIVE_ENDPOINT = null; // e.g. "https://your-worker.example.workers.dev/freight"

const Freight = {
  // 0 = no disruption, 100 = severe, route-altering disruption.
  history: [38],
  status: "simulated",

  async load() {
    if (CONFIG.liveFreightFeed && FREIGHT_LIVE_ENDPOINT) {
      try {
        const resp = await fetch(FREIGHT_LIVE_ENDPOINT);
        if (!resp.ok) throw new Error("Live freight request failed");
        const data = await resp.json();
        if (typeof data.suezRiskIndex === "number") {
          Freight.history.push(data.suezRiskIndex);
          Freight.status = "live";
          Freight.trim();
          return Freight.status;
        }
      } catch (err) {
        console.error("Live freight feed failed, falling back to simulation:", err);
      }
    }

    const last = Freight.history[Freight.history.length - 1];
    const move = (Math.random() * 2 - 1) * 6;
    const next = Math.min(100, Math.max(0, last + move));
    Freight.history.push(Number(next.toFixed(1)));
    Freight.status = "simulated";
    Freight.trim();
    return Freight.status;
  },

  trim() {
    if (Freight.history.length > 60) Freight.history = Freight.history.slice(-60);
  },

  latest() {
    return Freight.history[Freight.history.length - 1];
  },

  band() {
    const v = Freight.latest();
    if (v < 30) return { label: "Clear", tone: "low" };
    if (v < 55) return { label: "Elevated", tone: "medium" };
    if (v < 75) return { label: "High", tone: "high" };
    return { label: "Severe", tone: "critical" };
  }
};
