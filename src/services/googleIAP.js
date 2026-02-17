const { google } = require("googleapis");
const path = require("path");

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_PATH),
  scopes: ["https://www.googleapis.com/auth/androidpublisher"]
});

exports.verifyGooglePurchase = async (productId, token, isRecurring) => {
  console.log('Verifying Google purchase for productId:', productId, 'with token:', token);
  const client = await auth.getClient();
  console.log('Google auth client obtained');

  const androidPublisher = google.androidpublisher({
    version: "v3",
    auth: client
  });

  if (isRecurring) {
    // SUBSCRIPTION
    const res = await androidPublisher.purchases.subscriptions.get({
      packageName: process.env.ANDROID_PACKAGE_NAME,
      subscriptionId: productId,
      token
    });
    return res.data;
  } else {
    // ONE-TIME PRODUCT
    const res = await androidPublisher.purchases.products.get({
      packageName: process.env.ANDROID_PACKAGE_NAME,
      productId,
      token
    });
    return res.data;
  }
};
