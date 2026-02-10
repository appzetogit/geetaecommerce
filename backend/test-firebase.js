const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, 'config/firebase-service-account.json');

console.log('Current System Time:', new Date().toISOString());
console.log('Current System Time (Locale):', new Date().toLocaleString());

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account file not found');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Apply the same fix as in the main app
if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase initialized');

    admin.app().options.credential.getAccessToken()
        .then(token => {
            console.log('✅ Success! Access token fetched.');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Failed to fetch access token:', err);
            process.exit(1);
        });
} catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    process.exit(1);
}
