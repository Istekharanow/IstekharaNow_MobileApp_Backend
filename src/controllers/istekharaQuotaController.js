const { IstekharaQuota, User, Istekhara } = require('../models');
const { ValidationError } = require('../middleware/errorHandler');
const { sendEmail } = require('../services/email');
const stripe = require('stripe')(process.env.STRIPE_API_KEY);
const { Op } = require('sequelize');

// Get pricing list from Stripe
exports.getPricingList = async (req, res, next) => {
  try {
    const priceList = [];
    const seenProducts = new Set();
    const validQuantities = new Set(['1', '10', '50', '0']);

    // Fetch active prices from Stripe
    const stripePrices = await stripe.prices.list({
      active: true,
      expand: ['data.product']
    });

    for (const price of stripePrices.data) {
      const product = price.product;
      const metadata = product.metadata || {};

      if (!product.active) continue;

      const quantity = metadata.quantity;
      if (!validQuantities.has(quantity)) continue;

      const productKey = product.name.trim().toLowerCase();
      if (seenProducts.has(productKey)) continue;
      seenProducts.add(productKey);

      let recurring = false;
      let recurringInterval = null;
      let paypalPlanId = null;

      if (metadata.recurring) {
        recurring = true;
        recurringInterval = metadata.recurring_interval;
        paypalPlanId = metadata.paypal_plan_id;
      }

      priceList.push({
        id: price.id,
        currency: price.currency,
        amount: price.unit_amount,
        product_id: product.id,
        name: product.name,
        description: product.description,
        quantity: quantity,
        recurring: recurring,
        recurring_interval: recurringInterval,
        paypal_plan_id: paypalPlanId
      });
    }
    res.json(priceList);
  } catch (error) {
    // next(error);
    console.error('Error fetching pricing list:', error);
    res.status(500).json({ error: 'Failed to fetch pricing list' });
  }
};

// Purchase quota
exports.purchaseQuota = async (req, res, next) => {
  try {
    const {
      payment_provider = 'stripe',
      pricing_id,
      success_url = 'https://example.com?success=true',
      cancel_url = 'https://example.com?canceled=true',
      paypal_subscription_id,
      paypal_order_id
    } = req.body;

    if (!pricing_id) {
      throw new ValidationError('Pricing ID is required');
    }

    const user = req.user;

    // Get price details from Stripe
    const price = await stripe.prices.retrieve(pricing_id, {
      expand: ['product']
    });
    const product = price.product;
    const quantity = product.metadata.quantity;
    const isRecurring = product.metadata.recurring;
    const isUnlimited = String(quantity) === '0' || parseInt(quantity) === 0;

    if (payment_provider === 'stripe') {
      const paymentMode = isRecurring ? 'subscription' : 'payment';

      // Create quota entry
      const quotaData = {
        quantity: quantity,
        amount: price.unit_amount,
        currency: price.currency,
        user_id: user.id,
        success: false,
        recurring: Boolean(isRecurring)
      };

      if (isRecurring) {
        quotaData.recurring_interval = product.metadata.recurring_interval;
        quotaData.description = `Subscription payment of ${isUnlimited ? '∞' : quantity} Istekharas for the month ${new Date().toLocaleString('default', { month: 'long' })}`;
      } else {
        quotaData.description = `Purchase of ${isUnlimited ? '∞' : quantity} Istekhara requests`;
      }

      if (isUnlimited) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 730); // 2 years
        quotaData.expires_at = expiresAt;
      }

      const newQuota = await IstekharaQuota.create(quotaData);

      // Create Stripe checkout session
      const checkoutSession = await stripe.checkout.Session.create({
        line_items: [{
          price: pricing_id,
          quantity: 1
        }],
        payment_method_types: ['card'],
        mode: paymentMode,
        success_url: success_url,
        cancel_url: cancel_url
      });

      // Update quota with session ID
      await newQuota.update({ stripe_session_id: checkoutSession.id });

      res.json(checkoutSession);
    } else if (payment_provider === 'paypal') {
      // PayPal payment - mark as successful immediately
      const quotaData = {
        quantity: quantity,
        amount: price.unit_amount,
        currency: price.currency,
        user_id: user.id,
        success: true,
        recurring: Boolean(isRecurring)
      };

      if (isRecurring) {
        quotaData.recurring_interval = product.metadata.recurring_interval;
        quotaData.paypal_subscription_id = paypal_subscription_id;
        quotaData.description = `Subscription payment of ${isUnlimited ? '∞' : quantity} Istekharas for the month ${new Date().toLocaleString('default', { month: 'long' })}`;
        
        if (!isUnlimited) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 365);
          quotaData.expires_at = expiresAt;
        }
      } else {
        quotaData.paypal_order_id = paypal_order_id;
        quotaData.description = `Purchase of ${isUnlimited ? '∞' : quantity} Istekhara requests`;
        
        if (!isUnlimited) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 365);
          quotaData.expires_at = expiresAt;
        }
      }

      if (isUnlimited) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 730);
        quotaData.expires_at = expiresAt;
      }

      const newQuota = await IstekharaQuota.create(quotaData);

      // Send confirmation email
      try {
        await sendEmail( 
          user.email,
          `IstekharaNow transaction of $${(newQuota.amount / 100).toFixed(2)} successful`,
          getPurchaseSuccessEmailHTML(newQuota)
        );
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }

      res.json(newQuota);
    } else {
      throw new ValidationError('Payment provider not supported');
    }
  } catch (error) {
    next(error);
  }
};

