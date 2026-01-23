const { User, Alim, IstekharaQuota, ContactForm } = require('../models');
const { ValidationError } = require('../middleware/errorHandler');
const { sendEmail } = require('../services/email');
const stripe = require('stripe')(process.env.STRIPE_API_KEY);

// Get user profile
exports.getProfile = async (req, res, next) => {
  try {
    const userType = req.user.user_type;

    if (userType === 'user') {
      const user = await User.findByPk(req.user.id);
      return res.json(user);
    } else if (userType === 'alim') {
      const alim = await Alim.findByPk(req.user.id);
      return res.json(alim);
    } else if (userType === 'admin') {
      return res.json({
        name: 'Istekhara Admin',
        email: req.user.email
      });
    }
  } catch (error) {
    next(error);
  }
};

// Get application settings
exports.getSettings = async (req, res, next) => {
  try {
    const settings = {
      istekhara_types: [
        { title: 'Business' },
        { title: 'Employment' },
        { title: 'Travel' },
        { title: 'Marriage' },
        { title: 'Real Estate/Home' }
      ]
    };

    res.json(settings);
  } catch (error) {
    next(error);
  }
};

// Upload file to S3
exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    // File is already uploaded to S3 by multer-s3
    res.json({
      url: req.file.location,
      key: req.file.key,
      bucket: req.file.bucket
    });
  } catch (error) {
    next(error);
  }
};

// Contact form submission
exports.contactForm = async (req, res, next) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      throw new ValidationError('Name, email, and message are required');
    }

    // Save to database
    const contactForm = await ContactForm.create({
      name,
      email,
      message
    });

    // Send email notification
    try {
      await sendEmail(
        process.env.ISTEKHARA_MAIL_ID,
        'New Form Submission',
        getContactFormEmailHTML(name, email, message)
      );
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    res.json({
      message: 'Contact form submitted successfully',
      data: contactForm
    });
  } catch (error) {
    next(error);
  }
};

// Renew authentication token
exports.renewToken = async (req, res, next) => {
  try {
    const { refresh_token, user_type = 'user' } = req.body;

    if (!refresh_token) {
      throw new ValidationError('Refresh token is required');
    }

    // This would typically call Cognito to refresh the token
    // For now, return a placeholder response
    res.json({
      message: 'Token renewal not yet implemented',
      note: 'Implement Cognito token refresh using AWS SDK'
    });
  } catch (error) {
    next(error);
  }
};

// Stripe webhook handler
exports.stripeWebhook = async (req, res, next) => {
  try {
    const event = req.body;

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Find quota by session ID
      const quota = await IstekharaQuota.findOne({
        where: { stripe_session_id: session.id }
      });

      if (quota) {
        const updateData = {
          success: true
        };

        // Set expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365);
        updateData.expires_at = expiresAt;

        // Add subscription ID if present
        if (session.subscription) {
          updateData.stripe_subscription_id = session.subscription;
        }

        await quota.update(updateData);

        // Get user and send confirmation email
        const user = await User.findByPk(quota.user_id);
        if (user) {
          try {
            await sendEmail(
              user.email,
              `IstekharaNow transaction of $${(quota.amount / 100).toFixed(2)} successful`,
              getPurchaseSuccessEmailHTML(quota)
            );
          } catch (emailError) {
            console.error('Email sending error:', emailError);
          }
        }
      }
    }

    // Handle invoice.paid event (for subscriptions)
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;

      // Find quota by subscription ID
      const quota = await IstekharaQuota.findOne({
        where: { stripe_subscription_id: invoice.subscription }
      });

      if (quota) {
        // Check if this is a new billing period
        const today = new Date();
        const lastUpdate = new Date(quota.updated_at);
        const isSameDay = today.toDateString() === lastUpdate.toDateString();

        if (!isSameDay) {
          // Create new quota entry for the new billing period
          const newQuota = await IstekharaQuota.create({
            quantity: quota.quantity,
            amount: quota.amount,
            currency: quota.currency,
            description: `Subscription payment of ${quota.quantity} Istekharas for the month ${today.toLocaleString('default', { month: 'long' })}`,
            user_id: quota.user_id,
            recurring: quota.recurring,
            recurring_interval: quota.recurring_interval,
            success: true,
            stripe_subscription_id: invoice.subscription,
            expires_at: new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000)
          });

          // Send confirmation email
          const user = await User.findByPk(quota.user_id);
          if (user) {
            try {
              await sendEmail(
                user.email,
                `IstekharaNow transaction of $${(newQuota.amount / 100).toFixed(2)} successful`,
                getPurchaseSuccessEmailHTML(newQuota)
              );
            } catch (emailError) {
              console.error('Email sending error:', emailError);
            }
          }
        }
      }
    }

    res.json({ message: 'OK' });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    next(error);
  }
};

// PayPal webhook handler
exports.paypalWebhook = async (req, res, next) => {
  try {
    const event = req.body;
    const eventType = event.event_type;

    console.log('PayPal webhook event:', eventType);

    // Handle order payment captured
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id;

      if (orderId) {
        const quota = await IstekharaQuota.findOne({
          where: { paypal_order_id: orderId }
        });

        if (quota) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 365);

          await quota.update({
            success: true,
            expires_at: expiresAt
          });

          console.log('PayPal order payment processed:', quota.id);
        }
      }
    }

    // Handle subscription payment completed
    if (eventType === 'PAYMENT.SALE.COMPLETED') {
      const billingAgreementId = event.resource?.billing_agreement_id;

      if (billingAgreementId) {
        const quota = await IstekharaQuota.findOne({
          where: { paypal_subscription_id: billingAgreementId }
        });

        if (quota) {
          const today = new Date();
          const lastUpdate = new Date(quota.updated_at);
          const isSameDay = today.toDateString() === lastUpdate.toDateString();

          if (!isSameDay) {
            // Create new quota entry for the new billing period
            await IstekharaQuota.create({
              quantity: quota.quantity,
              amount: quota.amount,
              currency: quota.currency,
              description: `Subscription payment of ${quota.quantity} Istekharas for the month ${today.toLocaleString('default', { month: 'long' })}`,
              user_id: quota.user_id,
              recurring: quota.recurring,
              recurring_interval: quota.recurring_interval,
              success: true,
              paypal_subscription_id: billingAgreementId,
              expires_at: new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000)
            });
          } else {
            // Update existing quota
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 365);

            await quota.update({
              success: true,
              expires_at: expiresAt
            });
          }

          console.log('PayPal subscription payment processed');
        }
      }
    }

    res.json({ message: 'OK' });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    next(error);
  }
};

// Email templates
function getContactFormEmailHTML(name, email, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Form Submission</title>
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
              <h2 style="color: #555555; font-size: 24px;">New Contact Form Submission</h2>
              <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                <strong>Name:</strong> ${name}<br>
                <strong>Email:</strong> ${email}<br><br>
                <strong>Message:</strong><br>
                ${message}
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
