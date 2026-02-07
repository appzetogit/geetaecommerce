const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const admin = require('firebase-admin');

// 1. Check System Time vs Google Server Time
function checkSystemTime() {
  return new Promise((resolve, reject) => {
    console.log('Checking system time synchronization...');
    const req = http.get('http://google.com', (res) => {
      const serverDate = new Date(res.headers.date);
      const localDate = new Date();
      const diff = Math.abs(localDate - serverDate);

      console.log(`Server Time (Google): ${serverDate.toISOString()}`);
      console.log(`Local System Time:    ${localDate.toISOString()}`);
      console.log(`Time Difference:      ${diff} ms (${(diff/1000/60).toFixed(2)} mins)`);

      if (diff > 300000) { // 5 minutes tolerance
        console.error('❌ CRITICAL: System time is out of sync by more than 5 minutes!');
        console.error('   This will cause JWT signature validation failures with Firebase/Google.');
        console.error('   PLEASE CORRECT YOUR SYSTEM CLOCK.');
        resolve(false);
      } else {
        console.log('✅ System time appears synchronized.');
        resolve(true);
      }
    });

    req.on('error', (e) => {
      console.warn('⚠️ Could not check time against google.com:', e.message);
      resolve(true); // Assume ok if we can't check
    });

    req.end();
  });
}

// 2. verify Firebase Credential
async function checkFirebase() {
  try {
    const timeSyncOk = await checkSystemTime();

    console.log('\nChecking Firebase Configuration...');
    const filePath = path.resolve(__dirname, 'config/firebase-service-account.json');
    if (!fs.existsSync(filePath)) {
      console.error('❌ File does not exist at:', filePath);
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    console.log('✅ JSON Parse: SUCCESS');
    console.log('Project ID:', json.project_id);
    console.log('Client Email:', json.client_email);

    if (json.private_key) {
      // Fix potential newline issues
      const key = json.private_key.replace(/\\n/g, '\n');
      const start = key.trim().startsWith('-----BEGIN PRIVATE KEY-----');
      const end = key.trim().endsWith('-----END PRIVATE KEY-----');
      console.log('Private Key Format: ' + (start && end ? 'VALID PEM' : 'INVALID'));
      if (!start) console.error('❌ Start check failed');
      if (!end) console.error('❌ End check failed');

      if (!start || !end) {
          process.exit(1);
      }

      // Initialize App
      try {
        if (admin.apps.length === 0) {
          admin.initializeApp({
            credential: admin.credential.cert(json)
          });
        }

        console.log('✅ Firebase App Initialized');

        console.log('Attempting to fetch Access Token (verifies signature)...');
        const token = await admin.app().options.credential.getAccessToken();
        console.log('✅ Access Token fetch success! Credentials are valid.');
        console.log('   Token expires in:', token.expires_in, 'seconds');

      } catch (authError) {
        console.error('❌ credential validation failed:', authError.message);
        console.error('   Common causes:');
        console.error('   1. System time mismatch (See check above)');
        console.error('   2. Revoked Service Account Key');
        console.error('   3. Private Key mismatch with Client Email');
      }

    } else {
      console.error('❌ Private Key: MISSING in JSON');
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

checkFirebase();
