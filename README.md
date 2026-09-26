# Supplier Risk and Spend Control Room

A real time procurement dashboard that scores supplier risk and flags spend
anomalies by combining currency exposure, commodity prices, and Suez / Red
Sea freight route risk with your own supplier and spend data. Built as a
portfolio project for procurement and supply chain roles, with a focus on
the Dubai and wider Gulf trade corridor.

No build step, no backend required to run it. Plain HTML, CSS and
JavaScript, deployable directly to GitHub Pages.

## What it actually does

- Pulls live currency exchange rates (AED, EUR, CNY, INR, GBP, KRW, SAR,
  TRY, PKR against USD) from the Frankfurter API, a free service backed by
  European Central Bank reference rates. This part is genuinely live, no
  API key needed.
- Runs a supplier risk scoring engine that combines five weighted factors:
  currency exposure, commodity exposure, freight route exposure, spend
  concentration within category, and delivery reliability.
- Detects spend anomalies with a rolling z-score against each supplier's
  own trailing spend history.
- Auto-refreshes on a timer, with a manual refresh button and a visible
  countdown.
- Everything is driven from `data/suppliers.json`. Replace the sample data
  with an export from your own P2P or ERP system (SAP Ariba, Oracle, Coupa,
  or a plain CSV converted to JSON) to run this against real spend.

### Being upfront about commodities and freight

There is no free, key-less, browser-callable API for live steel, aluminium,
oil, or freight index data. Every real provider (EIA, MetalpriceAPI,
Commodities-API, Freightos) requires a secret key, and a key placed in
client-side code on a static GitHub Pages site would be visible to anyone
who views the page source. That is a real security mistake, not a detail to
skip.

So by default, commodity and freight data run in a clearly labeled
simulation mode: prices start from realistic current levels and drift a
small, random amount on every refresh. The dashboard always shows a
"Simulated" or "Live" pill next to each panel so this is never hidden.

## Making commodities and freight fully live

To wire in a genuine live feed:

1. Sign up for a free tier key from a provider, for example
   [MetalpriceAPI](https://metalpriceapi.com) for steel and aluminium,
   [EIA](https://www.eia.gov/opendata/) for oil, or
   [Freightos](https://www.freightos.com/freight-index/) for a shipping
   rate index.
2. Deploy a small serverless function that holds the key server-side and
   forwards a clean JSON response. A Cloudflare Worker or a Vercel function
   both have generous free tiers and take about twenty lines of code.
3. Point `COMMODITY_LIVE_ENDPOINT` in `js/commodities.js` and
   `FREIGHT_LIVE_ENDPOINT` in `js/freight.js` at your function's URL.
4. Set `liveCommodityFeed` and `liveFreightFeed` to `true` in
   `js/config.js`.

The dashboard will use the live values whenever they load successfully, and
automatically fall back to simulation if the request fails, so it never
shows a broken panel.

## Running it locally

No dependencies to install. From the project folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Deploying to GitHub Pages

1. Create a new repository on GitHub and push this folder to it:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: supplier risk and spend dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

2. In the repository, go to **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a
   branch**, choose the **main** branch and the **/ (root)** folder, then
   save.
4. GitHub will publish the site at
   `https://YOUR-USERNAME.github.io/YOUR-REPO/` within a minute or two.

No other configuration is needed. The FX API call works from any domain,
including GitHub Pages, because Frankfurter allows cross-origin requests
from the browser.

## Adapting it to your own supplier data

Edit `data/suppliers.json`. Each supplier needs:

| Field | What it means |
|---|---|
| `currency` | The currency the supplier invoices in. Add it to `trackedCurrencies` in `config.js` if it is not already listed. |
| `commodity_exposure` | Roughly how much of the supplier's pricing tracks steel, aluminium and oil, each from 0 to 1. |
| `uses_suez_route` | Whether shipments from this supplier typically transit the Suez / Red Sea corridor. |
| `on_time_delivery_rate` | Historic on-time delivery rate, from 0 to 1. |
| `monthly_spend_usd` | An array of recent monthly spend figures, oldest first, in USD. |

## Project structure

```
index.html            Page layout
css/style.css          Visual design
js/config.js           Risk weights, thresholds, refresh timing
js/fx.js                Live currency exchange rate client
js/commodities.js       Commodity price feed (simulated by default)
js/freight.js           Freight and Suez route risk index (simulated by default)
js/risk-engine.js       Supplier risk scoring and spend anomaly detection
js/render.js            DOM and chart rendering
js/app.js               App start-up and refresh cycle
data/suppliers.json     Sample supplier and spend data
```

## Why this project

Built to demonstrate the kind of procurement analytics that trading,
logistics and contracting companies in the UAE actively look for: reading
currency and commodity volatility as cost risk, understanding route
dependency through the Suez corridor, and using basic statistics to catch
spend anomalies before they show up in a monthly report.
