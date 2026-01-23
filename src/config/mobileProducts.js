module.exports.MOBILE_PRODUCTS = {
  istekhara_1: {
    quantity: "1",
    recurring: false,
    amount: 199,
    currency: "usd"
  },

  istekhara_monthly_10: {
    quantity: "10",
    recurring: true,
    recurring_interval: "month",
    amount: 699,
    currency: "usd"
  },

  istekhara_yearly_50: {
    quantity: "50",
    recurring: true,
    recurring_interval: "year",
    amount: 2499,
    currency: "usd"
  },

  istekhara_2_year: {
    quantity: "0", // unlimited
    recurring: false,
    amount: 9999,
    currency: "usd"
  }
};
