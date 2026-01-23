const AWS = require('aws-sdk');

const ses = new AWS.SES({
  region: 'us-east-2',
  accessKeyId: process.env.SES_ACCESS_KEY,
  secretAccessKey: process.env.SES_ACCESS_SECRET
});

async function sendEmail(toEmail, subject, htmlBody) {
  // Convert string to array if needed
  const toAddresses = Array.isArray(toEmail) ? toEmail : [toEmail];

  const params = {
    Source: 'IstekharaNow <support@istekharanow.com>',
    Destination: {
      ToAddresses: toAddresses
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log('Email sent:', result.MessageId);
    return result;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

module.exports = { sendEmail };
