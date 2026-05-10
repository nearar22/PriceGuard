# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from genlayer.gl.vm import UserError
import json


WEB_TRUNCATE = 8000

# Verdict the AI returns when it cannot identify the product OR cannot
# determine the listed/typical price with reasonable confidence. This is
# distinct from FAIR_PRICE (which means "AI looked and the price is OK").
VERDICT_INSUFFICIENT = "INSUFFICIENT_DATA"
ALLOWED_VERDICTS = ("GREAT_DEAL", "FAIR_PRICE", "OVERPRICED", "SCAM_ALERT", VERDICT_INSUFFICIENT)


def _smart_search_query(product_url: str) -> str:
    """Extract a meaningful search query from a product URL.

    Domain-specific extractors for the big retailers (Amazon, eBay, Walmart,
    Best Buy, AliExpress) get the human-readable product slug instead of the
    raw product ID, then fall back to a generic "longest meaningful path
    segment" heuristic. Numeric/short alphanumeric IDs are skipped because
    they make terrible search queries (a search for "B0BDHWDR12" gives noise).
    """
    url_lower = product_url.lower()
    path = product_url.split("?")[0].rstrip("/")
    parts = [p for p in path.split("/") if p and not p.startswith("http")]

    def slug_to_words(s: str) -> str:
        return " ".join(
            w for w in s.replace("-", " ").replace("_", " ").replace("+", " ").split()
            if len(w) > 1 and not w.isdigit()
        )

    # Amazon: product slug usually appears just before /dp/ASIN or /gp/product/
    if "amazon." in url_lower:
        for i, p in enumerate(parts):
            if p in ("dp", "gp") and i > 0:
                slug = parts[i - 1]
                words = slug_to_words(slug)
                if len(words) > 5:
                    return words[:120]
        # Fall through: use generic path search

    # eBay: /itm/title-or-id
    if "ebay." in url_lower:
        for i, p in enumerate(parts):
            if p == "itm" and i + 1 < len(parts):
                words = slug_to_words(parts[i + 1])
                if len(words) > 3:
                    return words[:120]

    # Walmart: /ip/Product-Name/12345
    if "walmart." in url_lower:
        for i, p in enumerate(parts):
            if p == "ip" and i + 1 < len(parts):
                words = slug_to_words(parts[i + 1])
                if len(words) > 3:
                    return words[:120]

    # Best Buy: /site/product-name/12345.p
    if "bestbuy." in url_lower:
        for i, p in enumerate(parts):
            if p == "site" and i + 1 < len(parts):
                words = slug_to_words(parts[i + 1])
                if len(words) > 3:
                    return words[:120]

    # AliExpress: /item/Product-Name/12345.html
    if "aliexpress." in url_lower:
        for i, p in enumerate(parts):
            if p == "item" and i + 1 < len(parts):
                words = slug_to_words(parts[i + 1])
                if len(words) > 3:
                    return words[:120]

    # Generic: pick the path segment with the most "real words" (skip pure IDs).
    best = ""
    for p in parts:
        words = slug_to_words(p)
        if len(words.split()) >= 2 and len(words) > len(best):
            best = words
    if best:
        return best[:120]

    # Last-ditch fallback: the last non-empty path segment, ID or not.
    last = parts[-1] if parts else ""
    return slug_to_words(last)[:120] or last[:60]


def _looks_like_bot_wall(content: str) -> bool:
    """Detect when scraped content is a captcha / login wall / DDoS check
    instead of real product data, so the AI doesn't hallucinate from junk."""
    if not content or len(content) < 200:
        return True
    low = content.lower()
    bot_signals = (
        "captcha", "are you a robot", "verify you are human",
        "access denied", "request blocked", "cloudflare",
        "just a moment", "checking your browser",
        "sign in to continue", "log in to continue",
        "enable javascript and cookies", "robot check",
    )
    hits = sum(1 for s in bot_signals if s in low)
    # 2+ signals = almost certainly a wall; 1 signal in tiny content = same.
    return hits >= 2 or (hits >= 1 and len(content) < 1500)


def _safe_render(url: str, max_chars: int) -> str:
    """Render a URL and return up to max_chars of clean content. Returns empty
    string on any exception OR if the result is a detected bot wall, so callers
    can treat empty == 'no usable data' uniformly."""
    try:
        raw = str(gl.nondet.web.render(url))
    except Exception:
        return ""
    if not raw:
        return ""
    if _looks_like_bot_wall(raw):
        return ""
    return raw[:max_chars]


