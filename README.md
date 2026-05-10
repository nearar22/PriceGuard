# 💰 PriceGuard — AI-Powered Price Verification on GenLayer

## 🌟 Overview

**PriceGuard** is a decentralized price verification platform built on the **GenLayer blockchain**. It uses GenLayer's **Intelligent Contracts** to determine whether a product's price is fair, overpriced, a great deal, or a scam — all verified through AI consensus and stored on-chain.

Online shoppers face constant pricing manipulation: fake discounts, inflated markups, counterfeit products at suspicious prices. PriceGuard solves this by leveraging GenLayer's unique capabilities:

1. **Web Scraping** (`gl.get_webpage`) — AI validators independently fetch and read product pages
2. **LLM Analysis** (`gl.exec_prompt`) — Each validator analyzes the product, price, and market context
3. **Consensus** (`gl.eq_principle_strict_eq`) — Validators must agree on the verdict, ensuring trustworthy results

> No middleman. No affiliate bias. The blockchain itself reads the web and verifies prices.

---

## ✨ Features

- **URL Price Check** — Paste any product URL (Amazon, eBay, AliExpress, Walmart) and get an AI-verified price analysis
- **Manual Price Check** — Enter product name + price + store for instant market comparison
- **4-Tier Verdicts** — 🎉 GREAT DEAL / ✅ FAIR PRICE / ⚠️ OVERPRICED / 🚨 SCAM ALERT
- **Fair Price Estimate** — AI calculates what the product should actually cost
- **Savings Calculator** — Shows exact % above or below fair market value
- **Price Factor Tags** — Identifies why (seasonal sale, authorized dealer, counterfeit risk, markup)
- **On-Chain Registry** — All price checks stored permanently on GenLayer
- **Platform Stats** — Real-time dashboard with verification statistics

---

## 🧠 The GenLayer Advantage

### Why GenLayer Makes This Possible

Traditional blockchains can only execute deterministic code. GenLayer's **Optimistic Democracy** enables:

| Feature | Traditional Blockchain | GenLayer |
|---------|----------------------|----------|
| Read product pages | ❌ Impossible | ✅ `gl.get_webpage()` |
| AI price analysis | ❌ Impossible | ✅ `gl.exec_prompt()` |
| Subjective consensus | ❌ Impossible | ✅ `gl.eq_principle_strict_eq()` |

### How Price Verification Works

```
User submits product URL
        │
        ▼
┌───────────────────────────────────────┐
│  GenLayer Intelligent Contract        │
│                                       │
│  1. gl.get_webpage(product_url)       │ ← Validators fetch the product page
│     └─ Extract: product name,         │
│        brand, model, listed price     │
│                                       │
│  2. gl.exec_prompt(analysis)          │ ← AI compares against market data
│     └─ Compare with known prices,     │
│        check for scam indicators      │
│                                       │
│  3. gl.eq_principle_strict_eq()       │ ← Validators reach consensus
│     └─ Agree on: verdict,             │
│        fair price, savings %          │
└───────────────────────────────────────┘
        │
        ▼
On-chain result: {verdict, listed_price, fair_price, savings%, reasoning}
```

---

## 🏗️ Architecture

```
PriceGuard/
├── contracts/
│   └── PriceGuard.py               # GenLayer Intelligent Contract
└── frontend/
    ├── src/
    │   ├── App.jsx                  # Main React application
    │   ├── lib/
    │   │   └── genlayer.js          # GenLayer client config (genlayer-js)
    │   ├── index.css                # Premium design system
    │   └── main.jsx                 # Entry point
    ├── .env.example                 # Contract address config
    └── index.html                   # SEO-optimized HTML
```

### Tech Stack
- **Smart Contract**: Python (GenLayer SDK) — `gl.get_webpage`, `gl.exec_prompt`, `gl.eq_principle_strict_eq`
- **Frontend**: React + Vite
- **Styling**: Custom CSS (Glassmorphism, dark theme, micro-animations)
- **Client**: `genlayer-js` (Official GenLayer JavaScript SDK)
- **Icons**: Lucide React
- **Deployment**: Vercel (frontend) + GenLayer Bradbury Testnet (contract)

---

## 🚀 Quick Start

### 1. Deploy the Contract

1. Open [GenLayer Studio](https://studio.genlayer.com/)
2. Upload `contracts/PriceGuard.py`
3. Click **Compile** → **Deploy** (no constructor args needed)
4. Copy the deployed contract address

### 2. Run the Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env — paste your contract address:
# VITE_CONTRACT_ADDRESS=0xYOUR_ADDRESS_HERE
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. Demo Mode

The app runs in **Demo Mode** automatically when `VITE_CONTRACT_ADDRESS` is not set. This lets you explore the full UI with sample data without a deployed contract.

---

## 📄 Smart Contract API

### Write Methods

| Method | Args | Description |
|--------|------|-------------|
| `check_price` | `product_url: str, category: str` | Scrape product page + AI price analysis |
| `check_price_manual` | `product_name: str, listed_price: str, store_name: str, category: str` | Manual price check via AI knowledge |

### Read Methods

| Method | Args | Description |
|--------|------|-------------|
| `get_check` | `check_id: int` | Get a single price check result |
| `get_recent_checks` | `count: int` | Get N most recent checks |
| `get_stats` | — | Global platform statistics |
| `get_user_stats` | `user: Address` | User check count |

### Supported Categories
`electronics`, `clothing`, `home`, `beauty`, `sports`, `food`, `other`

### Verdict Types

| Verdict | Meaning | Example |
|---------|---------|---------|
| 🎉 `GREAT_DEAL` | 20%+ below fair market | Samsung TV on seasonal sale |
| ✅ `FAIR_PRICE` | Within ±15% of market | Sony headphones at MSRP |
| ⚠️ `OVERPRICED` | 20%+ above fair market | Generic jacket with 300% markup |
| 🚨 `SCAM_ALERT` | Suspiciously low or scam indicators | "AirPods Pro" for $29.99 |

---

## 🎯 What Makes PriceGuard Unique

1. **Real Web Scraping** — PriceGuard actually reads product pages from the live web
2. **AI Market Intelligence** — Cross-references products against known market prices
3. **Scam Detection** — Flags suspiciously low prices that indicate counterfeits or bait-and-switch
4. **On-Chain Transparency** — Every price check is permanently stored and verifiable
5. **No Affiliate Bias** — AI validators have no financial incentive to recommend purchases
6. **Real-World Impact** — Online scams cost consumers $8.8 billion in 2022 (FTC)

---

## 📜 License

MIT License

---

*Built with 💰 for the GenLayer Ecosystem*