// List user quotas
exports.listQuotas = async (req, res, next) => {
  try {
    const requestedUser = req.user.user_type;
    const { subscription } = req.query;
    // console.log('Listing quotas for user type:', requestedUser, 'with subscription filter:', subscription);

    let quotas;

    if (requestedUser === 'user') {
      const whereClause = {
        user_id: req.user.id,
        success: true
      };

      if (subscription === 'true') {
        whereClause.recurring = true;
      } else {
        whereClause.recurring = false;
      }

      quotas = await IstekharaQuota.findAll({
        where: whereClause,
        include: [
          { model: User, as: 'user' },
          { model: Istekhara, as: 'istekhara_request' }
        ],
        order: [['created_at', 'DESC']]
      });
    } else if (requestedUser === 'admin') {
      quotas = await IstekharaQuota.findAll({
        where: {
          success: true,
          redeem: false,
          amount: { [Op.gt]: 0 }
        },
        include: [
          { model: User, as: 'user' },
          { model: Istekhara, as: 'istekhara_request' }
        ],
        order: [['created_at', 'DESC']]
      });
    }

    res.json(quotas);
  } catch (error) {
    next(error);
  }
};

// Get remaining quota balance
exports.getRemainingQuota = async (req, res, next) => {
  try {
    const user = req.user;

    // Calculate quota balance (ledger-based)
    const quotaBalance = await IstekharaQuota.sum('quantity', {
      where: {
        user_id: user.id,
        success: true,
        expires_at: {
          [Op.or]: [
            { [Op.gte]: new Date() },
            { [Op.is]: null }
          ]
        }
      }
    });

    // Get total purchased (positive quantities)
    const totalPurchased = await IstekharaQuota.sum('quantity', {
      where: {
        user_id: user.id,
        success: true,
        quantity: { [Op.gt]: 0 },
        expires_at: {
          [Op.or]: [
            { [Op.gte]: new Date() },
            { [Op.is]: null }
          ]
        }
      }
    });

    // Get total used (negative quantities)
    const totalUsed = await IstekharaQuota.sum('quantity', {
      where: {
        user_id: user.id,
        success: true,
        quantity: { [Op.lt]: 0 },
        redeem: true
      }
    });

    res.json({
      remaining: quotaBalance || 0,
      total_purchased: totalPurchased || 0,
      total_used: Math.abs(totalUsed || 0),
      user_id: user.id
    });
  } catch (error) {
    next(error);
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;

    const quota = await IstekharaQuota.findByPk(id);

    if (!quota) {
      throw new ValidationError('Quota not found');
    }

    if (quota.user_id !== req.user.id) {
      throw new ValidationError('You are not authorized to cancel this subscription');
    }

    if (!quota.stripe_session_id) {
      throw new ValidationError('Subscription not found');
    }

    // Get Stripe session
    const stripeSession = await stripe.checkout.Session.retrieve(quota.stripe_session_id, {
      expand: ['subscription']
    });

    if (!stripeSession.subscription) {
      throw new ValidationError('Subscription not found');
    }

    // Cancel subscription at period end
    await stripe.subscriptions.update(stripeSession.subscription.id, {
      cancel_at_period_end: true
    });

    res.json({ message: 'Subscription canceled' });
  } catch (error) {
    next(error);
  }
};



// Email template for purchase success
function getPurchaseSuccessEmailHTML(quota) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 20px;">
              <h1 style="color: #509550; font-size: 36px; margin: 0;">IstekharaNow</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; border-top: 1px solid #bbbbbb;">
              <h2 style="color: #555555; font-size: 24px; text-align: center;">Thank you for the purchase!</h2>
              <p style="color: #555555; font-size: 16px; text-align: center; line-height: 1.5;">
                Your ${quota.description} was successful.<br><br>
                Transaction of $${(quota.amount / 100).toFixed(2)} is completed.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = exports;