def _search_multi(query: str, max_chars: int) -> str:
    """Fetch scraper-friendly search results for a query.

    We use ONLY DuckDuckGo's HTML endpoint. Earlier versions cascaded through
    Bing and eBay as fallbacks, but on GenLayer Studionet each gl.nondet.web
    render adds 20-60s of latency (per validator, multiplied across 5+
    validators reaching consensus), so a 3-engine cascade pushed total tx
    time to 6-10 minutes. DDG is stable enough that a single request + the
    AI's world-knowledge fallback give the right trade-off between robustness
    and speed. If DDG returns nothing, the prompt still has the MSRP table
    and the product name to work with.
    """
    q = (query or "").strip().replace(" ", "+")[:200]
    if not q:
        return ""
    return _safe_render(f"https://html.duckduckgo.com/html/?q={q}", max_chars)


def _extract_json(raw: str) -> dict:
    """Best-effort extraction of a JSON object from an AI response.

    LLMs sometimes wrap output in ```json fences, prefix with prose, or trail
    with commentary. We try a strict parse first, then progressively fall back
    to extracting the first {...} block we can find.
    """
    if not raw:
        return {}
    s = str(raw).strip()
    # Strip common markdown fences.
    if s.startswith("```"):
        s = s.strip("`")
        if s.lower().startswith("json"):
            s = s[4:].lstrip()
    # Strict parse.
    try:
        return json.loads(s)
    except Exception:
        pass
    # Find the largest {...} block.
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end > start:
        candidate = s[start:end + 1]
        try:
            return json.loads(candidate)
        except Exception:
            pass
    return {}


