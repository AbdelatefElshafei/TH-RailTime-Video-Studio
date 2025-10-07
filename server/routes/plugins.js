const express = require('express');
const path = require('path');
const fs = require('fs');
const { ensureDirectoryExists } = require('../utils/fileHelpers');

const router = express.Router();

// Plugin registry (in production, use database)
const pluginRegistry = {};

/**
 * Load all plugins from the plugins directory
 */
function loadPlugins() {
    const pluginsDir = process.env.PLUGINS_PATH || path.join(__dirname, '../../plugins');
    
    // Ensure plugins directory exists
    ensureDirectoryExists(pluginsDir);
    
    // Create example plugin if directory is empty
    if (!fs.existsSync(pluginsDir) || fs.readdirSync(pluginsDir).length === 0) {
        createExamplePlugin(pluginsDir);
    }

    // Clear existing registry
    Object.keys(pluginRegistry).forEach(key => delete pluginRegistry[key]);

    // Load all plugin files
    try {
        const files = fs.readdirSync(pluginsDir);
        files.forEach(file => {
            if (file.endsWith('.js')) {
                try {
                    const pluginPath = path.join(pluginsDir, file);
                    const plugin = require(pluginPath);
                    
                    if (validatePlugin(plugin)) {
                        pluginRegistry[plugin.type] = plugin;
                        console.log(`🔌 Plugin loaded: ${plugin.name} (${plugin.type})`);
                    } else {
                        console.warn(`⚠️ Invalid plugin structure in ${file}`);
                    }
                } catch (error) {
                    console.error(`❌ Error loading plugin ${file}:`, error.message);
                }
            }
        });
        
        console.log(`✅ Loaded ${Object.keys(pluginRegistry).length} plugins`);
    } catch (error) {
        console.error('Error loading plugins:', error);
    }
}

/**
 * Create example plugin
 * @param {string} pluginsDir - Plugins directory path
 */
function createExamplePlugin(pluginsDir) {
    const examplePlugin = `module.exports = {
  // --- Required Properties ---
  name: 'Vignette',
  type: 'vignette',
  effectType: 'video',
  
  // --- Optional: Define parameters to auto-generate UI controls ---
  params: [
    {
      name: 'Strength',
      key: 'strength',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      defaultValue: 0.5
    },
  ],
  
  // --- Required: Function to generate the FFmpeg filter string ---
  buildFilter: (params) => {
    const strength = params.strength ?? 0.5;
    const angle = Math.PI/2.5 * (1 - strength);
    return \`vignette=angle=\${angle}\`;
  }
};`;

    const examplePath = path.join(pluginsDir, 'vignette.js');
    fs.writeFileSync(examplePath, examplePlugin, 'utf8');
    console.log('✨ Created example plugin: vignette.js');
}

/**
 * Validate plugin structure
 * @param {Object} plugin - Plugin object to validate
 * @returns {boolean} True if valid
 */
function validatePlugin(plugin) {
    if (!plugin || typeof plugin !== 'object') {
        return false;
    }
    
    // Check required properties
    if (!plugin.name || typeof plugin.name !== 'string') {
        return false;
    }
    
    if (!plugin.type || typeof plugin.type !== 'string') {
        return false;
    }
    
    if (!plugin.effectType || !['video', 'audio'].includes(plugin.effectType)) {
        return false;
    }
    
    if (!plugin.buildFilter || typeof plugin.buildFilter !== 'function') {
        return false;
    }
    
    // Validate params if present
    if (plugin.params && Array.isArray(plugin.params)) {
        for (const param of plugin.params) {
            if (!param.name || !param.key || !param.type) {
                return false;
            }
            
            if (!['slider', 'number', 'text', 'color', 'boolean', 'select'].includes(param.type)) {
                return false;
            }
        }
    }
    
    return true;
}

/**
 * Get all available plugins
 * GET /api/plugins
 */
