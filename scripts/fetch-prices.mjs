// Fetches Vietnamese stock prices and writes data/prices.json for the app.
// Intraday prices for tickers in data/tickers.json come from the VPS price board;
// the latest daily close for the whole market comes from VNDirect as a fallback.
// Run by .github/workflows/update-prices.yml; Node 20+, no dependencies.
import { readFile, writeFile } from "node:fs/promises";

const UA = { "User-Agent": "Mozilla/5.0 (mentor-dau-tu price bot)", Accept: "application/json" };
const nowIso = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace(" ", "T") + "+07:00";
const vnDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
// Boards quote in thousand VND (34.15); the app stores VND per share (34150).
const toVnd = v => { const x = Number(v); if (!Number.isFinite(x) || x <= 0) return null; return Math.round(x < 1000 ? x * 1000 : x); };

async function getJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function fromVps(tickers) {
  const rows = await getJson(`https://bgapidatafeed.vps.com.vn/getliststockdata/${tickers.join(",")}`);
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = String(row.sym || "").toUpperCase();
    const price = toVnd(row.lastPrice) ?? toVnd(row.r); // last matched, else reference price
    if (code && price) out[code] = { price, at: nowIso(), src: "VPS" };
  }
  return out;
}

async function fromVndirect() {
  const since = vnDate(new Date(Date.now() - 10 * 86400000));
  const d = await getJson(`https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=date:gte:${since}&size=20000&page=1`);
  const out = {};
  for (const row of d.data || []) {
    const code = String(row.code || "").toUpperCase();
    if (!code || out[code]) continue; // rows are newest first
    const price = toVnd(row.close);
    // today's row may be mid-session, so let intraday quotes from VPS win over it
    if (price) out[code] = { price, at: `${row.date}T${row.date < vnDate() ? "15:00" : "09:00"}:00+07:00`, src: "VNDirect" };
  }
  return out;
}

async function fromTcbs(ticker) {
  const to = Math.floor(Date.now() / 1000);
  const d = await getJson(`https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/bars-long-term?ticker=${ticker}&type=stock&resolution=D&countBack=5&to=${to}`);
  const last = (d.data || []).at(-1);
  const price = last && toVnd(last.close);
  return price ? { price, at: `${String(last.tradingDate).slice(0, 10)}T15:00:00+07:00`, src: "TCBS" } : null;
}

const tickers = JSON.parse(await readFile("data/tickers.json", "utf8")).map(t => String(t).toUpperCase());
let old = { prices: {} };
try { old = JSON.parse(await readFile("data/prices.json", "utf8")); } catch {}

const prices = { ...old.prices };
const used = new Set(), errors = [];
const merge = (src, label) => {
  for (const [code, q] of Object.entries(src)) {
    const prev = prices[code];
    if (prev && prev.at > q.at) continue; // never replace a newer quote with an older one
    prices[code] = q; used.add(label);
  }
};

try { merge(await fromVndirect(), "VNDirect"); } catch (e) { errors.push("VNDirect: " + e.message); }
try { merge(await fromVps(tickers), "VPS"); } catch (e) { errors.push("VPS: " + e.message); }
for (const t of tickers) {
  if (prices[t]?.at?.startsWith(vnDate())) continue;
  try { const q = await fromTcbs(t); if (q) merge({ [t]: q }, "TCBS"); } catch (e) { errors.push(`TCBS ${t}: ` + e.message); }
}

if (!used.size) {
  console.error("No price source answered:\n" + errors.join("\n"));
  process.exit(1);
}
const out = { updatedAt: nowIso(), source: [...used].join(", "), prices };
await writeFile("data/prices.json", JSON.stringify(out) + "\n");
console.log(`Wrote ${Object.keys(prices).length} prices from ${out.source}.`, tickers.map(t => `${t}=${prices[t]?.price ?? "?"}`).join(" "));
if (errors.length) console.log("Warnings:\n" + errors.join("\n"));
