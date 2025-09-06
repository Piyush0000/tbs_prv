// generateKey.js (CommonJS)
const crypto = require("crypto");

// Generate a 64-byte (512-bit) random secret key
const secretKey = crypto.randomBytes(64).toString("hex");

console.log("Your JWT Secret Key:\n", secretKey);
