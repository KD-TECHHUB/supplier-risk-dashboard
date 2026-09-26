// Central configuration for the Supplier Risk and Spend Dashboard.
// Adjust these values to match your own procurement categories and risk appetite.

const CONFIG = {
  // How often the dashboard pulls fresh data, in milliseconds.
  refreshIntervalMs: 5 * 60 * 1000,

  // Base currency for spend reporting.
  baseCurrency: "USD",

  // Currencies to track for FX exposure. These are fetched live from the
  // Frankfurter API (European Central Bank reference rates, no key required).
  trackedCurrencies: ["AED", "EUR", "CNY", "INR", "GBP", "KRW", "SAR", "TRY", "PKR"],

  // Weights used to combine the five risk factors into one 0-100 score.
  // These must add up to 1.
  riskWeights: {
    currencyExposure: 0.2,
    commodityExposure: 0.25,
    freightExposure: 0.2,
    spendConcentration: 0.15,
    deliveryReliability: 0.2
  },

  // Score bands for labeling supplier risk.
  riskBands: [
    { max: 30, label: "Low", tone: "low" },
    { max: 55, label: "Medium", tone: "medium" },
    { max: 75, label: "High", tone: "high" },
    { max: 101, label: "Critical", tone: "critical" }
  ],

  // Z-score threshold beyond which a month's spend is flagged as an anomaly.
  // Set above the textbook value of 2 because several categories in the
  // sample data have naturally low month-to-month variance, which makes a
  // strict threshold of 2 flag routine small moves as anomalies. Lower this
  // back toward 2 once you are running on your own real spend history.
  anomalyZScoreThreshold: 3,

  // Data source status flags. Set to true once you have wired in a paid
  // commodity or freight index API through a small server-side proxy
  // (see README, section "Making commodities and freight fully live").
  liveCommodityFeed: false,
  liveFreightFeed: false
};
