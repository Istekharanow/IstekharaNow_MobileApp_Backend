const { IstekharaQuota } = require('../models');

/**
 * Calculates the accurate quota balance for a user.
 * 
 * Handles:
 * 1. Unlimited subscriptions/purchases (quantity === 0)
 * 2. Expiration of purchases (expires_at < now)
 * 3. Accurate ledger deduction for redemptions (quantity < 0)
 * 
 * @param {number} userId 
 * @returns {Promise<{ remaining: number, total_purchased: number|string, total_used: number, is_unlimited: boolean, user_id: number }>}
 */
async function calculateUserQuota(userId) {
  const now = new Date();

  // Fetch all successful transactions for the user, ordered chronologically
  const allRecords = await IstekharaQuota.findAll({
    where: {
      user_id: userId,
      success: true
    },
    order: [['created_at', 'ASC']]
  });

  let totalUsedLifetime = 0;
  let hasActiveUnlimited = false;
  const purchases = [];

  for (const record of allRecords) {
    const qty = parseInt(record.quantity, 10);
    const isExpired = record.expires_at && new Date(record.expires_at) < now;

    if (qty === 0 || record.quantity === '0') {
      // Unlimited quota entry
      if (!isExpired) {
        hasActiveUnlimited = true;
      }
    } else if (qty > 0) {
      // Regular purchase entry
      // If purchase is expired, usable remaining capacity is 0
      const usableQuantity = isExpired ? 0 : qty;
      purchases.push({
        id: record.id,
        quantity: qty,
        remaining: usableQuantity,
        expires_at: record.expires_at,
        is_expired: isExpired
      });
    } else if (qty < 0) {
      // Redemption entry
      const usedAmount = Math.abs(qty);
      totalUsedLifetime += usedAmount;

      // Deduct usage sequentially from active available purchases
      let amountToDeduct = usedAmount;

      for (let i = 0; i < purchases.length && amountToDeduct > 0; i++) {
        const p = purchases[i];
        if (!p.is_expired && p.remaining > 0) {
          const deduct = Math.min(p.remaining, amountToDeduct);
          p.remaining -= deduct;
          amountToDeduct -= deduct;
        }
      }
    }
  }

  if (hasActiveUnlimited) {
    return {
      remaining: 999999,
      total_purchased: 'Unlimited',
      total_used: totalUsedLifetime,
      is_unlimited: true,
      user_id: userId
    };
  }

  let remaining = 0;
  let totalPurchasedActive = 0;

  for (const p of purchases) {
    if (!p.is_expired) {
      remaining += p.remaining;
      totalPurchasedActive += p.quantity;
    }
  }

  remaining = Math.max(0, remaining);

  return {
    remaining: remaining,
    total_purchased: totalPurchasedActive,
    total_used: totalUsedLifetime,
    is_unlimited: false,
    user_id: userId
  };
}

module.exports = {
  calculateUserQuota
};
