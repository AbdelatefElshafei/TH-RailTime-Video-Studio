require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// Import routes
const uploadRoutes = require('./routes/upload');
const { router: renderRoutes, generatePreviewVideo } = require('./routes/render');
const { router: pluginRoutes, loadPlugins } = require('./routes/plugins');

// Import services
const proxyService = require('./services/proxyService');
const ffmpegService = require('./services/ffmpegService');

// Import utilities
const { ensureDirectoryExists, cleanupOldFiles } = require('./utils/fileHelpers');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: process.env.MAX_UPLOAD_SIZE || '50mb' }));

// Static file serving
app.use(express.static('public'));
app.use('/processed', express.static(path.join(__dirname, '../processed')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/proxies', express.static(path.join(__dirname, '../proxies')));
app.use('/previews', express.static(path.join(__dirname, '../previews')));
app.use('/thumbnails', express.static(path.join(__dirname, '../thumbnails')));
app.use('/waveforms', express.static(path.join(__dirname, '../waveforms')));
app.use('/luts', express.static(path.join(__dirname, '../luts')));

// API Routes
app.use('/', uploadRoutes);
app.use('/', renderRoutes);
app.use('/', pluginRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'TH Realtime Video Studio is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Server info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        success: true,
        server: {
            name: 'TH Realtime Video Studio',
            version: '1.0.0',
            port: port,
            environment: process.env.NODE_ENV || 'development'
        },
        paths: {
            uploads: process.env.MEDIA_PATH || './uploads',
            proxies: process.env.PROXY_PATH || './proxies',
            processed: process.env.PROCESSED_PATH || './processed',
            previews: process.env.PREVIEWS_PATH || './previews',
            thumbnails: process.env.THUMBNAILS_PATH || './thumbnails',
            waveforms: process.env.WAVEFORMS_PATH || './waveforms',
            luts: process.env.LUTS_PATH || './luts'
        },
        ffmpeg: {
            available: true, // This would be checked in production
            path: process.env.FFMPEG_PATH || 'system PATH'
        }
    });
});

// Initialize directories
function initializeDirectories() {
    const directories = [
        process.env.MEDIA_PATH || './uploads',
        process.env.PROXY_PATH || './proxies',
        process.env.PROCESSED_PATH || './processed',
        process.env.PREVIEWS_PATH || './previews',
        process.env.THUMBNAILS_PATH || './thumbnails',
        process.env.WAVEFORMS_PATH || './waveforms',
        process.env.LUTS_PATH || './luts'
    ];

    directories.forEach(dir => {
        ensureDirectoryExists(dir);
    });

    console.log('📁 All directories initialized');
}

// WebSocket setup for real-time previews
function setupWebSocket(server) {
    if (process.env.WS_ENABLED === 'false') {
        console.log('🔌 WebSocket disabled');
        return;
    }

    const wss = new WebSocket.Server({ server });
    const previewSessions = new Map();

    wss.on('connection', (ws) => {
        console.log('🔌 Preview client connected');
        
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'preview_request') {
                    const { project, timestamp, duration = 3, sessionId, useProxy } = data;
                    
                    // Cancel previous session if exists
                    if (previewSessions.has(sessionId)) {
                        previewSessions.get(sessionId).cancel = true;
                    }
                    
                    const session = { cancel: false };
                    previewSessions.set(sessionId, session);
                    
                    const previewId = `ws_preview_${timestamp}_${Date.now()}`;
                    const previewFilename = `${previewId}.mp4`;
                    const previewsDir = process.env.PREVIEWS_PATH || './previews';
                    const previewPath = path.join(__dirname, '..', previewsDir, previewFilename);
                    
                    // Use the imported preview generation function
                    const success = await generatePreviewVideo(project, timestamp, duration, previewPath, useProxy);
                    
                    if (!session.cancel && success) {
                        ws.send(JSON.stringify({ 
                            type: 'preview_ready', 
                            previewUrl: `/previews/${previewFilename}`, 
                            timestamp, 
                            duration, 
                            sessionId 
                        }));
                    }
                    
                    previewSessions.delete(sessionId);
                }
            } catch (error) {
                console.error('WebSocket preview error:', error);
                ws.send(JSON.stringify({ 
                    type: 'preview_error', 
                    error: error.message 
                }));
            }
        });
        
        ws.on('close', () => {
            console.log('🔌 Preview client disconnected');
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    console.log('🔌 WebSocket server initialized');
}

// Cleanup old files periodically
function setupCleanup() {
    const cleanupInterval = 5 * 60 * 1000; // 5 minutes
    
    setInterval(() => {
        const previewsDir = process.env.PREVIEWS_PATH || './previews';
        const thumbnailsDir = process.env.THUMBNAILS_PATH || './thumbnails';
        const previewAge = parseInt(process.env.PREVIEW_CLEANUP_AGE) || 15 * 60 * 1000; // 15 minutes
        const thumbnailAge = parseInt(process.env.THUMBNAIL_CLEANUP_AGE) || 5 * 60 * 1000; // 5 minutes
        
        const previewCount = cleanupOldFiles(path.join(__dirname, '..', previewsDir), previewAge);
        const thumbnailCount = cleanupOldFiles(path.join(__dirname, '..', thumbnailsDir), thumbnailAge);
        
        if (previewCount > 0 || thumbnailCount > 0) {
            console.log(`🧹 Cleanup completed: ${previewCount} previews, ${thumbnailCount} thumbnails removed`);
        }
    }, cleanupInterval);
    
    console.log('🧹 File cleanup scheduled');
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path
    });
});

// Start server
async function startServer() {
    try {
        // Initialize directories
        initializeDirectories();
        
        // Load plugins
        loadPlugins();
        
        // Check FFmpeg availability
        const ffmpegAvailable = await ffmpegService.isAvailable();
        if (!ffmpegAvailable) {
            console.warn('⚠️ FFmpeg may not be available. Check your installation and PATH.');
        } else {
            console.log('✅ FFmpeg is available');
        }
        
        // Create HTTP server
        const server = http.createServer(app);
        
        // Setup WebSocket
        setupWebSocket(server);
        
        // Setup cleanup
        setupCleanup();
        
        // Start listening
        server.listen(port, () => {
            console.log('🚀 TH Realtime Video Studio Server Started');
            console.log(`📡 Server running on http://localhost:${port}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📁 Uploads: ${process.env.MEDIA_PATH || './uploads'}`);
            console.log(`🎬 Proxies: ${process.env.PROXY_PATH || './proxies'}`);
            console.log(`🎞️ Processed: ${process.env.PROCESSED_PATH || './processed'}`);
            console.log(`🔌 WebSocket: ${process.env.WS_ENABLED !== 'false' ? 'Enabled' : 'Disabled'}`);
            console.log('✨ Ready for video editing!');
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('🛑 SIGTERM received, shutting down gracefully');
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });
        
        process.on('SIGINT', () => {
            console.log('🛑 SIGINT received, shutting down gracefully');
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;
