import { useState, useCallback } from 'react';
import './App.css';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Link2, PenLine, DollarSign, Search, ExternalLink, BarChart3, Tag, Globe, TrendingDown, TrendingUp, BadgePercent, AlertTriangle, CheckCircle2, X, Package, Store, Sparkles } from 'lucide-react';

const MOCK_MODE = !import.meta.env.VITE_CONTRACT_ADDRESS;

const DEMO_CHECKS = [
  {
    id: 0, url: "https://amazon.com/dp/B0BSHF7WHW",
    category: "electronics", submitter: "0x742d...3ac1",
    verdict: "FAIR_PRICE", product_name: "Sony WH-1000XM5 Wireless Headphones",
    listed_price: "$348.00", estimated_fair_price: "$349.99",
    savings_percent: 1,
    reasoning: "The Sony WH-1000XM5 is listed at $348.00, which is within 1% of the standard MSRP of $349.99. This is the typical retail price across major retailers including Best Buy, Amazon, and B&H Photo.",
    price_factors: ["msrp match", "established retailer", "standard pricing"],
  },
  {
    id: 1, url: "https://aliexpress.com/item/12345.html",
    category: "electronics", submitter: "0x8fa3...92b7",
    verdict: "SCAM_ALERT", product_name: "Apple AirPods Pro 2nd Gen",
    listed_price: "$29.99", estimated_fair_price: "$249.00",
    savings_percent: -88,
    reasoning: "This listing claims to sell genuine AirPods Pro 2 for $29.99, which is 88% below the MSRP of $249. This price is impossibly low for authentic Apple products and strongly indicates counterfeit goods or a bait-and-switch scam.",
    price_factors: ["price too low", "counterfeit risk", "no apple authorization", "seller unverified"],
  },
  {
    id: 2, url: "https://bestbuy.com/site/samsung-tv",
    category: "electronics", submitter: "0x3b1e...f8d2",
    verdict: "GREAT_DEAL", product_name: "Samsung 65\" OLED 4K Smart TV (2024)",
    listed_price: "$1,299.99", estimated_fair_price: "$1,799.99",
    savings_percent: 28,
    reasoning: "Samsung's 65\" OLED is listed at $1,299.99 during a seasonal sale. The standard retail price is $1,799.99, making this a genuine 28% discount. Best Buy is an authorized Samsung retailer.",
    price_factors: ["seasonal sale", "authorized dealer", "verified discount"],
  },
  {
    id: 3, url: "https://shopify-store.com/product/jacket",
    category: "clothing", submitter: "0xd91f...45ca",
    verdict: "OVERPRICED", product_name: "Generic Waterproof Rain Jacket - Unbranded",
    listed_price: "$189.00", estimated_fair_price: "$45.00",
    savings_percent: -320,
    reasoning: "This unbranded waterproof rain jacket is listed at $189, but similar generic jackets with the same materials and specifications are widely available for $35-55 on major platforms. The markup is approximately 320% above fair market value.",
    price_factors: ["extreme markup", "unbranded product", "no unique features", "generic materials"],
  },
];

