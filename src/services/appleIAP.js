const axios = require("axios");

const PROD_URL = "https://buy.itunes.apple.com/verifyReceipt";
const SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

exports.verifyAppleReceipt = async (receipt) => {
  const payload = {
    "receipt-data": receipt,
    "password": process.env.APPLE_SHARED_SECRET
  };

  let res = await axios.post(PROD_URL, payload);

  if (res.data.status === 21007) {
    res = await axios.post(SANDBOX_URL, payload);
  }

  return res.data;
};
