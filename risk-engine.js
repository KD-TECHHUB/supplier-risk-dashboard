// Combines live and simulated market data with supplier master data to
// produce a 0-100 risk score per supplier, and flags spend anomalies using a
// rolling z-score, the same basic technique used in most spend-analytics
// tools.

const RiskEngine = {
  bandFor(score) {
    return CONFIG.riskBands.find((b) => score <= b.max);
  },

  // Supplier's currency exposure score, from live FX volatility.
  currencyScore(supplier) {
    if (supplier.currency === CONFIG.baseCurrency) return 0;
    return FX.exposureScore(supplier.currency);
  },

  // Weighted commodity exposure score.
  commodityScore(supplier) {
    const exp = supplier.commodity_exposure || {};
    const keys = Object.keys(exp);
    if (keys.length === 0) return 0;
    let weighted = 0;
    keys.forEach((key) => {
      weighted += (exp[key] || 0) * Commodities.exposureScore(key);
    });
    return Math.min(100, weighted);
  },

  // Freight exposure score, gated by whether the supplier's route actually
  // runs through the Suez / Red Sea corridor.
  freightScore(supplier) {
    return supplier.uses_suez_route ? Freight.latest() : Freight.latest() * 0.15;
  },

  // Spend concentration within the supplier's own category.
  concentrationScore(supplier, allSuppliers) {
    const categoryTotal = allSuppliers
      .filter((s) => s.category === supplier.category)
      .reduce((sum, s) => sum + RiskEngine.currentSpend(s), 0);
    if (categoryTotal === 0) return 0;
    const share = RiskEngine.currentSpend(supplier) / categoryTotal;
    // A single supplier holding more than 60 percent of a category's spend
    // is treated as maximum concentration risk.
    return Math.min(100, (share / 0.6) * 100);
  },

  deliveryScore(supplier) {
    const rate = supplier.on_time_delivery_rate ?? 1;
    return Math.min(100, Math.max(0, (1 - rate) * 250));
  },

  currentSpend(supplier) {
    const h = supplier.monthly_spend_usd;
    return h[h.length - 1];
  },

  score(supplier, allSuppliers) {
    const w = CONFIG.riskWeights;
    const currency = RiskEngine.currencyScore(supplier);
    const commodity = RiskEngine.commodityScore(supplier);
    const freight = RiskEngine.freightScore(supplier);
    const concentration = RiskEngine.concentrationScore(supplier, allSuppliers);
    const delivery = RiskEngine.deliveryScore(supplier);

    const total =
      currency * w.currencyExposure +
      commodity * w.commodityExposure +
      freight * w.freightExposure +
      concentration * w.spendConcentration +
      delivery * w.deliveryReliability;

    return {
      total: Math.round(total),
      band: RiskEngine.bandFor(Math.round(total)),
      factors: {
        currency: Math.round(currency),
        commodity: Math.round(commodity),
        freight: Math.round(freight),
        concentration: Math.round(concentration),
        delivery: Math.round(delivery)
      }
    };
  },

  scoreAll(suppliers) {
    return suppliers.map((supplier) => ({
      supplier,
      risk: RiskEngine.score(supplier, suppliers)
    }));
  },

  // Rolling z-score anomaly check on the most recent month of spend versus
  // the prior months in the supplier's own history.
  spendAnomaly(supplier) {
    const history = supplier.monthly_spend_usd;
    if (history.length < 3) return { isAnomaly: false, zScore: 0 };

    const priorMonths = history.slice(0, -1);
    const latest = history[history.length - 1];
    const mean = priorMonths.reduce((a, b) => a + b, 0) / priorMonths.length;
    const variance =
      priorMonths.reduce((a, b) => a + (b - mean) ** 2, 0) / priorMonths.length;
    const stdDev = Math.sqrt(variance) || 1;
    const zScore = (latest - mean) / stdDev;

    return {
      isAnomaly: Math.abs(zScore) >= CONFIG.anomalyZScoreThreshold,
      zScore: Number(zScore.toFixed(2)),
      mean: Math.round(mean),
      latest
    };
  },

  allAnomalies(suppliers) {
    return suppliers
      .map((s) => ({ supplier: s, anomaly: RiskEngine.spendAnomaly(s) }))
      .filter((entry) => entry.anomaly.isAnomaly)
      .sort((a, b) => Math.abs(b.anomaly.zScore) - Math.abs(a.anomaly.zScore));
  },

  totalSpend(suppliers) {
    return suppliers.reduce((sum, s) => sum + RiskEngine.currentSpend(s), 0);
  }
};