router.get('/api/plugins', (req, res) => {
    try {
        const plugins = Object.values(pluginRegistry).map(plugin => ({
            name: plugin.name,
            type: plugin.type,
            effectType: plugin.effectType,
            params: plugin.params || [],
            description: plugin.description || '',
            version: plugin.version || '1.0.0',
            author: plugin.author || 'Unknown'
        }));
        
        // Return plugins array directly for backward compatibility
        res.json(plugins);
    } catch (error) {
        console.error('Error getting plugins:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get plugins',
            error: error.message
        });
    }
});

/**
 * Get specific plugin by type
 * GET /api/plugins/:type
 */
router.get('/api/plugins/:type', (req, res) => {
    try {
        const pluginType = req.params.type;
        const plugin = pluginRegistry[pluginType];
        
        if (!plugin) {
            return res.status(404).json({
                success: false,
                message: 'Plugin not found'
            });
        }
        
        res.json({
            success: true,
            plugin: {
                name: plugin.name,
                type: plugin.type,
                effectType: plugin.effectType,
                params: plugin.params || [],
                description: plugin.description || '',
                version: plugin.version || '1.0.0',
                author: plugin.author || 'Unknown'
            }
        });
    } catch (error) {
        console.error('Error getting plugin:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get plugin',
            error: error.message
        });
    }
});

/**
 * Reload all plugins
 * POST /api/plugins/reload
 */
router.post('/api/plugins/reload', (req, res) => {
    try {
        loadPlugins();
        
        res.json({
            success: true,
            message: 'Plugins reloaded successfully',
            count: Object.keys(pluginRegistry).length
        });
    } catch (error) {
        console.error('Error reloading plugins:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reload plugins',
            error: error.message
        });
    }
});

/**
 * Get plugin registry (for internal use)
 * @returns {Object} Plugin registry
 */
function getPluginRegistry() {
    return pluginRegistry;
}

/**
 * Get plugin by type (for internal use)
 * @param {string} type - Plugin type
 * @returns {Object|null} Plugin object or null
 */
function getPlugin(type) {
    return pluginRegistry[type] || null;
}

/**
 * Check if plugin exists
 * @param {string} type - Plugin type
 * @returns {boolean} True if plugin exists
 */
function hasPlugin(type) {
    return type in pluginRegistry;
}

/**
 * Get plugins by effect type
 * @param {string} effectType - Effect type ('video' or 'audio')
 * @returns {Array} Array of plugins
 */
function getPluginsByEffectType(effectType) {
    return Object.values(pluginRegistry).filter(plugin => plugin.effectType === effectType);
}

/**
 * Get plugin statistics
 * GET /api/plugins/stats
 */
router.get('/api/plugins/stats', (req, res) => {
    try {
        const plugins = Object.values(pluginRegistry);
        const stats = {
            total: plugins.length,
            video: plugins.filter(p => p.effectType === 'video').length,
            audio: plugins.filter(p => p.effectType === 'audio').length,
            withParams: plugins.filter(p => p.params && p.params.length > 0).length,
            withoutParams: plugins.filter(p => !p.params || p.params.length === 0).length
        };
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting plugin stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get plugin statistics',
            error: error.message
        });
    }
});

/**
 * Validate plugin file
 * POST /api/plugins/validate
 */
router.post('/api/plugins/validate', (req, res) => {
    try {
        const { plugin } = req.body;
        
        if (!plugin) {
            return res.status(400).json({
                success: false,
                message: 'Plugin data is required'
            });
        }
        
        const isValid = validatePlugin(plugin);
        
        res.json({
            success: true,
            valid: isValid,
            message: isValid ? 'Plugin is valid' : 'Plugin has invalid structure'
        });
    } catch (error) {
        console.error('Error validating plugin:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate plugin',
            error: error.message
        });
    }
});

// Initialize plugins on module load
loadPlugins();

module.exports = {
    router,
    loadPlugins,
    getPluginRegistry,
    getPlugin,
    hasPlugin,
    getPluginsByEffectType,
    validatePlugin
};
