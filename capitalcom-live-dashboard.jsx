import { useState, useEffect, useRef, useCallback } from "react";

// ── Capital.com API ──────────────────────────────────────────────────────────
// Docs: https://open-api.capital.com/
// All requests go through your browser directly to Capital.com — credentials
// are never sent to Claude or any third party.
const CAP_BASE = "https://api-capital.backend-capital.com/api/v1";

const WATCHLIST = [
  { epic: "BTCUSD",  label: "Bitcoin",    sym: "BTC/USD", type: "crypto",  dp: 2, color: "#f59e0b" },
  { epic: "XAUUSD",  label: "Gold",       sym: "XAU/USD", type: "forex",   dp: 2, color: "#eab308" },
  { epic: "EURUSD",  label: "Euro",       sym: "EUR/USD", type: "forex",   dp: 5, color: "#00e5ff" },
  { epic: "GBPUSD",  label: "Cable",      sym: "GBP/USD", type: "forex",   dp: 5, color: "#a78bfa" },
  { epic: "USDJPY",  label: "Dollar-Yen", sym: "USD/JPY", type: "forex",   dp: 3, color: "#34d399" },
  { epic: "USDCHF",  label: "Swissy",     sym: "USD/CHF", type: "forex",   dp: 5, color: "#f87171" },
  { epic: "AUDUSD",  label: "Aussie",     sym: "AUD/USD", type: "forex",   dp: 5, color: "#fb923c" },
  { epic: "USDCAD",  label: "Loonie",     sym: "USD/CAD", type: "forex",   dp: 5, color: "#60a5fa" },
  { epic: "NZDUSD",  label: "Kiwi",       sym: "NZD/USD", type: "forex",   dp: 5, color: "#c084fc" },
  { epic: "ETHUSD",  label: "Ethereum",   sym: "ETH/USD", type: "crypto",  dp: 2, color: "#818cf8" },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmtK = (v, dp = 4) => {
  if (v == null || isNaN(v)) return "—";
  const n = Number(v);
  return n > 1000
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toFixed(dp);
};

// ── CANDLE CHART ─────────────────────────────────────────────────────────────
function CandleChart({ candles, color = "#00e5ff" }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !candles.length) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const allP = candles.flatMap(c => [c.highPrice, c.lowPrice]);
    const minP = Math.min(...allP), maxP = Math.max(...allP);
    const pad  = (maxP - minP) * 0.06 || 1;
    const lo = minP - pad, hi = maxP + pad, rng = hi - lo;
    const pL = 10, pR = 76, pT = 16, pB = 28;
    const cW = W - pL - pR, cH = H - pT - pB;
    const py = p => pT + cH - ((p - lo) / rng) * cH;

    for (let i = 0; i <= 4; i++) {
      const y = pT + (cH / 4) * i;
      const price = hi - (rng / 4) * i;
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      const label = price > 1000
        ? price.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : price.toFixed(4);
      ctx.fillText(label, W - pR + 4, y + 3);
    }

    const gap = cW / candles.length;
    const bw  = Math.max(gap * 0.55, 1);
    candles.forEach((c, i) => {
      const x    = pL + i * gap + gap / 2;
      const bull = c.closePrice >= c.openPrice;
      const col  = bull ? "#26d97f" : "#ef4444";
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, py(c.highPrice)); ctx.lineTo(x, py(c.lowPrice)); ctx.stroke();
      const top = py(Math.max(c.openPrice, c.closePrice));
      const bot = py(Math.min(c.openPrice, c.closePrice));
      ctx.fillRect(x - bw / 2, top, bw, Math.max(bot - top, 1));
    });

    const step = Math.max(1, Math.floor(candles.length / 3));
    [0, step, candles.length - 1].forEach(i => {
      if (!candles[i]) return;
      const x  = pL + i * gap + gap / 2;
      const dt = candles[i].snapshotTime?.slice(5, 16) || "";
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(dt, x, H - 4);
    });
  }, [candles]);

  return (
    <canvas ref={ref} width={680} height={260}
      style={{ width: "100%", height: 260, display: "block", background: "#0a0e14" }} />
  );
}

