const Render = {
  charts: {},

  fmtUsd(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  },

  fmtPct(n) {
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
  },

  statusPill(status) {
    const map = {
      live: { text: "Live", tone: "low" },
      stale: { text: "Stale, retrying", tone: "medium" },
      error: { text: "Feed error", tone: "critical" },
      simulated: { text: "Simulated", tone: "medium" }
    };
    return map[status] || { text: status, tone: "medium" };
  },

  setPill(el, status) {
    const info = Render.statusPill(status);
    el.textContent = info.text;
    el.className = `pill tone-${info.tone}`;
  },

  renderTimestamp() {
    const el = document.getElementById("last-updated");
    const now = new Date();
    el.textContent = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  },

  renderKpis(suppliers, scored) {
    document.getElementById("kpi-total-spend").textContent = Render.fmtUsd(RiskEngine.totalSpend(suppliers));
    document.getElementById("kpi-supplier-count").textContent = suppliers.length;

    const highRisk = scored.filter((s) => s.risk.band.tone === "high" || s.risk.band.tone === "critical");
    document.getElementById("kpi-high-risk-count").textContent = highRisk.length;

    const avg = scored.reduce((sum, s) => sum + s.risk.total, 0) / scored.length;
    document.getElementById("kpi-avg-risk").textContent = Math.round(avg);

    const anomalies = RiskEngine.allAnomalies(suppliers);
    document.getElementById("kpi-anomaly-count").textContent = anomalies.length;
  },

  renderFxPanel() {
    Render.setPill(document.getElementById("fx-status"), FX.status);
    document.getElementById("fx-asof").textContent = FX.asOf ? `ECB reference date ${FX.asOf}` : "";

    const tbody = document.getElementById("fx-table-body");
    tbody.innerHTML = "";
    CONFIG.trackedCurrencies.forEach((code) => {
      const rate = FX.latest ? FX.latest[code] : null;
      const change = FX.weeklyChangePct(code);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${code}</td>
        <td class="num">${rate ? rate.toFixed(4) : "—"}</td>
        <td class="num ${change >= 0 ? "neg" : "pos"}">${rate ? Render.fmtPct(change) : "—"}</td>
      `;
      tbody.appendChild(row);
    });
  },

  renderCommodityPanel() {
    Render.setPill(document.getElementById("commodity-status"), Commodities.status);
    const rows = [
      { key: "steel", label: "Steel" },
      { key: "aluminum", label: "Aluminium" },
      { key: "oil", label: "Brent crude oil" }
    ];
    const tbody = document.getElementById("commodity-table-body");
    tbody.innerHTML = "";
    rows.forEach(({ key, label }) => {
      const price = Commodities.latest(key);
      const change = Commodities.changePct(key);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${label}</td>
        <td class="num">${price.toFixed(2)}</td>
        <td class="num ${change >= 0 ? "neg" : "pos"}">${Render.fmtPct(change)}</td>
      `;
      tbody.appendChild(row);
    });
  },

  renderFreightPanel() {
    Render.setPill(document.getElementById("freight-status"), Freight.status);
    const band = Freight.band();
    const valueEl = document.getElementById("freight-index-value");
    valueEl.textContent = Freight.latest().toFixed(0);
    const labelEl = document.getElementById("freight-index-label");
    labelEl.textContent = band.label;
    labelEl.className = `tag tone-${band.tone}`;
  },

  renderSupplierTable(scored, sortKey = "risk") {
    const tbody = document.getElementById("supplier-table-body");
    tbody.innerHTML = "";

    const sorted = [...scored].sort((a, b) => {
      if (sortKey === "risk") return b.risk.total - a.risk.total;
      if (sortKey === "spend") return RiskEngine.currentSpend(b.supplier) - RiskEngine.currentSpend(a.supplier);
      if (sortKey === "name") return a.supplier.name.localeCompare(b.supplier.name);
      return 0;
    });

    sorted.forEach(({ supplier, risk }) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="supplier-name">${supplier.name}</div>
          <div class="supplier-meta">${supplier.category} — ${supplier.country}</div>
        </td>
        <td class="num">${Render.fmtUsd(RiskEngine.currentSpend(supplier))}</td>
        <td class="num">${supplier.currency}</td>
        <td class="num">${(supplier.on_time_delivery_rate * 100).toFixed(0)}%</td>
        <td><span class="tag tone-${risk.band.tone}">${risk.band.label}</span></td>
        <td class="num">${risk.total}</td>
      `;
      tbody.appendChild(row);
    });
  },

  renderAnomalies(suppliers) {
    const list = document.getElementById("anomaly-list");
    list.innerHTML = "";
    const anomalies = RiskEngine.allAnomalies(suppliers);

    if (anomalies.length === 0) {
      list.innerHTML = `<li class="empty">No spend anomalies detected against the last five months of history.</li>`;
      return;
    }

    anomalies.forEach(({ supplier, anomaly }) => {
      const direction = anomaly.zScore > 0 ? "above" : "below";
      const item = document.createElement("li");
      item.innerHTML = `
        <span class="tag tone-${Math.abs(anomaly.zScore) >= 3 ? "critical" : "high"}">z ${anomaly.zScore}</span>
        <span><strong>${supplier.name}</strong> spent ${Render.fmtUsd(anomaly.latest)} this month,
        ${direction} its five-month average of ${Render.fmtUsd(anomaly.mean)}.</span>
      `;
      list.appendChild(item);
    });
  },

  renderAlerts(suppliers, scored) {
    const list = document.getElementById("alert-list");
    list.innerHTML = "";
    const alerts = [];

    CONFIG.trackedCurrencies.forEach((code) => {
      const change = FX.weeklyChangePct(code);
      if (Math.abs(change) >= 2) {
        alerts.push({
          tone: Math.abs(change) >= 4 ? "critical" : "high",
          text: `${code} moved ${Render.fmtPct(change)} against ${CONFIG.baseCurrency} in the last week.`
        });
      }
    });

    ["steel", "aluminum", "oil"].forEach((key) => {
      const change = Commodities.changePct(key);
      if (Math.abs(change) >= 3) {
        alerts.push({
          tone: Math.abs(change) >= 6 ? "critical" : "high",
          text: `${key.charAt(0).toUpperCase() + key.slice(1)} price moved ${Render.fmtPct(change)} over the recent period.`
        });
      }
    });

    const freightBand = Freight.band();
    if (freightBand.tone === "high" || freightBand.tone === "critical") {
      alerts.push({
        tone: freightBand.tone,
        text: `Suez / Red Sea route risk index is ${freightBand.label.toLowerCase()} at ${Freight.latest().toFixed(0)}/100.`
      });
    }

    const critical = scored.filter((s) => s.risk.band.tone === "critical");
    if (critical.length > 0) {
      alerts.push({
        tone: "critical",
        text: `${critical.length} supplier(s) now scoring in the critical risk band: ${critical
          .map((s) => s.supplier.name)
          .join(", ")}.`
      });
    }

    if (alerts.length === 0) {
      list.innerHTML = `<li class="empty">No threshold breaches this cycle. All tracked signals are within normal range.</li>`;
      return;
    }

    alerts.forEach((a) => {
      const item = document.createElement("li");
      item.innerHTML = `<span class="tag tone-${a.tone}">alert</span><span>${a.text}</span>`;
      list.appendChild(item);
    });
  },

  buildOrUpdateLineChart(id, labels, datasets, yLabel) {
    const ctx = document.getElementById(id).getContext("2d");
    if (Render.charts[id]) {
      Render.charts[id].data.labels = labels;
      Render.charts[id].data.datasets.forEach((ds, i) => (ds.data = datasets[i].data));
      Render.charts[id].update();
      return;
    }
    Render.charts[id] = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#c7cdd6", boxWidth: 12 } } },
        scales: {
          x: { ticks: { color: "#7d8896" }, grid: { color: "rgba(124,138,158,0.12)" } },
          y: {
            ticks: { color: "#7d8896" },
            grid: { color: "rgba(124,138,158,0.12)" },
            title: { display: !!yLabel, text: yLabel, color: "#7d8896" }
          }
        }
      }
    });
  },

  buildOrUpdateBarChart(id, labels, data, colors) {
    const ctx = document.getElementById(id).getContext("2d");
    if (Render.charts[id]) {
      Render.charts[id].data.labels = labels;
      Render.charts[id].data.datasets[0].data = data;
      Render.charts[id].data.datasets[0].backgroundColor = colors;
      Render.charts[id].update();
      return;
    }
    Render.charts[id] = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 3 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#7d8896" }, grid: { display: false } },
          y: { ticks: { color: "#7d8896" }, grid: { color: "rgba(124,138,158,0.12)" } }
        }
      }
    });
  },

  renderCharts(suppliers, scored) {
    Render.buildOrUpdateLineChart(
      "commodity-chart",
      Commodities.series.steel.history.map((_, i) => i + 1),
      [
        { label: "Steel", data: Commodities.series.steel.history, borderColor: "#c98a3b", backgroundColor: "transparent", tension: 0.3 },
        { label: "Aluminium", data: Commodities.series.aluminum.history, borderColor: "#2b8c82", backgroundColor: "transparent", tension: 0.3 },
        { label: "Oil (Brent)", data: Commodities.series.oil.history, borderColor: "#c1443c", backgroundColor: "transparent", tension: 0.3 }
      ],
      "Index value"
    );

    Render.buildOrUpdateLineChart(
      "freight-chart",
      Freight.history.map((_, i) => i + 1),
      [{ label: "Suez / Red Sea risk index", data: Freight.history, borderColor: "#c1443c", backgroundColor: "rgba(193,68,60,0.12)", fill: true, tension: 0.3 }],
      "Risk index (0-100)"
    );

    const toneColor = { low: "#2b8c82", medium: "#c98a3b", high: "#e08a3c", critical: "#c1443c" };
    const sortedByRisk = [...scored].sort((a, b) => b.risk.total - a.risk.total).slice(0, 8);
    Render.buildOrUpdateBarChart(
      "risk-chart",
      sortedByRisk.map((s) => s.supplier.name.split(" ").slice(0, 2).join(" ")),
      sortedByRisk.map((s) => s.risk.total),
      sortedByRisk.map((s) => toneColor[s.risk.band.tone])
    );

    const categories = [...new Set(suppliers.map((s) => s.category))];
    const spendByCategory = categories.map((cat) =>
      suppliers.filter((s) => s.category === cat).reduce((sum, s) => sum + RiskEngine.currentSpend(s), 0)
    );
    Render.buildOrUpdateBarChart(
      "spend-chart",
      categories,
      spendByCategory,
      categories.map(() => "#2b8c82")
    );
  },

  renderAll(suppliers, scored) {
    Render.renderTimestamp();
    Render.renderKpis(suppliers, scored);
    Render.renderFxPanel();
    Render.renderCommodityPanel();
    Render.renderFreightPanel();
    Render.renderSupplierTable(scored, document.getElementById("sort-select").value);
    Render.renderAnomalies(suppliers);
    Render.renderAlerts(suppliers, scored);
    Render.renderCharts(suppliers, scored);
  }
};