class PriceGuard(gl.Contract):
    """
    PriceGuard — AI-Powered Price Verification on GenLayer.
    """

    total_checks: u64
    checks: TreeMap[u64, str]
    user_checks: TreeMap[Address, u64]
    total_great_deals: u64
    total_fair: u64
    total_overpriced: u64
    total_scams: u64
    total_insufficient: u64

    def __init__(self):
        self.total_checks = 0
        self.total_great_deals = 0
        self.total_fair = 0
        self.total_overpriced = 0
        self.total_scams = 0
        self.total_insufficient = 0

    # ═══════════════════════════════════════
    #  HELPERS
    # ═══════════════════════════════════════

    def _extract_price_value(self, price_str: str) -> float:
        """Extract numeric price from string like '$29.99' or '29.99 USD'"""
        import re
        try:
            match = re.search(r'[\d,]+\.?\d*', str(price_str).replace(',', ''))
            if match:
                return float(match.group())
        except:
            pass
        return 0.0

    def _normalize_ai_result(
        self,
        raw_result: dict,
        product_name_fallback: str,
        listed_price_fallback: str,
        page_blocked: bool = False,
    ) -> str:
        """Normalize the AI's JSON output into a deterministic record.

        This is where we enforce honesty: if the AI doesn't have enough data,
        we force INSUFFICIENT_DATA rather than letting it (or our defaults)
        silently produce a fake FAIR_PRICE that misleads users.
        """
        verdict = str(raw_result.get("verdict", "")).strip().upper().replace(" ", "_")
        product_name = str(raw_result.get("product_name", product_name_fallback))[:200]
        listed_price = str(raw_result.get("listed_price", listed_price_fallback))[:50]
        estimated_fair = str(raw_result.get("estimated_fair_price", ""))[:50]
        reasoning = str(raw_result.get("reasoning", ""))[:500]
        try:
            savings = int(raw_result.get("savings_percent", 0))
        except Exception:
            savings = 0
        # Confidence: clamp to 0-100. Default to 70 when missing — if the AI
        # returned a real verdict but didn't bother with the confidence field,
        # it almost certainly DID know the product. (The previous default of 50
        # combined with a 25 threshold meant well-known products kept getting
        # flipped to INSUFFICIENT_DATA on AI omission.)
        try:
            confidence = int(raw_result.get("confidence", 70))
        except Exception:
            confidence = 70
        if confidence < 0:
            confidence = 0
        if confidence > 100:
            confidence = 100

        # ── Honesty checks: detect when the AI couldn't actually do its job ──
        empty_listed = (not listed_price) or listed_price.strip().upper() in ("N/A", "NA", "NONE", "UNKNOWN", "")
        empty_fair = (not estimated_fair) or estimated_fair.strip().upper() in ("N/A", "NA", "NONE", "UNKNOWN", "")
        empty_name = (not product_name) or product_name.strip().lower() in ("unknown", "n/a", "")

        # Force INSUFFICIENT_DATA only when the AI was clearly grasping at air:
        #   - couldn't even name the product, OR
        #   - has neither the listed nor a typical price, OR
        #   - the page was blocked AND no listed price was recovered, OR
        #   - confidence is very low (<15) AND the AI itself returned INSUFFICIENT_DATA.
        # Note: we no longer flip to INSUFFICIENT_DATA just because confidence is
        # in the 15-30 range — if the AI committed to a verdict and gave a fair
        # price, we trust it. The prompt now strongly elicits 70-95 for mainstream.
        force_insufficient = (
            empty_name
            or (empty_listed and empty_fair)
            or (page_blocked and empty_listed)
            or (confidence < 15 and verdict == VERDICT_INSUFFICIENT)
        )
        if force_insufficient:
            verdict = VERDICT_INSUFFICIENT
            if not reasoning:
                missing = []
                if empty_name:
                    missing.append("product identity")
                if empty_listed:
                    missing.append("listed price")
                if empty_fair:
                    missing.append("typical market price")
                reasoning = (
                    "Could not determine "
                    + ", ".join(missing or ["enough data"])
                    + (". The product page was blocked by bot detection; "
                       "search results didn't fill the gap." if page_blocked else ".")
                ) + " Try the Manual Check tab with the product name and price you can see."
            savings = 0
            estimated_fair = estimated_fair or "N/A"
            listed_price = listed_price or "N/A"

        # Scam fallback: even without AI analysis, an absurdly low price on a
        # famously expensive product is still a scam signal.
        elif (empty_fair or not reasoning) and listed_price and not empty_listed:
            price_val = self._extract_price_value(listed_price)
            known_expensive = (
                "airpods", "iphone", "ipad", "macbook", "ps5", "playstation",
                "xbox", "samsung tv", "sony tv", "rolex", "gucci", "prada",
                "louis vuitton", "hermes", "rtx", "nintendo switch",
            )
            product_lower = product_name.lower()
            is_expensive = any(k in product_lower for k in known_expensive)
            if is_expensive and price_val > 0 and price_val < 50:
                verdict = "SCAM_ALERT"
                estimated_fair = estimated_fair or "Typically $150-500+"
                reasoning = (
                    f"Listed price ${price_val:.2f} is far below typical retail for "
                    f"{product_name}. Likely scam or counterfeit."
                )
                savings = -90
                confidence = max(confidence, 70)

        # Final guard: only return allowed verdicts.
        if verdict not in ALLOWED_VERDICTS:
            # Unknown verdict means the AI's whole response is suspect. We've
            # observed real cases where verdict was malformed AND reasoning
            # described a completely different product than product_name (e.g.
            # iPhone input → PS5 reasoning). So sanitize aggressively: keep
            # only the input-grounded fields (product_name, listed_price) and
            # zero out everything the AI made up.
            verdict = VERDICT_INSUFFICIENT
            reasoning = (
                "The AI returned a malformed analysis (unrecognized verdict, "
                "and the reasoning may have been cross-contaminated with another "
                "product's data). Please try again or use the Manual Check tab "
                "with a more specific product name (full model / SKU)."
            )
            estimated_fair = "N/A"
            savings = 0
            confidence = 0

        normalized = {
            "verdict": verdict,
            "confidence": confidence,
            "product_name": product_name or "Unknown",
            "listed_price": listed_price or "N/A",
            "estimated_fair_price": estimated_fair or "N/A",
            "savings_percent": savings,
            "reasoning": reasoning,
            "price_factors": sorted([str(f).strip().lower() for f in raw_result.get("price_factors", [])][:5]),
        }
        return json.dumps(normalized, sort_keys=True)

    def _record_check(self, check_id: u64, result: dict, url: str, store_name: str):
        verdict = result.get("verdict", "FAIR_PRICE")
        submitter = gl.message.sender_address

        record = {
            "id": int(check_id),
            "url": url,
            "category": result.get("_category", ""),
            "submitter": str(submitter),
            "verdict": verdict,
            "confidence": int(result.get("confidence", 50)),
            "product_name": result.get("product_name", "Unknown"),
            "listed_price": result.get("listed_price", "N/A"),
            "estimated_fair_price": result.get("estimated_fair_price", "N/A"),
            "savings_percent": result.get("savings_percent", 0),
            "reasoning": result.get("reasoning", ""),
            "price_factors": result.get("price_factors", []),
            "store_name": store_name,
        }

        self.checks[check_id] = json.dumps(record)
        self.total_checks += 1

        current_user_checks = int(self.user_checks.get(submitter, 0))
        self.user_checks[submitter] = current_user_checks + 1

        if verdict == "GREAT_DEAL":
            self.total_great_deals += 1
        elif verdict == "FAIR_PRICE":
            self.total_fair += 1
        elif verdict == "OVERPRICED":
            self.total_overpriced += 1
        elif verdict == "SCAM_ALERT":
            self.total_scams += 1
        elif verdict == VERDICT_INSUFFICIENT:
            self.total_insufficient += 1

    # ═══════════════════════════════════════
    #  CHECK PRICE BY URL
    # ═══════════════════════════════════════

    @gl.public.write
    def check_price(self, product_url: str, category: str) -> dict:
        if not product_url:
            raise UserError("Product URL cannot be empty")
        if not product_url.startswith(("http://", "https://")):
            raise UserError("Product URL must start with http:// or https://")

        VALID_CATEGORIES = ["electronics", "clothing", "home", "beauty", "sports", "food", "other"]
        if category not in VALID_CATEGORIES:
            raise UserError(f"Invalid category. Choose from: {', '.join(VALID_CATEGORIES)}")

        check_id = self.total_checks

        # Build the search query OUTSIDE the nondet block so every validator
        # uses the exact same query string (deterministic input).
        search_query = _smart_search_query(product_url) or category

        def nondet_block():
            # 1. Try the actual product page. Most big retailers (Amazon,
            #    Walmart, Best Buy) bot-wall headless renders — _safe_render
            #    returns "" in that case so we fall back gracefully.
            page_data = _safe_render(product_url, WEB_TRUNCATE)
            page_blocked = (page_data == "")

            # 2. One combined search query (product info + price signals in
            #    a single request). Earlier versions did two separate searches
            #    and cascaded across 3 engines each — that quintupled latency
            #    without materially improving verdict quality.
            product_search = _search_multi(
                f"{search_query} MSRP price retail typical cost usd",
                WEB_TRUNCATE // 2,
            )
            price_search = ""

            page_status = "BLOCKED by bot detection" if page_blocked else (
                f"available ({len(page_data)} chars)" if page_data else "empty"
            )

            task = f"""You are PriceGuard, the world's most accurate AI price analyst, deployed on the GenLayer blockchain. You have encyclopedic knowledge of consumer-product MSRPs and typical street prices across electronics, fashion, home goods, beauty, sports, food, and luxury markets.

MISSION: Identify the product, find its listed price, compare against the typical market price, and ALWAYS COMMIT to a definitive verdict (GREAT_DEAL / FAIR_PRICE / OVERPRICED / SCAM_ALERT). INSUFFICIENT_DATA is FORBIDDEN unless the page + URL + search results give zero usable signal about what product this is.

⚠️ COMMIT-TO-A-VERDICT RULES (priority order):
• If product is identifiable but unreleased/future (e.g. iPhone 17, RTX
  6090): use BRAND-TIER estimation. Apple flagship phones are NEVER
  under $799. Sony flagship headphones are NEVER under $200. Use this
  to detect scams: e.g. iPhone 17 @ $100 → SCAM_ALERT.
• If product is niche/lesser-known: estimate from BRAND tier + CATEGORY
  norms, then return FAIR_PRICE / GREAT_DEAL / OVERPRICED based on the
  listed price vs that estimate. Lean toward FAIR_PRICE when uncertain.
• INSUFFICIENT_DATA is ONLY for: page blocked + no URL keywords + no
  search results, leaving you with literally no signal at all.

⚠️ CRITICAL ANTI-HALLUCINATION RULES:
• Identify the product from PAGE CONTENT and URL KEYWORDS — those are
  authoritative. Search snippets are SECONDARY context only.
• Your "reasoning" MUST explicitly reference the product you identified
  from the page/URL, not some other product the search snippets happened
  to mention.
• Never pivot to analyzing a different product just because its data is
  easier.

--- INPUT ---
CATEGORY: {category}
URL: {product_url}
URL KEYWORDS: {search_query}
PAGE STATUS: {page_status}

=== PRODUCT PAGE CONTENT ===
{page_data if page_data else '(no usable content - the site blocked the bot)'}
=== END PRODUCT PAGE ===

=== WEB SEARCH — PRODUCT (DDG/Bing/eBay cascade) ===
{product_search if product_search else '(all search engines returned empty/captcha)'}
=== END SEARCH ===

=== WEB SEARCH — TYPICAL PRICE (DDG/Bing/eBay cascade) ===
{price_search if price_search else '(all search engines returned empty/captcha)'}
=== END SEARCH ===

--- DECISION FRAMEWORK ---

[1] PRODUCT IDENTIFICATION
  • Read PAGE CONTENT first. If blocked, infer from URL KEYWORDS + search snippets.
  • You DO recognize mainstream brands from training data. For Apple, Samsung,
    Sony, Bose, Nintendo, Microsoft Xbox, PlayStation, Dell, HP, Lenovo, Logitech,
    Razer, Dyson, KitchenAid, Nike, Adidas, Lululemon, LEGO, Rolex, Omega, Gucci,
    LV, Hermes, Tesla parts, etc. — trust your knowledge.
  • Set INSUFFICIENT_DATA only when the product is unidentifiable: random IDs,
    truly unreleased items, fully generic names ("red shirt"), foreign-locale
    products you have no data on.

[2] LISTED PRICE
  • Extract from PAGE CONTENT (look for $, €, £, ¥, ₹, MAD, EUR, USD, GBP, JPY).
  • Convert non-USD prices to approximate USD using common rates (€1≈$1.08,
    £1≈$1.27, ¥1≈$0.0066, ₹1≈$0.012, MAD1≈$0.10).
  • If page is blocked, look for prices in search snippets.
  • If absolutely no price is recoverable, return INSUFFICIENT_DATA.

[3] TYPICAL MARKET PRICE — use these in priority order:
  a. Specific prices visible in search snippets for the same product/model.
  b. Your training-data MSRP knowledge. Reference points you DO know:
     - Sony WH-1000XM5 ≈ $399 | WH-1000XM4 ≈ $349
     - AirPods Pro 2 ≈ $249 | AirPods 4 ≈ $129
     - iPhone 15 Pro Max 256GB ≈ $1199 | iPhone 15 ≈ $799
     - MacBook Air M2 ≈ $1199 | MacBook Pro M3 14" ≈ $1599
     - PS5 ≈ $499 | Xbox Series X ≈ $499 | Switch OLED ≈ $349
     - Dyson V15 ≈ $749 | Bose QC45 ≈ $329 | Bose QC Ultra ≈ $429
     - Samsung Galaxy S24 Ultra ≈ $1299 | Galaxy Buds Pro ≈ $229
     - Nike Air Force 1 ≈ $110 | Adidas Ultraboost ≈ $190
     - LEGO Millennium Falcon ≈ $849 | LEGO Star Destroyer ≈ $700
     - Rolex Submariner ≈ $10–15K | Omega Speedmaster ≈ $7K
  c. For lesser-known products, estimate from category norms + brand tier.
  d. Only set INSUFFICIENT_DATA if you have ZERO signal for typical price.

[4] LEGITIMATE DISCOUNT DETECTION (do NOT flag as scam):
  • Page/title contains: "used", "refurbished", "renewed", "open-box",
    "clearance", "factory second", "pre-owned", "-20%", "sale".
  • In those cases, a 30–60% discount is normal → GREAT_DEAL or FAIR_PRICE.

[5] VERDICT THRESHOLDS (when listed AND typical are both known):
  • SCAM_ALERT  — listed is <40% of typical MSRP AND the product is FAMOUS
                   (Sony, Apple, Bose, Samsung, Rolex, etc.) AND no refurb/used
                   signal exists. Example: Sony WH-1000XM5 at $50 → SCAM. Set
                   this ONLY when the price is implausibly low for the brand.
  • GREAT_DEAL  — listed is 20–60% below typical. Example: Sony WH-1000XM5
                   at $200 on a $399 MSRP = exactly 50% off = GREAT_DEAL (a
                   Prime Day / Black Friday style discount), NOT scam.
  • FAIR_PRICE  — listed is within ±15% of typical.
  • OVERPRICED  — listed is 20%+ above typical.
  • IMPORTANT: do not flag a 50% discount as SCAM_ALERT just because it
    crosses the "half of MSRP" line. Real sales commonly hit 50% off on
    flagship electronics. Reserve SCAM for obviously implausible prices.

[6] CONFIDENCE (0–100):
  • 90–99 — famous product, clear pricing, strong agreement across sources.
  • 70–89 — known product, some inference required.
  • 50–69 — less-known product, reasonable estimate.
  • <30   — reserve for genuine INSUFFICIENT_DATA only.

--- OUTPUT FORMAT ---
Return ONE JSON object. No markdown. No code fences. No prose before/after.
All string values must use double quotes. savings_percent is positive when
listed < typical (a deal) and negative when listed > typical (overpriced).

{{"verdict":"GREAT_DEAL|FAIR_PRICE|OVERPRICED|SCAM_ALERT|INSUFFICIENT_DATA","confidence":<0-100>,"product_name":"<concrete name or 'Unknown'>","listed_price":"<$X.XX or 'N/A'>","estimated_fair_price":"<$X.XX or 'N/A'>","savings_percent":<int>,"reasoning":"<2-3 sentences citing the source of typical price>","price_factors":["<factor1>","<factor2>"]}}"""

            result = gl.nondet.exec_prompt(task)
            parsed = _extract_json(result)
            return self._normalize_ai_result(parsed, "Unknown", "N/A", page_blocked)

        # Comparative principle — designed to SURVIVE natural validator variance:
        # different LLMs, different search snippets, different MSRP guesses.
        # We accept GREAT_DEAL↔FAIR_PRICE and FAIR_PRICE↔OVERPRICED as boundary
        # agreement, since they represent neighbouring zones on the same
        # continuous discount/markup spectrum. Hard verdicts (SCAM_ALERT,
        # INSUFFICIENT_DATA) must match exactly because they're categorical.
        comparative_principle = (
            "Outputs are equivalent if: "
            "(a) the 'verdict' field matches exactly, OR "
            "(b) one verdict is 'GREAT_DEAL' and the other is 'FAIR_PRICE' "
            "(adjacent zones on the discount spectrum), OR "
            "(c) one verdict is 'FAIR_PRICE' and the other is 'OVERPRICED' "
            "(adjacent zones on the markup spectrum). "
            "SCAM_ALERT and INSUFFICIENT_DATA must match exactly. "
            "The 'product_name' fields must describe the same product — case, "
            "whitespace, brand-prefix, and generation suffixes are immaterial "
            "(e.g. 'AirPods Pro' ≈ 'Apple AirPods Pro 2nd Gen'). "
            "Numeric fields 'listed_price' and 'estimated_fair_price' must be "
            "within ±20% of each other (search-derived prices vary widely). "
            "'savings_percent' must be within ±25 points. "
            "'reasoning' and 'price_factors' may differ freely."
        )
        result_str = gl.eq_principle.prompt_comparative(nondet_block, comparative_principle)
        result = _extract_json(result_str)
        result["_category"] = category
        self._record_check(check_id, result, product_url, "")
        return result

    # ═══════════════════════════════════════
    #  MANUAL PRICE CHECK
    # ═══════════════════════════════════════

    @gl.public.write
    def check_price_manual(self, product_name: str, listed_price: str, store_name: str, category: str) -> dict:
        if not product_name or not listed_price:
            raise UserError("Product name and price are required")

        VALID_CATEGORIES = ["electronics", "clothing", "home", "beauty", "sports", "food", "other"]
        if category not in VALID_CATEGORIES:
            raise UserError(f"Invalid category. Choose from: {', '.join(VALID_CATEGORIES)}")

        check_id = self.total_checks

        def nondet_block():
            # One combined search that asks for both product info AND prices.
            # Two separate searches doubled the latency without materially
            # improving verdict quality (the AI's MSRP table covers most of
            # the gap on mainstream products).
            product_search = _search_multi(
                f"{product_name} MSRP price retail typical cost usd",
                WEB_TRUNCATE,
            )
            price_search = ""

            task = f"""You are PriceGuard, the world's most accurate AI price analyst, deployed on the GenLayer blockchain. You have encyclopedic knowledge of consumer-product MSRPs and typical street prices across electronics, fashion, home goods, beauty, sports, food, and luxury markets.

MISSION: The user has ALREADY provided the product name and listed price. Your job is to ALWAYS COMMIT to a definitive verdict (GREAT_DEAL / FAIR_PRICE / OVERPRICED / SCAM_ALERT). INSUFFICIENT_DATA is FORBIDDEN unless the product name is literal gibberish (random characters, no brand, not a recognizable category).

⚠️ COMMIT-TO-A-VERDICT RULES (priority order):
• If product is identifiable but unreleased/future (e.g. iPhone 17, RTX
  6090): use BRAND-TIER estimation. Apple flagship phones are NEVER
  under $799. Sony flagship headphones are NEVER under $200. Use this
  to detect scams: e.g. iPhone 17 @ $100 → SCAM_ALERT (Apple flagship
  pricing floor is $799+, so $100 is implausibly low).
• If product is niche/lesser-known: estimate from BRAND tier + CATEGORY
  norms, then return FAIR_PRICE / GREAT_DEAL / OVERPRICED based on the
  listed price vs that estimate. Lean toward FAIR_PRICE when uncertain.
• INSUFFICIENT_DATA is ONLY for: random gibberish ("asdfgh123"), or
  product names so generic they could be anything ("thing", "item").

⚠️ CRITICAL ANTI-HALLUCINATION RULES:
• Your "product_name" field MUST be the same product the user submitted.
• Your "reasoning" field MUST explicitly reference the user's PRODUCT, not
  some other product the search results happened to mention.
• Search snippets often include unrelated products (e.g. searching for an
  iPhone may surface PS5 listings). IGNORE unrelated products entirely.
• Never pivot to analyzing a different product just because its data is easier.

--- INPUT (provided by the user, treat as ground truth) ---
PRODUCT: {product_name}
LISTED PRICE: {listed_price}
STORE: {store_name or '(not provided)'}
CATEGORY: {category}

=== WEB SEARCH — PRODUCT (DDG/Bing/eBay cascade) ===
{product_search if product_search else '(all search engines returned empty/captcha)'}
=== END SEARCH ===

=== WEB SEARCH — TYPICAL PRICE (DDG/Bing/eBay cascade) ===
{price_search if price_search else '(all search engines returned empty/captcha)'}
=== END SEARCH ===

--- DECISION FRAMEWORK ---

[1] CURRENCY NORMALIZATION
  • Listed price may be in $, €, £, ¥, ₹, MAD, etc. Convert to approximate
    USD using common rates (€1≈$1.08, £1≈$1.27, ¥1≈$0.0066, ₹1≈$0.012,
    MAD1≈$0.10) before comparing against your USD MSRP knowledge.

[2] TYPICAL MARKET PRICE — priority order:
  a. Specific prices visible in search snippets for the same model.
  b. Your training-data MSRP knowledge. Reference points:
     - Sony WH-1000XM5 ≈ $399 | WH-1000XM4 ≈ $349
     - AirPods Pro 2 ≈ $249 | AirPods 4 ≈ $129
     - iPhone 15 Pro Max 256GB ≈ $1199 | iPhone 15 ≈ $799
     - MacBook Air M2 ≈ $1199 | MacBook Pro M3 14" ≈ $1599
     - PS5 ≈ $499 | Xbox Series X ≈ $499 | Switch OLED ≈ $349
     - Dyson V15 ≈ $749 | Bose QC45 ≈ $329 | Bose QC Ultra ≈ $429
     - Samsung Galaxy S24 Ultra ≈ $1299 | Galaxy Buds Pro ≈ $229
     - Nike Air Force 1 ≈ $110 | Adidas Ultraboost ≈ $190
     - LEGO Millennium Falcon ≈ $849 | LEGO Star Destroyer ≈ $700
     - Rolex Submariner ≈ $10–15K | Omega Speedmaster ≈ $7K
  c. For lesser-known items, estimate from brand tier + category norms.
  d. Only set INSUFFICIENT_DATA if you have ZERO signal for typical price.

[3] LEGITIMATE DISCOUNT DETECTION (do NOT flag as scam):
  • Product name or store hints contain: "used", "refurbished", "renewed",
    "open-box", "clearance", "pre-owned", "factory second", "sale".
  • Then a 30–60% discount is normal → GREAT_DEAL.

[4] VERDICT THRESHOLDS:
  • SCAM_ALERT  — listed is <40% of typical AND product is a FAMOUS brand
                   (Sony/Apple/Bose/Samsung/Rolex/etc.) AND no refurb signal.
                   Example: Sony WH-1000XM5 at $50 → SCAM.
  • GREAT_DEAL  — listed is 20–60% below typical. Example: Sony WH-1000XM5
                   at $200 on $399 MSRP (50% off) = GREAT_DEAL, NOT scam —
                   flagship electronics routinely hit 50% off during Prime
                   Day, Black Friday, or open-box sales.
  • FAIR_PRICE  — listed is within ±15% of typical.
  • OVERPRICED  — listed is 20%+ above typical.
  • INSUFFICIENT_DATA — only when product genuinely unidentifiable.
  • IMPORTANT: do NOT flag a 50% discount as SCAM just because it crosses
    the half-of-MSRP line. Reserve SCAM for implausibly low prices.

[5] CONFIDENCE (0–100):
  • 90–99 — famous product, your MSRP knowledge is solid.
  • 70–89 — known brand, reasonable estimate.
  • 50–69 — niche product, ballpark estimate.
  • <30   — reserve for genuine INSUFFICIENT_DATA only.

--- OUTPUT FORMAT ---
Return ONE JSON object. No markdown. No code fences. No prose.
savings_percent is positive when listed < typical (a deal), negative otherwise.

{{"verdict":"GREAT_DEAL|FAIR_PRICE|OVERPRICED|SCAM_ALERT|INSUFFICIENT_DATA","confidence":<0-100>,"product_name":"{product_name}","listed_price":"{listed_price}","estimated_fair_price":"<$X.XX or 'N/A'>","savings_percent":<int>,"reasoning":"<2-3 sentences citing the source of typical price>","price_factors":["<factor1>","<factor2>"]}}"""

            result = gl.nondet.exec_prompt(task)
            parsed = _extract_json(result)
            return self._normalize_ai_result(parsed, product_name, listed_price, page_blocked=False)

        # Same tolerant comparative principle as check_price (see explanation
        # there). Boundary verdicts and ±20% prices are accepted to keep
        # consensus alive across validator variance.
        comparative_principle = (
            "Outputs are equivalent if: "
            "(a) the 'verdict' field matches exactly, OR "
            "(b) one verdict is 'GREAT_DEAL' and the other is 'FAIR_PRICE', OR "
            "(c) one verdict is 'FAIR_PRICE' and the other is 'OVERPRICED'. "
            "SCAM_ALERT and INSUFFICIENT_DATA must match exactly. "
            "The 'product_name' fields must describe the same product. "
            "Numeric fields 'listed_price' and 'estimated_fair_price' must be "
            "within ±20% of each other. "
            "'savings_percent' must be within ±25 points. "
            "'reasoning' and 'price_factors' may differ freely."
        )
        result_str = gl.eq_principle.prompt_comparative(nondet_block, comparative_principle)
        result = _extract_json(result_str)
        result["_category"] = category
        self._record_check(check_id, result, "", store_name)
        return result

    # ═══════════════════════════════════════
    #  READ METHODS
    # ═══════════════════════════════════════

    @gl.public.view
    def get_check(self, check_id: int) -> dict:
        try:
            return json.loads(self.checks[check_id])
        except:
            return {}

    @gl.public.view
    def get_recent_checks(self, count: int) -> list:
        results = []
        start = max(0, self.total_checks - count)
        for i in range(start, self.total_checks):
            try:
                results.append(json.loads(self.checks[i]))
            except:
                pass
        return results

    @gl.public.view
    def get_stats(self) -> dict:
        total = max(1, self.total_checks)
        return {
            "total_checks": int(self.total_checks),
            "total_great_deals": int(self.total_great_deals),
            "total_fair": int(self.total_fair),
            "total_overpriced": int(self.total_overpriced),
            "total_scams": int(self.total_scams),
            "total_insufficient": int(self.total_insufficient),
            "scam_rate": round((int(self.total_scams) / total) * 100, 1),
        }

    @gl.public.view
    def get_user_stats(self, user: Address) -> dict:
        try:
            checks = int(self.user_checks[user])
        except:
            checks = 0
        return {"checks": checks}
