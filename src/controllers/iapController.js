const { IstekharaQuota } = require("../models");
const { ValidationError } = require("../middleware/errorHandler");
const { MOBILE_PRODUCTS } = require("../config/mobileProducts");
const { buildQuotaData } = require("../utils/buildQuotaData");
const { verifyAppleReceipt } = require("../services/appleIAP");
const { verifyGooglePurchase } = require("../services/googleIAP");
const { sendEmail } = require("../services/email");

exports.validateIAP = async (req, res, next) => {
  try {
    const { platform, productId, receipt } = req.body;
    const user = req.user;

    if (!platform || !productId || !receipt) {
      throw new ValidationError("Missing required fields");
    }

    if (platform !== "ios" && platform !== "android") {
      throw new ValidationError("Invalid platform. Must be 'ios' or 'android'");
    }

    const product = MOBILE_PRODUCTS[productId];
    if (!product) {
      throw new ValidationError("Invalid product ID");
    }

    let referenceId;

    if (platform === "ios") {
      const appleRes = await verifyAppleReceipt(receipt);
      if (appleRes.status !== 0) {
        throw new ValidationError(`Invalid Apple receipt. Status: ${appleRes.status}`);
      }
      referenceId = appleRes.latest_receipt_info?.[0]?.transaction_id;
      
      if (!referenceId) {
        throw new ValidationError("No transaction ID found in Apple receipt");
      }

      // Check for duplicate Apple transaction
      const existingQuota = await IstekharaQuota.findOne({
        where: { apple_transaction_id: referenceId }
      });
      if (existingQuota) {
        throw new ValidationError("This purchase has already been processed");
      }
    }

    if (platform === "android") {
      const googleRes = await verifyGooglePurchase(productId, receipt);
      if (googleRes.paymentState !== 1) {
        throw new ValidationError("Payment not completed");
      }
      referenceId = receipt;

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
