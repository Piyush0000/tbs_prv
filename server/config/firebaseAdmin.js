const admin = require('firebase-admin');
let auth = null;

try {
  // Try to load the Firebase service account key
  const serviceAccount = require('../secrets/serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  auth = admin.auth();
  console.log('✅ Firebase Admin initialized successfully');
} catch (err) {
  console.warn('⚠ Firebase Admin not initialized — serviceAccountKey.json missing.');
  console.warn('   Some Firebase features will be disabled.');
  
  // Provide a mock auth object so the rest of the app won't break
  auth = {
    verifyIdToken: async () => {
      throw new Error('Firebase authentication is disabled in this environment.');
    }
  };
}

module.exports = { admin, auth };
