const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
  scopes: ["https://www.googleapis.com/auth/androidpublisher"]
});

exports.verifyGooglePurchase = async (productId, token) => {
  console.log('Verifying Google purchase for productId:', productId, 'with token:', token);
  const client = await auth.getClient();
  console.log('Google auth client obtained', client);

  const androidPublisher = google.androidpublisher({
    version: "v3",
    auth: client
  });

  const res = await androidPublisher.purchases.subscriptions.get({
    packageName: process.env.ANDROID_PACKAGE_NAME,
    subscriptionId: productId,
    token
  });

  return res.data;
};
