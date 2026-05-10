export type Verdict =
  | "GREAT_DEAL"
  | "FAIR_PRICE"
  | "OVERPRICED"
  | "SCAM_ALERT"
  | "INSUFFICIENT_DATA";

export interface PriceCheck {
  id: number | string;
  url?: string;
  category: string;
  submitter: string;
  verdict: Verdict;
  /** Confidence the AI assigned to its verdict, 0-100. Returned by the
   *  contract starting in the multi-source revision; older records may not
   *  have this field — frontend defaults it to 50 when missing. */
  confidence?: number;
  product_name: string;
  listed_price: number;
  estimated_fair_price: number;
  savings_percent: number;
  reasoning: string;
  price_factors: string[];
  store_name?: string;
  timestamp?: number;
}

export interface Stats {
  total_checks: number;
  total_great_deals: number;
  total_fair: number;
  total_overpriced: number;
  total_scams: number;
  /** Number of checks that returned INSUFFICIENT_DATA — i.e. AI couldn't
   *  determine product/price (page blocked, search captcha'd, etc.). */
  total_insufficient?: number;
  scam_rate: number;
}