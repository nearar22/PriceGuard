# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json


WEB_TRUNCATE = 8000


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

    def __init__(self):
        self.total_checks = 0
        self.total_great_deals = 0
        self.total_fair = 0
        self.total_overpriced = 0
        self.total_scams = 0

    # ═══════════════════════════════════════
    #  CHECK PRICE BY URL
    # ═══════════════════════════════════════

    @gl.public.write
    def check_price(self, product_url: str, category: str) -> dict:
        if not product_url:
            raise Rollback("Product URL cannot be empty")

        check_id = self.total_checks

        def nondet_block():
            web_data = str(gl.nondet.web.get(product_url))[:WEB_TRUNCATE]

            task = f"""You are PriceGuard, an expert AI price analyst.

TASK: Analyze the product page below. Identify the product and price. Determine if the price is fair.

CATEGORY: {category}
URL: {product_url}

PAGE CONTENT:
<<>>
{web_data}
<<>>

STEPS:
1. Identify product name, brand, model
2. Extract listed price (include currency)
3. Compare to typical market price for this product
4. Check for scam indicators

VERDICT:
- "GREAT_DEAL": 20%+ below market, listing seems legit
- "FAIR_PRICE": Within ±15% of market
- "OVERPRICED": 20%+ above market
- "SCAM_ALERT": Suspiciously low or scam indicators

Return ONLY JSON:
{{"verdict": "GREAT_DEAL"|"FAIR_PRICE"|"OVERPRICED"|"SCAM_ALERT", "product_name": "<name>", "listed_price": "<price>", "estimated_fair_price": "<fair price>", "savings_percent": <int>, "reasoning": "<2-3 sentences>", "price_factors": ["<f1>", "<f2>"]}}"""

            result = gl.nondet.exec_prompt(task, response_format="json")

            normalized = {
                "verdict": str(result.get("verdict", "FAIR_PRICE")).strip().upper().replace(" ", "_"),
                "product_name": str(result.get("product_name", "Unknown"))[:200],
                "listed_price": str(result.get("listed_price", "N/A"))[:50],
                "estimated_fair_price": str(result.get("estimated_fair_price", "N/A"))[:50],
                "savings_percent": int(result.get("savings_percent", 0)),
                "reasoning": str(result.get("reasoning", ""))[:500],
                "price_factors": sorted([str(f).strip().lower() for f in result.get("price_factors", [])][:5]),
            }
            return json.dumps(normalized, sort_keys=True)

        result_str = gl.eq_principle.strict_eq(nondet_block)
        result = json.loads(result_str)
        verdict = result.get("verdict", "FAIR_PRICE")

        record = {
            "id": int(check_id),
            "url": product_url,
            "category": category,
            "submitter": "",
            "verdict": verdict,
            "product_name": result.get("product_name", "Unknown"),
            "listed_price": result.get("listed_price", "N/A"),
            "estimated_fair_price": result.get("estimated_fair_price", "N/A"),
            "savings_percent": result.get("savings_percent", 0),
            "reasoning": result.get("reasoning", ""),
            "price_factors": result.get("price_factors", []),
        }

        self.checks[check_id] = json.dumps(record)
        self.total_checks += 1

        if verdict == "GREAT_DEAL":
            self.total_great_deals += 1
        elif verdict == "FAIR_PRICE":
            self.total_fair += 1
        elif verdict == "OVERPRICED":
            self.total_overpriced += 1
        elif verdict == "SCAM_ALERT":
            self.total_scams += 1

        pass

        return result

    # ═══════════════════════════════════════
    #  MANUAL PRICE CHECK
    # ═══════════════════════════════════════

    @gl.public.write
    def check_price_manual(self, product_name: str, listed_price: str, store_name: str, category: str) -> dict:
        if not product_name or not listed_price:
            raise Rollback("Product name and price are required")

        check_id = self.total_checks

        def nondet_block():
            task = f"""You are PriceGuard, an expert AI price analyst.

TASK: A user found a product and wants to know if the price is fair.

PRODUCT: {product_name}
LISTED PRICE: {listed_price}
STORE: {store_name}
CATEGORY: {category}

STEPS:
1. What is typical retail price for "{product_name}"?
2. How does {listed_price} compare?
3. Any suspicious indicators?

VERDICT:
- "GREAT_DEAL": 20%+ below market
- "FAIR_PRICE": Within ±15% of market
- "OVERPRICED": 20%+ above market
- "SCAM_ALERT": Suspiciously low or scam indicators

Return ONLY JSON:
{{"verdict": "GREAT_DEAL"|"FAIR_PRICE"|"OVERPRICED"|"SCAM_ALERT", "product_name": "{product_name}", "listed_price": "{listed_price}", "estimated_fair_price": "<estimate>", "savings_percent": <int>, "reasoning": "<2-3 sentences>", "price_factors": ["<f1>", "<f2>"]}}"""

            result = gl.nondet.exec_prompt(task, response_format="json")

            normalized = {
                "verdict": str(result.get("verdict", "FAIR_PRICE")).strip().upper().replace(" ", "_"),
                "product_name": str(result.get("product_name", product_name))[:200],
                "listed_price": str(result.get("listed_price", listed_price))[:50],
                "estimated_fair_price": str(result.get("estimated_fair_price", "N/A"))[:50],
                "savings_percent": int(result.get("savings_percent", 0)),
                "reasoning": str(result.get("reasoning", ""))[:500],
                "price_factors": sorted([str(f).strip().lower() for f in result.get("price_factors", [])][:5]),
            }
            return json.dumps(normalized, sort_keys=True)

        result_str = gl.eq_principle.strict_eq(nondet_block)
        result = json.loads(result_str)
        verdict = result.get("verdict", "FAIR_PRICE")

        record = {
            "id": int(check_id),
            "url": "",
            "category": category,
            "submitter": "",
            "verdict": verdict,
            "product_name": result.get("product_name", product_name),
            "listed_price": result.get("listed_price", listed_price),
            "estimated_fair_price": result.get("estimated_fair_price", "N/A"),
            "savings_percent": result.get("savings_percent", 0),
            "reasoning": result.get("reasoning", ""),
            "price_factors": result.get("price_factors", []),
            "store_name": store_name,
        }

        self.checks[check_id] = json.dumps(record)
        self.total_checks += 1

        if verdict == "GREAT_DEAL":
            self.total_great_deals += 1
        elif verdict == "FAIR_PRICE":
            self.total_fair += 1
        elif verdict == "OVERPRICED":
            self.total_overpriced += 1
        elif verdict == "SCAM_ALERT":
            self.total_scams += 1

        pass

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
            "scam_rate": round((int(self.total_scams) / total) * 100, 1),
        }

    @gl.public.view
    def get_user_stats(self, user: Address) -> dict:
        try:
            checks = int(self.user_checks[user])
        except:
            checks = 0
        return {"checks": checks}
