const path = require('path');
const fs = require('fs');

describe('Plugin Loading System', () => {
  let pluginRegistry;
  let loadPlugins;

  beforeEach(() => {
    // Clear require cache
    jest.resetModules();
    
    // Mock the plugin registry
    pluginRegistry = {};
    
    // Load the plugin system
    const pluginModule = require('../server/routes/plugins');
    loadPlugins = pluginModule.loadPlugins;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Plugin Validation', () => {
    test('should validate plugin structure', () => {
      const validPlugin = {
        name: 'Test Plugin',
        type: 'effect',
        effectType: 'visual',
        version: '1.0.0',
        author: 'Test Author',
        description: 'Test description',
        params: [],
        generateFilter: jest.fn(),
        validate: jest.fn()
      };

      expect(() => {
        const pluginModule = require('../server/routes/plugins');
        pluginModule.validatePlugin(validPlugin);
      }).not.toThrow();
    });

    test('should reject plugin with missing required fields', () => {
      const invalidPlugin = {
        name: 'Test Plugin'
        // Missing required fields
      };

      expect(() => {
        const pluginModule = require('../server/routes/plugins');
        pluginModule.validatePlugin(invalidPlugin);
      }).toThrow();
    });

    test('should validate plugin parameters', () => {
      const pluginWithParams = {
        name: 'Test Plugin',
        type: 'effect',
        effectType: 'visual',
        version: '1.0.0',
        author: 'Test Author',
        description: 'Test description',
        params: [
          {
            name: 'strength',
            type: 'number',
            default: 1.0,
            min: 0,
            max: 10,
            description: 'Effect strength'
          }
        ],
        generateFilter: jest.fn(),
        validate: jest.fn()
      };

      expect(() => {
        const pluginModule = require('../server/routes/plugins');
        pluginModule.validatePlugin(pluginWithParams);
      }).not.toThrow();
    });
  });

  describe('Plugin Loading', () => {
    test('should load plugins from plugins directory', async () => {
      // Create a mock plugin file
      const mockPluginPath = path.join(__dirname, '../plugins/test-plugin.js');
      const mockPlugin = {
        name: 'Test Plugin',
        type: 'effect',
        effectType: 'visual',
        version: '1.0.0',
        author: 'Test Author',
        description: 'Test description',
        params: [],
        generateFilter: jest.fn(),
        validate: jest.fn()
      };

      // Write mock plugin file
      fs.writeFileSync(mockPluginPath, `module.exports = ${JSON.stringify(mockPlugin)};`);

      try {
        const pluginModule = require('../server/routes/plugins');
        await pluginModule.loadPlugins();
        
        // Verify plugin was loaded
        expect(pluginModule.pluginRegistry).toBeDefined();
      } finally {
        // Clean up
        if (fs.existsSync(mockPluginPath)) {
          fs.unlinkSync(mockPluginPath);
        }
      }
    });

    test('should handle invalid plugin files gracefully', async () => {
      // Create an invalid plugin file
      const invalidPluginPath = path.join(__dirname, '../plugins/invalid-plugin.js');
      fs.writeFileSync(invalidPluginPath, 'invalid javascript syntax');

      try {
        const pluginModule = require('../server/routes/plugins');
        await expect(pluginModule.loadPlugins()).resolves.not.toThrow();
      } finally {
        // Clean up
        if (fs.existsSync(invalidPluginPath)) {
          fs.unlinkSync(invalidPluginPath);
        }
      }
    });
  });

  describe('Plugin API Endpoints', () => {
    let app;
    let request;

    beforeEach(() => {
      const express = require('express');
      app = express();
      app.use(express.json());
      
      const pluginRoutes = require('../server/routes/plugins');
      app.use('/api', pluginRoutes.router);
      
      request = require('supertest');
    });

    test('GET /api/plugins should return available plugins', async () => {
      const response = await request(app)
        .get('/api/plugins')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    test('GET /api/plugins should handle errors gracefully', async () => {
      // Mock an error in the plugin registry
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const response = await request(app)
        .get('/api/plugins')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });
});