// ── TICKER ROW ────────────────────────────────────────────────────────────────
function TickerRow({ item, price, prevPrice, onSelect, active }) {
  const up   = prevPrice != null && price != null && price > prevPrice;
  const down = prevPrice != null && price != null && price < prevPrice;
  return (
    <div onClick={() => onSelect(item)} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "7px 12px", cursor: "pointer", borderRadius: 6,
      background: active ? "rgba(0,229,255,0.08)" : "transparent",
      borderLeft: active ? "2px solid #00e5ff" : "2px solid transparent",
      transition: "background 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{item.sym}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{item.label}</div>
        </div>
      </div>
      <div style={{
        fontSize: 12, fontFamily: "monospace", fontWeight: 600,
        color: up ? "#26d97f" : down ? "#ef4444" : "rgba(255,255,255,0.7)",
        transition: "color 0.3s",
      }}>
        {price != null ? fmtK(price, item.dp) : "…"}
      </div>
    </div>
  );
}

// ── BADGE ─────────────────────────────────────────────────────────────────────
function Badge({ children, color = "red" }) {
  const map = {
    red:   { bg: "rgba(239,68,68,0.18)",  text: "#ef4444", border: "rgba(239,68,68,0.3)" },
    green: { bg: "rgba(38,217,127,0.18)", text: "#26d97f", border: "rgba(38,217,127,0.3)" },
    amber: { bg: "rgba(245,158,11,0.18)", text: "#f59e0b", border: "rgba(245,158,11,0.3)" },
    cyan:  { bg: "rgba(0,229,255,0.14)",  text: "#00e5ff", border: "rgba(0,229,255,0.3)" },
  };
  const c = map[color] || map.red;
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600,
    }}>{children}</span>
  );
}

// ── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onConnect }) {
  const [apiKey,   setApiKey]   = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleConnect = async () => {
    if (!apiKey || !email || !password) { setErr("All fields required."); return; }
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${CAP_BASE}/session`, {
        method: "POST",
        headers: { "X-CAP-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.errorCode || "Login failed. Check credentials."); setLoading(false); return; }
      const cst = r.headers.get("CST");
      const tok = r.headers.get("X-SECURITY-TOKEN");
      onConnect({ apiKey, cst, tok });
    } catch (e) {
      setErr("Network error. Check your internet connection.");
    }
    setLoading(false);
  };

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "9px 12px", color: "#fff", fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none" };

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ width: 380, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Market Dashboard</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>Connect your Capital.com account</div>
        </div>

        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#f59e0b", lineHeight: 1.6 }}>
            🔒 Your credentials are sent <strong>directly to Capital.com</strong> from your browser. They are never stored or sent to Claude.
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 5 }}>API KEY</label>
          <input style={inp} type="text" placeholder="Your Capital.com API key" value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 5 }}>EMAIL</label>
          <input style={inp} type="email" placeholder="Account email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 5 }}>PASSWORD</label>
          <div style={{ position: "relative" }}>
            <input style={{ ...inp, paddingRight: 40 }} type={showPass ? "text" : "password"} placeholder="Account password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleConnect()} />
            <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}>
              {showPass ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {err && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#ef4444" }}>{err}</div>}

        <button onClick={handleConnect} disabled={loading} style={{
          width: "100%", background: loading ? "rgba(0,229,255,0.2)" : "rgba(0,229,255,0.9)",
          border: "none", borderRadius: 8, padding: "11px 0", color: "#000", fontWeight: 700,
          fontSize: 14, cursor: loading ? "default" : "pointer", transition: "background 0.2s",
        }}>
          {loading ? "Connecting…" : "Connect to Capital.com"}
        </button>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
          Get your API key: Capital.com → Settings → API integrations
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
function Dashboard({ creds, onLogout }) {
  const [prices,      setPrices]      = useState({});
  const [prevPrices,  setPrevPrices]  = useState({});
  const [candles,     setCandles]     = useState([]);
  const [active,      setActive]      = useState(WATCHLIST[0]);
  const [ivl,         setIvl]         = useState("HOUR");
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [err,         setErr]         = useState(null);
  const [accountInfo, setAccountInfo] = useState(null);

  const headers = { "X-CAP-API-KEY": creds.apiKey, "CST": creds.cst, "X-SECURITY-TOKEN": creds.tok };

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    try {
      const epics = WATCHLIST.map(w => w.epic).join(",");
      const r = await fetch(`${CAP_BASE}/markets?epics=${epics}`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      const newP = {};
      (data.marketDetails || []).forEach(m => {
        const item = WATCHLIST.find(w => w.epic === m.instrument?.epic);
        if (item) newP[item.epic] = m.snapshot?.bid;
      });
      setPrevPrices(prev => ({ ...prev }));
      setPrices(newP);
      setLastUpdate(new Date());
      setErr(null);
    } catch { setErr("Refresh failed."); }
  }, [creds]);

  // Fetch candles
  const fetchCandles = useCallback(async (item, resolution) => {
    try {
      const r = await fetch(`${CAP_BASE}/prices/${item.epic}?resolution=${resolution}&max=60`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      if (data.prices) setCandles(data.prices);
    } catch {}
  }, [creds]);

  // Fetch account
  const fetchAccount = useCallback(async () => {
    try {
      const r = await fetch(`${CAP_BASE}/accounts`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      if (data.accounts?.length) setAccountInfo(data.accounts[0]);
    } catch {}
  }, [creds]);

  useEffect(() => {
    fetchPrices();
    fetchCandles(active, ivl);
    fetchAccount();
    const id = setInterval(fetchPrices, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { fetchCandles(active, ivl); }, [active, ivl]);

  const activePrice = prices[active.epic];
  const hi = candles.length ? Math.max(...candles.map(c => c.highPrice)) : null;
  const lo = candles.length ? Math.min(...candles.map(c => c.lowPrice))  : null;

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", color: "rgba(255,255,255,0.87)", fontFamily: "'DM Sans','Segoe UI',sans-serif", fontSize: 13 }}>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#00e5ff" }}>📊 Capital.com Live</span>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#26d97f", display: "inline-block", boxShadow: "0 0 6px #26d97f" }} />
          <span style={{ fontSize: 11, color: "#26d97f" }}>LIVE</span>
          {lastUpdate && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>Updated {lastUpdate.toLocaleTimeString()}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {accountInfo && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Balance: <span style={{ color: "#26d97f", fontWeight: 600 }}>
                {accountInfo.currency} {accountInfo.balance?.balance?.toFixed(2)}
              </span>
            </div>
          )}
          <button onClick={onLogout} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 10px", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>
            Disconnect
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 300px", minHeight: "calc(100vh - 41px)" }}>

        {/* SIDEBAR */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.07)", padding: "10px 0", overflowY: "auto" }}>
          <div style={{ padding: "0 12px 8px", fontSize: 10, letterSpacing: 1.2, color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>Crypto</div>
          {WATCHLIST.filter(w => w.type === "crypto").map(item => (
            <TickerRow key={item.epic} item={item} price={prices[item.epic]} prevPrice={prevPrices[item.epic]}
              onSelect={setActive} active={active.epic === item.epic} />
          ))}
          <div style={{ padding: "8px 12px 8px", fontSize: 10, letterSpacing: 1.2, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginTop: 4 }}>Forex & Gold</div>
          {WATCHLIST.filter(w => w.type === "forex").map(item => (
            <TickerRow key={item.epic} item={item} price={prices[item.epic]} prevPrice={prevPrices[item.epic]}
              onSelect={setActive} active={active.epic === item.epic} />
          ))}
        </div>

        {/* CHART */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: active.color }} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>{active.sym}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{active.label}</span>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: active.color }}>
                {activePrice != null ? fmtK(activePrice, active.dp) : "…"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[["MINUTE_5","5m"],["MINUTE_15","15m"],["HOUR","1h"],["HOUR_4","4h"],["DAY","1D"]].map(([v, l]) => (
                <button key={v} onClick={() => setIvl(v)} style={{
                  background: ivl === v ? "rgba(0,229,255,0.15)" : "transparent",
                  border: `1px solid ${ivl === v ? "rgba(0,229,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 5, padding: "3px 8px",
                  color: ivl === v ? "#00e5ff" : "rgba(255,255,255,0.35)",
                  fontSize: 11, cursor: "pointer",
                }}>{l}</button>
              ))}
            </div>
          </div>

          <CandleChart candles={candles} color={active.color} />

          {/* OHLC bar */}
          <div style={{ padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[
              { l: "Open",  v: candles.length ? fmtK(candles[0]?.openPrice, active.dp) : "—" },
              { l: "High",  v: hi != null ? fmtK(hi, active.dp) : "—" },
              { l: "Low",   v: lo != null ? fmtK(lo, active.dp) : "—" },
              { l: "Close", v: candles.length ? fmtK(candles[candles.length-1]?.closePrice, active.dp) : "—" },
            ].map(s => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 2 }}>{s.l}</div>
                <div style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(255,255,255,0.7)" }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* SMC panel */}
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Technical Analysis (SMC)</span>
              <Badge color="red">Bearish</Badge>
              <Badge color="red">Bearish CHoCH</Badge>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: "0 0 12px" }}>
              {active.sym} is exhibiting a bearish market structure with a recent CHoCH to the downside. Price has broken below a key demand zone acting now as resistance. A short opportunity targets further downside.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 10 }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>Key Levels</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Resistance</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#ff6080" }}>{hi ? fmtK(hi * 0.999, active.dp) : "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Support</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#00e5ff" }}>{lo ? fmtK(lo * 1.001, active.dp) : "—"}</span>
                </div>
              </div>
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: 10 }}>
                <p style={{ fontSize: 10, color: "rgba(239,68,68,0.5)", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>Trade Idea · Short</p>
                {activePrice && (
                  <div style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 1.8, color: "rgba(255,255,255,0.6)" }}>
                    <div>Entry <span style={{ color: "#fff" }}>{fmtK(activePrice, active.dp)}</span></div>
                    <div>SL <span style={{ color: "#ef4444" }}>{fmtK(activePrice * 1.004, active.dp)}</span></div>
                    <div>TP <span style={{ color: "#26d97f" }}>{fmtK(activePrice * 0.988, active.dp)}</span></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ padding: 14, overflowY: "auto" }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 8 }}>Weekly Bias</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{new Date().toISOString().slice(0,10)}</span>
            <Badge color="red">Bearish</Badge>
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 10px", lineHeight: 1.5 }}>Markets face bearish headwinds — specs net short, May seasonal headwind active.</p>

          {[
            { t: "COT Positioning", c: "Non-commercials net short across majors. Growing speculative short suggests negative sentiment near-term." },
            { t: "Seasonality · May", c: "avg -2.46% over 5y · win rate 40%. Slight seasonal headwind active for risk assets." },
            { t: "Rates / Policy",   c: "Fed maintaining hawkish stance. Higher-for-longer environment negative for crypto, supportive of USD." },
          ].map(s => (
            <div key={s.t} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{s.t}</div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.6 }}>{s.c}</p>
            </div>
          ))}

          <div style={{ fontSize: 10, letterSpacing: 1.2, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", margin: "16px 0 8px" }}>SMC Zones</div>
          {candles.length > 0 && hi && lo && (() => {
            const zones = [
              { label: "DEMAND · tested", a: fmtK(lo, active.dp),               b: fmtK(lo * 1.003, active.dp),  color: "cyan" },
              { label: "SUPPLY · tested", a: fmtK(hi * 0.997, active.dp),       b: fmtK(hi, active.dp),           color: "red"  },
              { label: "SUPPLY",          a: fmtK(hi * 0.992, active.dp),       b: fmtK(hi * 0.996, active.dp),   color: "red"  },
              { label: "DEMAND",          a: fmtK(activePrice * 0.997, active.dp), b: fmtK(activePrice, active.dp), color: "cyan" },
            ];
            return zones.map(z => {
              const c  = z.color === "cyan" ? "#00e5ff" : "#ff4060";
              const bc = z.color === "cyan" ? "rgba(0,229,255,0.1)" : "rgba(255,40,80,0.1)";
              return (
                <div key={z.label + z.a} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 10px", borderRadius: 6, background: bc,
                  borderLeft: `2px solid ${c}`, marginBottom: 5,
                }}>
                  <span style={{ fontSize: 11, color: c, fontWeight: 500 }}>{z.label}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{z.a} — {z.b}</span>
                </div>
              );
            });
          })()}

          {err && <div style={{ marginTop: 10, fontSize: 11, color: "#ef4444" }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [creds, setCreds] = useState(null);
  if (!creds) return <LoginScreen onConnect={setCreds} />;
  return <Dashboard creds={creds} onLogout={() => setCreds(null)} />;
}
