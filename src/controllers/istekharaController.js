const { Istekhara, IstekharaQuota, User, Alim, Testimonial } = require('../models');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { sendEmail } = require('../services/email');
const { getQuranData } = require('../utils/quran');
const { Op } = require('sequelize');

// List istekharas (filtered by user type)
exports.listIstekharas = async (req, res, next) => {
  try {
    const requestedUser = req.user.user_type;
    const { inbox, replied } = req.query;
    let items;

    if (requestedUser === 'user') {
      if (inbox === 'true') {
        // User inbox: only replied and not opened
        items = await Istekhara.findAll({
          where: {
            user_id: req.user.id,
            opened_by_user: false,
            replied_by_id: { [Op.ne]: null }
          },
          include: [
            { model: User, as: 'user' },
            { model: Alim, as: 'replied_by' }
          ],
          order: [['created_at', 'DESC']]
        });
      } else {
        // All user's istekharas
        items = await Istekhara.findAll({
          where: { user_id: req.user.id },
          include: [
            { model: User, as: 'user' },
            { model: Alim, as: 'replied_by' }
          ],
          order: [['created_at', 'DESC']]
        });
      }
    } else if (requestedUser === 'alim') {
      if (replied === 'true') {
        // Alim's replied istekharas
        items = await Istekhara.findAll({
          where: { replied_by_id: req.user.id },
          include: [
            { model: User, as: 'user' },
            { model: Alim, as: 'replied_by' }
          ],
          order: [['created_at', 'DESC']]
        });
      } else {
        // Pending istekharas (not replied)
        items = await Istekhara.findAll({
          where: { replied_by_id: null },
          include: [
            { model: User, as: 'user' },
            { model: Alim, as: 'replied_by' }
          ],
          order: [['created_at', 'ASC']]
        });
      }
    }

    res.json(items);
  } catch (error) {
    next(error);
  }
};

