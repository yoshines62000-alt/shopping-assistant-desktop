export interface Product {
  id: string;
  name: string;
  totalPrice: number;
  currency: string;
  rating: number | null;
  reviewCount: number | null;
  deliveryDays: number | null;
  siteDomain: string;
  sourceUrl: string;
  seller: string | null;
  imageUrl?: string | null;
  inStock: boolean;
  raw: ProductRaw;
  scores?: ProductScores | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRaw {
  title?: string;
  priceRaw?: string;
  deliveryRaw?: string;
  priceHistory?: number[];
  [key: string]: unknown;
}

export interface ProductScores {
  price: number;
  delivery: number;
  reviews: number;
  site: number;
  popularity: number;
  final: number;
}

export interface SiteReputation {
  domain: string;
  trustScore: number;
  classification: "white" | "grey" | "black";
  httpsValid: boolean;
  domainAgeDays: number;
  hasLegalMentions: boolean;
  lastChecked: Date;
  captchaEncounters: number;
}

export interface PriceHistoryPoint {
  productId: string;
  price: number;
  observedAt: Date;
  connector: string;
}

export interface SearchRequest {
  query: string;
  maxPriceEur: number | null;
  maxDeliveryDays: number | null;
  priority: "price" | "quality" | "speed" | "balanced";
  keywords: string[];
  excludeKeywords: string[];
  weights: ScoringWeights;
}

export interface ScoringWeights {
  price: number;
  delivery: number;
  reviews: number;
  site: number;
  popularity: number;
}

export interface ConnectorRaw {
  title: string;
  priceRaw: string;
  deliveryRaw: string;
  seller: string;
  reviewsRaw: string;
  url: string;
}

export interface ConnectorResult {
  connectorId: string;
  siteDomain: string;
  products: ConnectorRaw[];
  error?: string;
}

export type StockStatus = "in_stock" | "listed" | "sold";

export interface StockItem {
  id: number;
  name: string;
  purchasePrice: number;
  quantity: number;
  remaining: number;
  purchaseDate: string;
  sourceUrl: string;
  estimatedResale: number | null;
  previousEstimate: number | null;
  estimatedAt: string | null;
  status: StockStatus;
  category: string;
  sku: string;
  photos: string[];
  notes: string;
}

export interface FavoriteList {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number;
  count: number;
}

export interface Favorite {
  id: number;
  productId: string;
  name: string;
  price: number;
  siteDomain: string;
  sourceUrl: string;
  imageUrl: string | null;
  seller: string | null;
  rating: number | null;
  reviewCount: number | null;
  deliveryDays: number | null;
  notes: string;
  targetPrice: number | null;
  listIds: number[];
  addedAt: string;
}

export interface Expense {
  id: number;
  label: string;
  amount: number;
  category: string;
  expenseDate: string;
}

export interface AppSettings {
  platformFees: Record<string, number>;
  discordWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  emailFrom: string;
  emailTo: string;
  alertCheckMinutes: number;
  reestimateDays: number;
  weeklyDigestEnabled: boolean;
}

export interface PriceAlert {
  alertId: string;
  userId: string;
  productId: string;
  name?: string | null;
  thresholdPrice: number;
  channels: string[];
  active: boolean;
  triggeredAt: string | null;
}

export interface ProductInfo {
  id: string;
  name: string;
  sourceUrl: string;
  siteDomain: string;
  lastPrice: number | null;
  lastSeen: string | null;
}

export interface Sale {
  id: number;
  itemId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  fees: number;
  platform: string;
  returned: boolean;
  saleDate: string;
  total: number;
}

export interface MonthlyAccounting {
  month: string;
  revenue: number;
  fees: number;
  cost: number;
  profit: number;
  expenses: number;
  profitNet: number;
  salesCount: number;
}

export interface TopProduct {
  name: string;
  profit: number;
  salesCount: number;
}

export interface AccountingSummary {
  investedTotal: number;
  revenueGross: number;
  feesTotal: number;
  costOfSold: number;
  profitRealized: number;
  expensesTotal: number;
  profitNet: number;
  roiPct: number | null;
  avgDaysToSell: number | null;
  topProducts: TopProduct[];
  stockValue: number;
  stockPotentialNet: number;
  itemsInStock: number;
  itemsTotal: number;
  salesCount: number;
  returnedCount: number;
  returnRate: number | null;
  feeRate: number;
  byCategory: CategoryROI[];
  monthly: MonthlyAccounting[];
}

export interface FiscalSummary {
  year: number;
  revenue: number;
  urssafContributions: number;
  urssafRate: number;
  liberatoireOption: number;
  vatFranchise: number;
  vatFranchiseMajored: number;
  vatExceeded: boolean;
  microCeiling: number;
  microCeilingPct: number;
  microExceeded: boolean;
}

export interface CategoryROI {
  category: string;
  profit: number;
  salesCount: number;
  stockValue: number;
  roiPct: number | null;
}

export interface SoldListing {
  title: string;
  price: number;
  url: string;
  imageUrl?: string | null;
}

export interface ResaleEstimate {
  query: string;
  source: string;
  platform?: string;
  /** Présent si la requête était un code-barres résolu en nom de produit. */
  barcode?: string;
  soldListings: SoldListing[];
  sampleCount: number;
  median?: number;
  low?: number;
  high?: number;
  feeRate?: number;
  netEstimate?: number;
  purchasePrice?: number;
  estimatedProfit?: number;
  marginPct?: number;
  /** Fiabilité de l'estimation (échantillon + dispersion). */
  confidenceScore?: number;
  confidenceLabel?: "faible" | "moyenne" | "élevée";
  /** Vélocité de revente, calculée depuis les dates de ventes conclues. */
  salesPer30d?: number;
  avgDaysBetweenSales?: number;
  velocityLabel?: "lent" | "moyen" | "rapide";
}

export interface DealResale {
  median?: number;
  netEstimate?: number;
  marginEur?: number;
  marginPct?: number | null;
  sampleCount?: number;
  platform?: string;
}

/** Une offre trouvée + son estimation de revente (chasse aux bonnes affaires). */
export interface Deal {
  id: string;
  name: string;
  totalPrice: number;
  currency?: string;
  siteDomain: string;
  sourceUrl: string;
  seller?: string | null;
  imageUrl?: string | null;
  deliveryDays?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  scores?: ProductScores | null;
  resale: DealResale | null;
}

export interface DealsResponse {
  query: string;
  platform: string;
  deals: Deal[];
  sources_queried: string[];
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  price: 0.40,
  delivery: 0.20,
  reviews: 0.20,
  site: 0.10,
  popularity: 0.10,
};

export interface IntentParams {
  query?: string;
  minPriceEur?: number | null;
  maxPriceEur?: number | null;
  maxDeliveryDays?: number | null;
  minRating?: number | null;
  priority?: "price" | "quality" | "speed" | "balanced";
  weights?: ScoringWeights;
  keywords?: string[];
  excludeKeywords?: string[];
  /** Filtre site marchand (amazon|ebay|vinted), appliqué côté recherche. */
  site?: string;
}

export interface ArbitrageOffer {
  id: string;
  name: string;
  totalPrice: number;
  siteDomain: string;
  sourceUrl: string;
  imageUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
}

export interface ArbitragePair {
  name: string;
  buy: ArbitrageOffer;
  sell: ArbitrageOffer;
  marginEur: number;
  marginPct: number;
  feeRate: number;
}

export interface ArbitrageResponse {
  query: string;
  minMarginPct: number;
  pairs: ArbitragePair[];
  sources_queried: string[];
}