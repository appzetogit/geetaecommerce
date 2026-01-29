const axios = require('axios');

async function testFlow() {
    const mobile = '9876543210';
    try {
        console.log('Attempting registration...');
        const regRes = await axios.post('http://localhost:5000/api/v1/auth/customer/register', {
            name: 'Test User',
            mobile: mobile,
            email: 'test' + Date.now() + '@example.com'
        });
        console.log('Registration Response:', regRes.data);

        console.log('Attempting to send OTP...');
        const otpRes = await axios.post('http://localhost:5000/api/v1/auth/customer/send-otp', {
            mobile: mobile
        });
        console.log('OTP Response:', otpRes.data);
    } catch (err) {
        if (err.response) {
            console.log('Error Status:', err.response.status);
            console.log('Error Data:', err.response.data);
        } else {
            console.log('Error:', err.message);
        }
    }
}

testFlow();
