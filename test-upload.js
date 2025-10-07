// Test upload functionality
const FormData = require('form-data');
const fs = require('fs');
const http = require('http');

console.log('🧪 Testing upload functionality...');

// Create a test file
const testContent = 'This is a test video file content';
const testFilePath = './test-video.mp4';
fs.writeFileSync(testFilePath, testContent);

// Create form data
const form = new FormData();
form.append('media', fs.createReadStream(testFilePath), {
    filename: 'test-video.mp4',
    contentType: 'video/mp4'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/upload',
    method: 'POST',
    headers: form.getHeaders()
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log(`📡 Upload Status: ${res.statusCode}`);
        
        try {
            const result = JSON.parse(data);
            console.log('📦 Upload Response:', JSON.stringify(result, null, 2));
            
            if (result.success) {
                console.log('✅ Upload successful!');
                console.log(`   Filename: ${result.filename}`);
                console.log(`   Original Name: ${result.originalName}`);
                console.log(`   Has Proxy: ${result.hasProxy}`);
            } else {
                console.log('❌ Upload failed:', result.message);
            }
        } catch (error) {
            console.log('❌ Error parsing response:', error.message);
            console.log('Raw response:', data);
        }
        
        // Clean up test file
        fs.unlinkSync(testFilePath);
    });
});

req.on('error', (err) => {
    console.log('❌ Upload request failed:', err.message);
    console.log('💡 Make sure the server is running with: npm start');
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
});

form.pipe(req);
