// Check server status and plugins
const http = require('http');

console.log('🔍 Checking server status...');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/plugins',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log(`📡 Status: ${res.statusCode}`);
        
        try {
            const plugins = JSON.parse(data);
            console.log(`🔌 Plugins loaded: ${Array.isArray(plugins) ? plugins.length : 'Not an array'}`);
            
            if (Array.isArray(plugins)) {
                plugins.forEach(plugin => {
                    console.log(`   - ${plugin.name} (${plugin.type})`);
                });
            } else {
                console.log('❌ Plugins response is not an array:', typeof plugins);
                console.log('Response:', data);
            }
        } catch (error) {
            console.log('❌ Error parsing plugins response:', error.message);
            console.log('Response:', data);
        }
    });
});

req.on('error', (err) => {
    console.log('❌ Server not running:', err.message);
    console.log('💡 Make sure to start the server with: npm start');
});

req.end();
