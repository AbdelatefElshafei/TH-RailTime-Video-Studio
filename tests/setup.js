// Jest setup file
const path = require('path');

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.MEDIA_PATH = './test-uploads';
process.env.PROXY_PATH = './test-proxies';
process.env.PROCESSED_PATH = './test-processed';
process.env.PREVIEWS_PATH = './test-previews';
process.env.THUMBNAILS_PATH = './test-thumbnails';
process.env.WAVEFORMS_PATH = './test-waveforms';
process.env.LUTS_PATH = './test-luts';

// Create test directories
const fs = require('fs');
const testDirs = [
  'test-uploads',
  'test-proxies', 
  'test-processed',
  'test-previews',
  'test-thumbnails',
  'test-waveforms',
  'test-luts'
];

testDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Cleanup after tests
afterAll(() => {
  testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
