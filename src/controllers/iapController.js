const { IstekharaQuota } = require("../models");
const { ValidationError } = require("../middleware/errorHandler");
const { MOBILE_PRODUCTS } = require("../config/mobileProducts");
const { buildQuotaData } = require("../utils/buildQuotaData");
const { verifyAppleReceipt } = require("../services/appleIAP");
const { verifyGooglePurchase } = require("../services/googleIAP");
const { sendEmail } = require("../services/email");

exports.validateIAP = async (req, res, next) => {
  try {
    const { platform, productId, purchaseToken, receipt } = req.body;
    const user = req.user;

    // Accept either "purchaseToken" (Flutter convention) or "receipt"
    const token = purchaseToken || receipt;

    if (!platform || !productId || !token) {
      throw new ValidationError("Missing required fields: platform, productId, and purchaseToken (or receipt)");
    }

    if (platform !== "ios" && platform !== "android") {
      throw new ValidationError("Invalid platform. Must be 'ios' or 'android'");
    }

    const product = MOBILE_PRODUCTS[productId];
    if (!product) {
      throw new ValidationError(`Invalid product ID: ${productId}`);
    }

    let referenceId;

    // ── iOS (App Store) Verification ──
    if (platform === "ios") {
      const appleRes = await verifyAppleReceipt(token);

      // status 0 = valid receipt
      if (appleRes.status !== 0) {
        throw new ValidationError(`Invalid Apple receipt. Status: ${appleRes.status}`);
      }

      const latestInfo = appleRes.latest_receipt_info?.[0];
      referenceId = latestInfo?.transaction_id;

      if (!referenceId) {
        throw new ValidationError("No transaction ID found in Apple receipt");
      }

      // For subscriptions, check expiry
      if (product.recurring && latestInfo?.expires_date_ms) {
        const expiryDate = new Date(parseInt(latestInfo.expires_date_ms));
        if (expiryDate < new Date()) {
          throw new ValidationError("Subscription has expired");
        }
      }

      // Check for duplicate Apple transaction
      const existingQuota = await IstekharaQuota.findOne({
        where: { apple_transaction_id: referenceId }
      });
      if (existingQuota) {
        throw new ValidationError("This purchase has already been processed");
      }
    }

    // ── Android (Google Play) Verification ──
    if (platform === "android") {
      const googleRes = await verifyGooglePurchase(productId, token, product.recurring);

      if (product.recurring) {
        // Subscription: paymentState 1 = received 
        if (googleRes.paymentState !== 1) {
          throw new ValidationError("Payment not completed");
        }
        // Check subscription expiry
        if (googleRes.expiryTimeMillis) {
          const expiryDate = new Date(parseInt(googleRes.expiryTimeMillis));
          if (expiryDate < new Date()) {
            throw new ValidationError("Subscription has expired");
          }
        }
      } else {
        // One-time product: purchaseState 0 = purchased
        // 0: Purchased, 1: Canceled, 2: Pending
        if (googleRes.purchaseState !== 0) {
          throw new ValidationError(`Purchase not completed. Status: ${googleRes.purchaseState} (0=Purchased, 1=Canceled, 2=Pending)`);
        }
        if (googleRes.purchaseState === 1) {
          throw new ValidationError(`Purchase was cancelled. Reason: ${googleRes.cancelReason || 'Unknown'}`);
        }
      }

      referenceId = token;

      // Check for duplicate Google purchase
      const existingQuota = await IstekharaQuota.findOne({
        where: { google_purchase_token: referenceId }
      });
      if (existingQuota) {
        throw new ValidationError("This purchase has already been processed");
      }
    }

    const quotaData = buildQuotaData({
      user,
      quantity: product.quantity,
      amount: product.amount,
      currency: product.currency,
      recurring: product.recurring,
      recurring_interval: product.recurring_interval
    });

    // Add IAP-specific fields
    if (platform === "ios") {
      quotaData.apple_transaction_id = referenceId;
    } else {
      quotaData.google_purchase_token = referenceId;
    }

    const quota = await IstekharaQuota.create(quotaData);

    // Send confirmation email
    try {
      await sendEmail(
        user.email,
        `IstekharaNow transaction of $${(quota.amount / 100).toFixed(2)} successful`,
        getPurchaseSuccessEmailHTML(quota)
      );
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ success: true, quota });
  } catch (err) {
    next(err);
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
