# Test script to verify PriceGuard AI prompt logic
# Run this to see what AI validators would analyze for a given product

SAMPLE_PRODUCTS = [
    {
        "name": "Sony PlayStation 5 Slim Digital Edition",
        "url": "https://www.bestbuy.com/site/sony-playstation-5-slim-console-white/6418599.p",
        "listed_price": "$449.99",
        "store": "Best Buy",
        "category": "electronics",
        "expected_verdict": "FAIR_PRICE",  # MSRP is $449.99
    },
    {
        "name": "Apple AirPods Pro 2nd Generation",
        "url": "https://www.amazon.com/Apple-AirPods-Pro-2nd-Generation/dp/B0BDHWDR12",
        "listed_price": "$29.99",
        "store": "Random Shop",
        "category": "electronics",
        "expected_verdict": "SCAM_ALERT",  # Real price is ~$249
    },
    {
        "name": "Samsung 55\" Crystal UHD 4K Smart TV",
        "url": "https://www.walmart.com/ip/Samsung-55-Class-Crystal-UHD-4K-Smart-TV/592106857",
        "listed_price": "$297.99",
        "store": "Walmart",
        "category": "electronics",
        "expected_verdict": "GREAT_DEAL",  # Normally $400-500
    },
    {
        "name": "Generic USB-C Cable 1ft",
        "url": "https://example-shop.com/cable",
        "listed_price": "$89.99",
        "store": "Example Shop",
        "category": "electronics",
        "expected_verdict": "OVERPRICED",  # Should be $5-15
    },
]


def build_url_prompt(product_url, category, web_data=""):
    """Reconstruct the exact prompt sent to AI validators in check_price"""
    return f"""You are PriceGuard, an expert AI price analyst.

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


def build_manual_prompt(product_name, listed_price, store_name, category):
    """Reconstruct the exact prompt sent to AI validators in check_price_manual"""
    return f"""You are PriceGuard, an expert AI price analyst.

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


def test_manual_check(product):
    print(f"\n{'='*60}")
    print(f"TESTING: {product['name']}")
    print(f"Expected Verdict: {product['expected_verdict']}")
    print(f"{'='*60}")
    prompt = build_manual_prompt(
        product["name"],
        product["listed_price"],
        product["store"],
        product["category"],
    )
    print("\n--- PROMPT SENT TO AI VALIDATORS ---")
    print(prompt)
    print("\n--- EXPECTED JSON OUTPUT ---")
    print(f'{{')
    print(f'  "verdict": "{product["expected_verdict"]}",')
    print(f'  "product_name": "{product["name"]}",')
    print(f'  "listed_price": "{product["listed_price"]}",')
    print(f'  "estimated_fair_price": "<AI estimate>",')
    print(f'  "savings_percent": <AI calculated>,')
    print(f'  "reasoning": "<AI generated explanation>",')
    print(f'  "price_factors": ["<AI factor 1>", "<AI factor 2>"]')
    print(f'}}')
    print(f"\n{'='*60}")


if __name__ == "__main__":
    print("PriceGuard AI Prompt Test Script")
    print("================================")
    print("\nThis script shows the exact prompts sent to GenLayer AI validators")
    print("for different product scenarios. Run this to verify prompt quality.")
    print("\nIn GenLayer Studio, these prompts are executed by multiple AI validators")
    print("who must reach consensus (eq_principle.strict_eq) on the JSON output.")

    for product in SAMPLE_PRODUCTS:
        test_manual_check(product)

    print("\n\n" + "="*60)
    print("To test in GenLayer Studio:")
    print("1. Deploy the contract")
    print("2. Use 'check_price_manual' with the product details above")
    print("3. Check if the AI consensus matches 'expected_verdict'")
    print("="*60)