// Get single istekhara
exports.getIstekhara = async (req, res, next) => {
  try {
    const { request_id } = req.params;
    const requestedUser = req.user.user_type;
    let item;

    if (requestedUser === 'user') {
      item = await Istekhara.findOne({
        where: {
          id: request_id,
          user_id: req.user.id
        },
        include: [
          { model: User, as: 'user' },
          { model: Alim, as: 'replied_by' }
        ]
      });
    } else if (requestedUser === 'alim') {
      item = await Istekhara.findByPk(request_id, {
        include: [
          { model: User, as: 'user' },
          { model: Alim, as: 'replied_by' }
        ]
      });
    }

    if (!item) {
      throw new NotFoundError('Istekhara not found');
    }

    // Get Quran data if replied
    let ayahText = '';
    let quranUrl = '';
    if (item.replied_by_id) {
      [ayahText, quranUrl] = getQuranData(item.surah, item.ayah);
      
      // Mark as opened by user
      if (requestedUser === 'user' && !item.opened_by_user) {
        await item.update({ opened_by_user: true });
      }
    }

    const response = item.toJSON();
    response.ayah_text = ayahText;
    response.quran_url = quranUrl;

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Create new istekhara request
exports.createIstekhara = async (req, res, next) => {
  try {
    const user = req.user;
    const { istekhara_type, language } = req.body;

    // Get all alim emails
    const alims = await Alim.findAll();
    const alimEmails = [process.env.ALIM_MAIL_ID];
    alims.forEach(alim => alimEmails.push(alim.email));

    // Check quota remaining // Check quota balance (ledger-based)
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

    if (!quotaBalance || quotaBalance <= 0) {
      throw new ValidationError('Please purchase a pack to create a new request.');
    }


    // Create used quota entry
    const usedQuota = await IstekharaQuota.create({
      quantity: -1,
      description: 'Redeemed for a new request',
      user_id: user.id,
      success: true,
      redeem: true
    });

    // Create istekhara
    const newIstekhara = await Istekhara.create({
      istekhara_type: istekhara_type || '',
      language: language || null,
      user_id: user.id,
      quota_used_id: usedQuota.id
    });

    // Get full istekhara with relations
    const istekhara = await Istekhara.findByPk(newIstekhara.id, {
      include: [
        { model: User, as: 'user' },
        { model: Alim, as: 'replied_by' }
      ]
    });

    // Send emails
    try {
      const totalCount = await Istekhara.count();
      const userWebDomain = process.env.USER_WEB_DOMAIN_NAME || 'http://localhost:3000';

      // Email to user
      await sendEmail(
        user.email,
        'Istekhara request received',
        getIstekharaReceivedEmailHTML(istekhara.id, userWebDomain)
      );

      // Email to admin
      await sendEmail(
        process.env.ISTEKHARA_MAIL_ID,
        `#${totalCount} Istekhara request received`,
        getNewIstekharaEmailHTML()
      );

      // Email to alims
      await sendEmail(
        alimEmails,
        `#${totalCount} Istekhara request received`,
        getNewIstekharaEmailHTML()
      );
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the request if email fails
    }

    res.json(istekhara);
  } catch (error) {
    next(error);
  }
};

// Send reply to istekhara (alim only)
exports.sendReply = async (req, res, next) => {
  try {
    const { request_id } = req.params;
    const { reply_text, reply_audio, result, surah, ayah } = req.body;

    const istekhara = await Istekhara.findByPk(request_id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!istekhara) {
      throw new NotFoundError('Istekhara not found');
    }

    // Update istekhara with reply
    await istekhara.update({
      reply_text: reply_text || '',
      reply_audio: reply_audio || '',
      result: result || '',
      surah: surah || null,
      ayah: ayah || null,
      replied_by_id: req.user.id
    });

    // Send email notification to user
    try {
      const userWebDomain = process.env.USER_WEB_DOMAIN_NAME || 'http://localhost:3000';
      await sendEmail(
        istekhara.user.email,
        'Your Istekhara response is ready',
        getIstekharaReplyEmailHTML(istekhara.id, userWebDomain)
      );
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    // Reload with relations
    const updatedIstekhara = await Istekhara.findByPk(request_id, {
      include: [
        { model: User, as: 'user' },
        { model: Alim, as: 'replied_by' }
      ]
    });

    res.json(updatedIstekhara);
  } catch (error) {
    next(error);
  }
};

// Check if user is eligible to submit testimonial
exports.isTestimonialEligible = async (req, res, next) => {
  try {
    const { request_id } = req.params;

    const istekhara = await Istekhara.findOne({
      where: {
        id: request_id,
        user_id: req.user.id
      }
    });

    if (!istekhara) {
      throw new NotFoundError('Istekhara not found');
    }

    // Check if already submitted testimonial
    const existingTestimonial = await Testimonial.findOne({
      where: { user_id: req.user.id }
    });

    const eligible = !existingTestimonial && istekhara.replied_by_id !== null;

    res.json({
      eligible,
      message: eligible 
        ? 'You can submit a testimonial' 
        : existingTestimonial 
          ? 'You have already submitted a testimonial' 
          : 'This request has not been replied to yet'
    });
  } catch (error) {
    next(error);
  }
};

// Email templates
function getIstekharaReceivedEmailHTML(istekharaId, userWebDomain) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Istekhara Request Received</title>
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
              <h2 style="color: #555555; font-size: 24px; text-align: center;">We have received your Istekhara request</h2>
              <p style="color: #555555; font-size: 16px; text-align: center; line-height: 1.5;">
                Your Istekhara request has been received.<br>
                You will receive a response in the next 24-48 hours.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${userWebDomain}/dashboard/istekhara/${istekharaId}" 
                   style="background-color: #3aaee0; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 16px;">
                  View Status
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getNewIstekharaEmailHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Istekhara Request</title>
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
              <h2 style="color: #555555; font-size: 24px; text-align: center;">A new Istekhara request received</h2>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://admin.istekharanow.com/dashboard/users" 
                   style="background-color: #3aaee0; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 16px;">
                  View Status
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getIstekharaReplyEmailHTML(istekharaId, userWebDomain) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Istekhara Response Ready</title>
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
              <h2 style="color: #555555; font-size: 24px; text-align: center;">Your Istekhara response is ready</h2>
              <p style="color: #555555; font-size: 16px; text-align: center; line-height: 1.5;">
                Your Istekhara request has been answered.<br>
                Click below to view your response.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${userWebDomain}/dashboard/istekhara/${istekharaId}" 
                   style="background-color: #3aaee0; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 16px;">
                  View Response
                </a>
              </div>
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
