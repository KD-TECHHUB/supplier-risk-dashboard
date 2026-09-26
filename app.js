const App = {
  suppliers: [],
  countdownSeconds: 0,
  countdownTimer: null,

  async init() {
    const resp = await fetch("suppliers.json");
    const data = await resp.json();
    App.suppliers = data.suppliers;

    document.getElementById("sort-select").addEventListener("change", () => {
      const scored = RiskEngine.scoreAll(App.suppliers);
      Render.renderSupplierTable(scored, document.getElementById("sort-select").value);
    });

    document.getElementById("refresh-btn").addEventListener("click", () => App.refresh());
    document.getElementById("category-filter").addEventListener("change", () => App.refresh(false));

    await App.buildCategoryFilter();
    await App.refresh();
    App.scheduleAutoRefresh();
  },

  async buildCategoryFilter() {
    const select = document.getElementById("category-filter");
    const categories = [...new Set(App.suppliers.map((s) => s.category))];
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  },

  getFilteredSuppliers() {
    const cat = document.getElementById("category-filter").value;
    if (!cat || cat === "all") return App.suppliers;
    return App.suppliers.filter((s) => s.category === cat);
  },

  async refresh(fetchMarketData = true) {
    document.getElementById("refresh-btn").disabled = true;
    document.getElementById("refresh-btn").textContent = "Refreshing...";

    if (fetchMarketData) {
      await Promise.all([FX.load(), Commodities.load(), Freight.load()]);
    }

    const filtered = App.getFilteredSuppliers();
    const scored = RiskEngine.scoreAll(filtered);
    Render.renderAll(filtered, scored);

    document.getElementById("refresh-btn").disabled = false;
    document.getElementById("refresh-btn").textContent = "Refresh now";
    App.resetCountdown();
  },

  scheduleAutoRefresh() {
    setInterval(() => App.refresh(), CONFIG.refreshIntervalMs);
  },

  resetCountdown() {
    App.countdownSeconds = CONFIG.refreshIntervalMs / 1000;
    clearInterval(App.countdownTimer);
    App.countdownTimer = setInterval(() => {
      App.countdownSeconds -= 1;
      const mins = Math.floor(App.countdownSeconds / 60);
      const secs = App.countdownSeconds % 60;
      const el = document.getElementById("next-refresh");
      if (el) el.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
      if (App.countdownSeconds <= 0) clearInterval(App.countdownTimer);
    }, 1000);
  }
};

document.addEventListener("DOMContentLoaded", App.init);
