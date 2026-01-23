module.exports.buildQuotaData = ({
  user,
  quantity,
  amount,
  currency,
  recurring,
  recurring_interval
}) => {
  const isUnlimited = String(quantity) === "0";

  const quotaData = {
    user_id: user.id,
    quantity,
    amount,
    currency,
    success: true,
    recurring: Boolean(recurring),
    description: ""
  };

  // Set expires_at based on Python logic
  if (isUnlimited) {
    // Unlimited quotas expire in 2 years
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 730);
    quotaData.expires_at = expiresAt;
  } else if (recurring) {
    // Recurring subscriptions expire in 1 year
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);
    quotaData.expires_at = expiresAt;
  }
  // One-time purchases don't set expires_at (NULL) - matches Stripe behavior

  if (recurring) {
    quotaData.recurring_interval = recurring_interval;
    quotaData.description =
      `Subscription payment of ${isUnlimited ? "∞" : quantity} Istekharas for the month ` +
      new Date().toLocaleString("default", { month: "long" });
  } else {
    quotaData.description =
      `Purchase of ${isUnlimited ? "∞" : quantity} Istekhara requests`;
  }

  return quotaData;
};
