// Product IDs must match App Store / Play Store exactly.
// Alternate IDs (e.g. "1_istekhara") map to the same config as their canonical form.

const ISTEKHARA_1 = {
  quantity: "1",
  recurring: false,
  amount: 199,
  currency: "usd"
};

const ISTEKHARA_MONTHLY_10 = {
  quantity: "10",
  recurring: true,
  recurring_interval: "month",
  amount: 699,
  currency: "usd"
};

const ISTEKHARA_YEARLY_50 = {
  quantity: "50",
  recurring: true,
  recurring_interval: "year",
  amount: 2499,
  currency: "usd"
};

const ISTEKHARA_UNLIMITED_2Y = {
  quantity: "0", // unlimited
  recurring: false,
  amount: 9999,
  currency: "usd"
};

module.exports.MOBILE_PRODUCTS = {
  // ── Single Istekhara ──
  istekhara_1: ISTEKHARA_1,
  "1_istekhara": ISTEKHARA_1,

  // ── Monthly 10 ──
  istekhara_monthly_10: ISTEKHARA_MONTHLY_10,
  "10_istekhara_monthly": ISTEKHARA_MONTHLY_10,
  "10_istekhara_per_month": ISTEKHARA_MONTHLY_10,

  // ── Yearly 50 ──
  istekhara_yearly_50: ISTEKHARA_YEARLY_50,
  "50_istekhara_yearly": ISTEKHARA_YEARLY_50,
  "50_istekhara_per_year": ISTEKHARA_YEARLY_50,

  // ── Unlimited 2-Year ──
  istekhara_unlimited_2y: ISTEKHARA_UNLIMITED_2Y,
  unlimited_istekhara_2y: ISTEKHARA_UNLIMITED_2Y,
};
