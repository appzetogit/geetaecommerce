// Simple test script to verify authentication endpoints
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api/v1';

async function testHealth() {
  try {
    console.log('Testing Health Endpoint...');
    const response = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health Check:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Health Check Failed:', error.message);
    return false;
  }
}

async function testAdminSendOTP() {
  try {
    console.log('\nTesting Admin Send OTP...');
    const response = await axios.post(`${API_BASE}/auth/admin/send-otp`, {
      mobile: '1234567890'
    });
    console.log('✅ Admin Send OTP:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Admin Send OTP Failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCustomerSendOTP() {
  try {
    console.log('\nTesting Customer Send OTP...');
    const response = await axios.post(`${API_BASE}/auth/customer/send-otp`, {
      mobile: '9876543210'
    });
    console.log('✅ Customer Send OTP:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Customer Send OTP Failed:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Authentication API Tests...\n');
  
  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('\n⚠️  Server is not running. Please start the backend server first.');
    console.log('   Run: cd backend && npm run dev');
    return;
  }

  await testAdminSendOTP();
  await testCustomerSendOTP();
  
  console.log('\n✅ Tests completed!');
  console.log('\nNote: OTP verification requires users to exist in the database.');
  console.log('In development mode, OTP is always: 123456');
}

runTests().catch(console.error);

