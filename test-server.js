// Quick test script to verify server functionality
const http = require('http');

const testEndpoints = [
    '/api/health',
    '/api/plugins',
    '/api/info'
];

console.log('🧪 Testing server endpoints...');

testEndpoints.forEach(endpoint => {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: endpoint,
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log(`✅ ${endpoint}: ${res.statusCode}`);
            if (res.statusCode !== 200) {
                console.log(`   Response: ${data}`);
            }
        });
    });

    req.on('error', (err) => {
        console.log(`❌ ${endpoint}: ${err.message}`);
    });

    req.end();
});

console.log('🔍 Test completed. Check the results above.');
