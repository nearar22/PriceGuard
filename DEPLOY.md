# 🚀 Deploy PriceGuard to GenLayer

## 1. Deploy the Smart Contract

1. Open [GenLayer Studio](https://studio.genlayer.com/)
2. Create a new project
3. Upload `contracts/PriceGuard.py` (or copy-paste the content)
4. Click **Compile** → wait for success
5. Click **Deploy** — no constructor args needed
6. Copy the deployed contract address (e.g. `0xabc123...`)

## 2. Configure the Frontend

```bash
cd frontend
cp .env.example .env
```

Edit `.env` and paste your contract address:
```
VITE_CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS_HERE
```

If using a custom GenLayer testnet RPC (not required for Studio):
```
VITE_GENLAYER_RPC_URL=https://studio.genlayer.com/api
```

## 3. Run or Build

```bash
# Development
npm install
npm run dev

# Production build
npm run build
```

## 4. Verify It Works

- Open `http://localhost:5173` (dev) or serve `dist/` (prod)
- The header should show **"LIVE MODE"** with your GenLayer account address (not Demo Mode)
- Stats will load from the contract automatically
- Submit a price check — it will execute on-chain via GenLayer validators

## ⚠️ Common Issues

| Issue | Fix |
|-------|-----|
| "Demo Mode" shown | `VITE_CONTRACT_ADDRESS` is empty in `.env` |
| Build fails with module error | Run `npm install` first |
| Contract calls fail | Check that the contract is deployed and the address is correct |
| CORS / network error | Ensure you are on the correct GenLayer network (studionet / Bradbury) |

## 🧪 Testing the Contract in GenLayer Studio

Use the Studio's **Interact** tab to test read methods directly:

- `get_stats()` — returns platform statistics
- `get_recent_checks(5)` — returns last 5 price checks
- `get_check(0)` — returns check #0

For write methods, use the frontend or Studio's transaction sender:
- `check_price("https://example.com/product", "electronics")`
- `check_price_manual("Sony Headphones", "$299", "Amazon", "electronics")`

## 🔒 Security Notes

- **No private keys in the browser**: GenLayer `genlayer-js` auto-generates a random account per session. Never paste a private key in `VITE_*` env variables — they are bundled into client-side code and exposed to anyone.
- **URL validation**: Both frontend and contract validate URLs (HTTP/HTTPS only, no localhost/internal addresses).
- **XSS protection**: Contract data is sanitized before rendering.
- **Sandboxed execution**: GenLayer validators run in isolated VMs — even malicious URLs cannot harm the network.

---

*Built for the GenLayer Ecosystem*