function App() {
  const [activeTab, setActiveTab] = useState('url');
  const [productUrl, setProductUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [listedPrice, setListedPrice] = useState('');
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState('electronics');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checks, setChecks] = useState(DEMO_CHECKS);
  const [resultModal, setResultModal] = useState(null);
  const [stats, setStats] = useState({
    total_checks: 4, total_great_deals: 1,
    total_fair: 1, total_overpriced: 1, total_scams: 1,
  });

  const handleCheckUrl = useCallback(async () => {
    if (!productUrl) return;
    setIsProcessing(true);
    try {
      if (MOCK_MODE) {
        await new Promise(r => setTimeout(r, 3500));
        const verdicts = ["GREAT_DEAL", "FAIR_PRICE", "OVERPRICED", "SCAM_ALERT"];
        const v = verdicts[Math.floor(Math.random() * verdicts.length)];
        const mock = {
          id: checks.length, url: productUrl, category,
          submitter: "0x" + Math.random().toString(16).slice(2, 6) + "..." + Math.random().toString(16).slice(2, 6),
          verdict: v,
          product_name: "Product from " + new URL(productUrl).hostname,
          listed_price: "$" + (Math.floor(Math.random() * 500) + 10) + ".99",
          estimated_fair_price: "$" + (Math.floor(Math.random() * 500) + 10) + ".99",
          savings_percent: v === "GREAT_DEAL" ? Math.floor(Math.random() * 30) + 15 : v === "OVERPRICED" ? -(Math.floor(Math.random() * 100) + 20) : v === "SCAM_ALERT" ? -(Math.floor(Math.random() * 50) + 70) : Math.floor(Math.random() * 10),
          reasoning: "AI validators scraped the product page, identified the item and price, and compared it against known market data from multiple retailers.",
          price_factors: v === "SCAM_ALERT" ? ["price too low", "unverified seller"] : v === "GREAT_DEAL" ? ["seasonal sale", "authorized dealer"] : ["standard pricing"],
        };
        setChecks(prev => [mock, ...prev]);
        setStats(prev => ({ ...prev, total_checks: prev.total_checks + 1, [`total_${v === "GREAT_DEAL" ? "great_deals" : v === "FAIR_PRICE" ? "fair" : v === "OVERPRICED" ? "overpriced" : "scams"}`]: prev[`total_${v === "GREAT_DEAL" ? "great_deals" : v === "FAIR_PRICE" ? "fair" : v === "OVERPRICED" ? "overpriced" : "scams"}`] + 1 }));
        setResultModal(mock);
      } else {
        const { callContractWrite, waitForTransaction } = await import('./lib/genlayer.js');
        const hash = await callContractWrite('check_price', [productUrl, category]);
        const receipt = await waitForTransaction(hash);
        setResultModal(receipt.result || receipt);
      }
    } catch (err) { alert("Check failed: " + err.message); }
    finally { setIsProcessing(false); setProductUrl(''); }
  }, [productUrl, category, checks.length]);

  const handleCheckManual = useCallback(async () => {
    if (!productName || !listedPrice) return;
    setIsProcessing(true);
    try {
      if (MOCK_MODE) {
        await new Promise(r => setTimeout(r, 3500));
        const verdicts = ["GREAT_DEAL", "FAIR_PRICE", "OVERPRICED", "SCAM_ALERT"];
        const v = verdicts[Math.floor(Math.random() * verdicts.length)];
        const mock = {
          id: checks.length, url: "", category,
          submitter: "0x" + Math.random().toString(16).slice(2, 6) + "..." + Math.random().toString(16).slice(2, 6),
          verdict: v, product_name: productName,
          listed_price: listedPrice,
          estimated_fair_price: "$" + (Math.floor(Math.random() * 500) + 10) + ".99",
          savings_percent: v === "GREAT_DEAL" ? Math.floor(Math.random() * 30) + 15 : v === "OVERPRICED" ? -(Math.floor(Math.random() * 100) + 20) : v === "SCAM_ALERT" ? -(Math.floor(Math.random() * 50) + 70) : Math.floor(Math.random() * 10),
          reasoning: "AI validators analyzed the product name and price against known market data to determine fair value.",
          price_factors: ["market comparison"],
          store_name: storeName,
        };
        setChecks(prev => [mock, ...prev]);
        setStats(prev => ({ ...prev, total_checks: prev.total_checks + 1, [`total_${v === "GREAT_DEAL" ? "great_deals" : v === "FAIR_PRICE" ? "fair" : v === "OVERPRICED" ? "overpriced" : "scams"}`]: prev[`total_${v === "GREAT_DEAL" ? "great_deals" : v === "FAIR_PRICE" ? "fair" : v === "OVERPRICED" ? "overpriced" : "scams"}`] + 1 }));
        setResultModal(mock);
      } else {
        const { callContractWrite, waitForTransaction } = await import('./lib/genlayer.js');
        const hash = await callContractWrite('check_price_manual', [productName, listedPrice, storeName, category]);
        const receipt = await waitForTransaction(hash);
        setResultModal(receipt.result || receipt);
      }
    } catch (err) { alert("Check failed: " + err.message); }
    finally { setIsProcessing(false); setProductName(''); setListedPrice(''); setStoreName(''); }
  }, [productName, listedPrice, storeName, category, checks.length]);

  const verdictConfig = {
    GREAT_DEAL: { cls: "great-deal", color: "var(--accent-green)", icon: <TrendingDown size={16} />, label: "GREAT DEAL", emoji: "🎉" },
    FAIR_PRICE: { cls: "fair-price", color: "var(--accent-blue)", icon: <CheckCircle2 size={16} />, label: "FAIR PRICE", emoji: "✅" },
    OVERPRICED: { cls: "overpriced", color: "var(--accent-yellow)", icon: <TrendingUp size={16} />, label: "OVERPRICED", emoji: "⚠️" },
    SCAM_ALERT: { cls: "scam-alert", color: "var(--accent-red)", icon: <AlertTriangle size={16} />, label: "SCAM ALERT", emoji: "🚨" },
  };

  const getV = (verdict) => verdictConfig[(verdict || "").toUpperCase().replace(" ", "_")] || verdictConfig.FAIR_PRICE;

  const getCatEmoji = (c) => ({ electronics: "💻", clothing: "👕", home: "🏠", beauty: "💄", sports: "⚽", food: "🍕", other: "📦" }[c] || "📦");

  return (
    <>
      <div className="bg-grid" />

      <header className="header">
        <div className="logo">
          <div className="logo-icon"><DollarSign size={22} color="#0a0b14" /></div>
          <div>
            <h1>PRICEGUARD</h1>
            <p>Powered by GenLayer</p>
          </div>
        </div>
        <div className="header-right">
          <div className="network-badge">
            <span className="network-dot" />
            <Globe size={12} />
            {MOCK_MODE ? "Demo Mode" : "Bradbury Testnet"}
          </div>
          <button className="wallet-btn">{MOCK_MODE ? "DEMO MODE" : "CONNECT WALLET"}</button>
        </div>
      </header>

      <div className="app-container">
        <section className="hero animate-in">
          <div className="hero-badge"><BadgePercent size={14} /> AI Price Intelligence on GenLayer</div>
          <h2>Is That Price <span>Fair?</span></h2>
          <p>Paste any product URL — GenLayer AI validators will scrape the page, compare prices across the market, and tell you if it's a deal, fair, overpriced, or a scam.</p>
        </section>

        <div className="stats-row animate-in">
          <div className="stat-card">
            <div className="stat-value blue">{stats.total_checks}</div>
            <div className="stat-label">Prices Checked</div>
          </div>
          <div className="stat-card">
            <div className="stat-value green">{stats.total_great_deals}</div>
            <div className="stat-label">Great Deals</div>
          </div>
          <div className="stat-card">
            <div className="stat-value yellow">{stats.total_overpriced}</div>
            <div className="stat-label">Overpriced</div>
          </div>
          <div className="stat-card">
            <div className="stat-value red">{stats.total_scams}</div>
            <div className="stat-label">Scam Alerts</div>
          </div>
        </div>

        <section className="verify-section animate-in">
          <div className="verify-card">
            <div className="verify-tabs">
              <button className={`verify-tab ${activeTab === 'url' ? 'active' : ''}`} onClick={() => setActiveTab('url')}>
                <Link2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Check by URL
              </button>
              <button className={`verify-tab ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>
                <PenLine size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Manual Check
              </button>
            </div>

            {activeTab === 'url' ? (
              <>
                <div className="input-group">
                  <label>Product URL</label>
                  <input type="url" placeholder="Paste product link from Amazon, eBay, AliExpress, Walmart..." value={productUrl} onChange={e => setProductUrl(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="electronics">💻 Electronics</option>
                    <option value="clothing">👕 Clothing & Fashion</option>
                    <option value="home">🏠 Home & Garden</option>
                    <option value="beauty">💄 Beauty & Health</option>
                    <option value="sports">⚽ Sports & Outdoors</option>
                    <option value="food">🍕 Food & Grocery</option>
                    <option value="other">📦 Other</option>
                  </select>
                </div>
                <button className="submit-btn" onClick={handleCheckUrl} disabled={!productUrl || isProcessing}>
                  <Search size={18} /> CHECK PRICE
                </button>
              </>
            ) : (
              <>
                <div className="input-group">
                  <label>Product Name</label>
                  <input type="text" placeholder='e.g. "Apple iPhone 15 Pro 256GB"' value={productName} onChange={e => setProductName(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Listed Price</label>
                  <input type="text" placeholder='e.g. "$999.99" or "€849"' value={listedPrice} onChange={e => setListedPrice(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Store / Seller (optional)</label>
                  <input type="text" placeholder='e.g. "Amazon", "Local Shop", "Facebook Marketplace"' value={storeName} onChange={e => setStoreName(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="electronics">💻 Electronics</option>
                    <option value="clothing">👕 Clothing & Fashion</option>
                    <option value="home">🏠 Home & Garden</option>
                    <option value="beauty">💄 Beauty & Health</option>
                    <option value="sports">⚽ Sports & Outdoors</option>
                    <option value="food">🍕 Food & Grocery</option>
                    <option value="other">📦 Other</option>
                  </select>
                </div>
                <button className="submit-btn" onClick={handleCheckManual} disabled={!productName || !listedPrice || isProcessing}>
                  <Search size={18} /> VERIFY PRICE
                </button>
              </>
            )}
          </div>
        </section>

        <section className="results-section animate-in">
          <h3 className="section-title"><BarChart3 size={20} /> Price Check Registry</h3>
          {checks.map((check, idx) => {
            const vc = getV(check.verdict);
            return (
              <div className={`review-card ${vc.cls}`} key={check.id ?? idx}>
                <div className="review-header">
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>
                      <Package size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                      {check.product_name}
                    </div>
                    <span className={`review-verdict verdict-${vc.cls}`}>{vc.icon} {vc.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: vc.color }}>
                      {check.listed_price}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Fair: {check.estimated_fair_price}
                    </div>
                    {check.savings_percent !== 0 && (
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: check.savings_percent > 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: 2 }}>
                        {check.savings_percent > 0 ? `↓ Save ${check.savings_percent}%` : `↑ ${Math.abs(check.savings_percent)}% above fair`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="review-reasoning">{check.reasoning}</div>
                {check.price_factors && check.price_factors.length > 0 && (
                  <div className="red-flags">
                    <Tag size={12} style={{ color: vc.color, marginRight: 4 }} />
                    {check.price_factors.map((f, i) => (
                      <span key={i} className="red-flag-tag" style={vc.cls === 'great-deal' ? { background: 'var(--accent-green-glow)', color: 'var(--accent-green)', borderColor: 'rgba(0,214,143,0.15)' } : vc.cls === 'fair-price' ? { background: 'var(--accent-blue-glow)', color: 'var(--accent-blue)', borderColor: 'rgba(99,102,241,0.15)' } : {}}>{f}</span>
                    ))}
                  </div>
                )}
                <div className="review-meta">
                  <span>{getCatEmoji(check.category)} {check.category}</span>
                  {check.url && <span><ExternalLink size={12} /> {check.url.slice(0, 40)}...</span>}
                  {check.store_name && <span><Store size={12} /> {check.store_name}</span>}
                  <span>by {check.submitter}</span>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {isProcessing && (
        <div className="processing-overlay">
          <div className="processing-card">
            <div className="spinner" />
            <h3>🧠 AI Validators Analyzing Price...</h3>
            <p style={{ marginTop: 8 }}>Scraping product page, comparing with market data, and reaching consensus.</p>
            <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>This may take up to 45 seconds ⏳</p>
          </div>
        </div>
      )}

      {resultModal && (
        <div className="result-modal-overlay" onClick={() => setResultModal(null)}>
          <div className="result-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setResultModal(null)}><X size={20} /></button>
            <div style={{ marginBottom: 8, fontSize: '3rem' }}>{getV(resultModal.verdict).emoji}</div>
            <span className={`review-verdict verdict-${getV(resultModal.verdict).cls}`} style={{ fontSize: '1rem', padding: '0.5rem 1.2rem' }}>
              {getV(resultModal.verdict).icon} {getV(resultModal.verdict).label}
            </span>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Listed Price</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: getV(resultModal.verdict).color }}>{resultModal.listed_price}</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Estimated Fair Price</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>{resultModal.estimated_fair_price}</div>
            </div>
            {resultModal.savings_percent !== 0 && (
              <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 8, color: resultModal.savings_percent > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {resultModal.savings_percent > 0 ? `🎉 You save ${resultModal.savings_percent}%!` : `⚠️ ${Math.abs(resultModal.savings_percent)}% above fair value`}
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginTop: 12 }}>{resultModal.reasoning}</p>
            <p style={{ marginTop: 16, fontSize: '0.7rem', color: 'var(--text-muted)' }}>✅ Verified on-chain via GenLayer Equivalence Principle</p>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
