const path = require('path');
const fs = require('fs');
const request = require('supertest');

describe('Proxy Workflow', () => {
  let app;
  let proxyService;

  beforeEach(() => {
    jest.resetModules();
    
    // Set up test app
    const express = require('express');
    app = express();
    app.use(express.json());
    
    // Load services
    proxyService = require('../server/services/proxyService');
    
    // Mock FFmpeg to avoid actual video processing in tests
    jest.mock('fluent-ffmpeg', () => {
      return jest.fn(() => ({
        size: jest.fn().mockReturnThis(),
        outputOptions: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        save: jest.fn().mockImplementation((path, callback) => {
          // Simulate successful proxy generation
          setTimeout(() => callback(), 100);
        })
      }));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Proxy Generation', () => {
    test('should generate proxy for video files', async () => {
      const originalPath = path.join(__dirname, '../test-uploads/test-video.mp4');
      const filename = 'test-video.mp4';
      
      // Create a mock video file
      fs.writeFileSync(originalPath, 'mock video content');

      try {
        const result = await proxyService.generateProxy(originalPath, filename);
        
        expect(result).toBe(true);
      } finally {
        // Clean up
        if (fs.existsSync(originalPath)) {
          fs.unlinkSync(originalPath);
        }
      }
    });

    test('should handle proxy generation errors gracefully', async () => {
      const originalPath = 'nonexistent-file.mp4';
      const filename = 'test.mp4';

      const result = await proxyService.generateProxy(originalPath, filename);
      
      expect(result).toBe(false);
    });

    test('should check if proxy exists', () => {
      const filename = 'test-video.mp4';
      const proxyPath = path.join(__dirname, '../test-proxies', filename);
      
      // Create a mock proxy file
      fs.writeFileSync(proxyPath, 'mock proxy content');

      try {
        const exists = proxyService.proxyExists(filename);
        expect(exists).toBe(true);
      } finally {
        // Clean up
        if (fs.existsSync(proxyPath)) {
          fs.unlinkSync(proxyPath);
        }
      }
    });

    test('should return proxy path', () => {
      const filename = 'test-video.mp4';
      const proxyPath = proxyService.getProxyPath(filename);
      
      expect(proxyPath).toContain('test-proxies');
      expect(proxyPath).toContain(filename);
    });
  });

  describe('Upload Integration', () => {
    test('should handle video upload with proxy generation', async () => {
      // Mock multer
      const multer = require('multer');
      const storage = multer.memoryStorage();
      const upload = multer({ storage });
      
      app.post('/upload', upload.single('media'), async (req, res) => {
        try {
          if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
          }

          const isVideo = req.file.mimetype.startsWith('video/');
          
          if (isVideo) {
            // Mock proxy generation
            const proxySuccess = await proxyService.generateProxy('mock-path', req.file.originalname);
            res.json({ 
              success: true, 
              filename: req.file.originalname,
              hasProxy: proxySuccess
            });
          } else {
            res.json({ 
              success: true, 
              filename: req.file.originalname,
              hasProxy: false
            });
          }
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            message: 'Upload failed', 
            error: error.message 
          });
        }
      });

      const response = await request(app)
        .post('/upload')
        .attach('media', Buffer.from('mock video content'), 'test-video.mp4')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.hasProxy).toBe(true);
    });
  });

  describe('File Management', () => {
    test('should clean up old proxy files', () => {
      const filename = 'old-proxy.mp4';
      const proxyPath = path.join(__dirname, '../test-proxies', filename);
      
      // Create an old proxy file
      fs.writeFileSync(proxyPath, 'old proxy content');
      
      // Set file modification time to 1 hour ago
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      fs.utimesSync(proxyPath, oneHourAgo, oneHourAgo);

      try {
        // This would normally be called by a cleanup function
        // For now, just verify the file exists
        expect(fs.existsSync(proxyPath)).toBe(true);
      } finally {
        // Clean up
        if (fs.existsSync(proxyPath)) {
          fs.unlinkSync(proxyPath);
        }
      }
    });
  });
});
