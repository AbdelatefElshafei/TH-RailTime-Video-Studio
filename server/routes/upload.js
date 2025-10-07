const express = require('express');
const multer = require('multer');
const path = require('path');
const cuid = require('cuid');
const { generateSafeFilename, isVideoFile } = require('../utils/fileHelpers');
const proxyService = require('../services/proxyService');

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = process.env.MEDIA_PATH || './uploads';
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const safeFilename = generateSafeFilename(file.originalname);
        cb(null, safeFilename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_UPLOAD_SIZE?.replace('mb', '')) * 1024 * 1024 || 50 * 1024 * 1024
    }
});

// LUT upload storage
const lutStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const lutsDir = process.env.LUTS_PATH || './luts';
        cb(null, lutsDir);
    },
    filename: (req, file, cb) => {
        const safeFilename = generateSafeFilename(file.originalname);
        cb(null, safeFilename);
    }
});

const lutUpload = multer({ 
    storage: lutStorage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.cube') {
            return cb(new Error('Only .cube LUT files are allowed'), false);
        }
        cb(null, true);
    }
});

/**
 * Upload media file
 * POST /upload
 */
router.post('/upload', upload.single('media'), async (req, res) => {
    try {
        console.log("📤 Upload request received");
        console.log("📤 Request body:", req.body);
        console.log("📤 Request file:", req.file);
        
        if (!req.file) {
            console.log("❌ No file in request");
            return res.status(400).json({ 
                success: false, 
                message: 'No file uploaded.' 
            });
        }

        console.log(`📁 Processing file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

        console.log("📂 Uploaded file:", req.file);

        const isVideo = isVideoFile(req.file.mimetype);
        
        // Generate proxy for video files
        if (isVideo) {
            console.log("🎬 Video detected, generating proxy...");
            console.log("⏳ This may take a moment for large files...");
            const originalPath = req.file.path;
            const proxySuccess = await proxyService.generateProxy(originalPath, req.file.filename);
            
            if (!proxySuccess) {
                console.warn(`⚠️ Proxy generation failed for ${req.file.filename}`);
            } else {
                console.log("✅ Proxy generation completed successfully");
            }
        }

        const response = { 
            success: true, 
            filename: req.file.filename, 
            originalName: req.file.originalname,
            hasProxy: isVideo,
            fileSize: req.file.size,
            mimetype: req.file.mimetype
        };
        
        console.log("📤 Sending response:", response);
        res.json(response);

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Upload failed', 
            error: error.message 
        });
    }
});

/**
 * Upload LUT file
 * POST /upload-lut
 */
router.post('/upload-lut', lutUpload.single('lut'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No LUT file uploaded.' 
            });
        }

        console.log("🎨 Uploaded LUT:", req.file);
        
        res.json({ 
            success: true, 
            filename: req.file.filename,
            originalName: req.file.originalname,
            fileSize: req.file.size
        });

    } catch (error) {
        console.error('LUT upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'LUT upload failed', 
            error: error.message 
        });
    }
});

/**
 * Get upload statistics
 * GET /upload/stats
 */
router.get('/upload/stats', (req, res) => {
    try {
        const fs = require('fs');
        const { formatFileSize } = require('../utils/fileHelpers');
        
        const uploadsDir = process.env.MEDIA_PATH || './uploads';
        const lutsDir = process.env.LUTS_PATH || './luts';
        
        let uploadStats = { count: 0, totalSize: 0, files: [] };
        let lutStats = { count: 0, totalSize: 0, files: [] };
        
        // Get uploads stats
        try {
            const uploadFiles = fs.readdirSync(uploadsDir);
            uploadStats.count = uploadFiles.length;
            uploadFiles.forEach(file => {
                const filePath = path.join(uploadsDir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    uploadStats.totalSize += stats.size;
                    uploadStats.files.push({
                        name: file,
                        size: stats.size,
                        formattedSize: formatFileSize(stats.size),
                        modified: stats.mtime
                    });
                }
            });
        } catch (error) {
            console.error('Error reading uploads directory:', error);
        }
        
        // Get LUTs stats
        try {
            const lutFiles = fs.readdirSync(lutsDir);
            lutStats.count = lutFiles.length;
            lutFiles.forEach(file => {
                const filePath = path.join(lutsDir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    lutStats.totalSize += stats.size;
                    lutStats.files.push({
                        name: file,
                        size: stats.size,
                        formattedSize: formatFileSize(stats.size),
                        modified: stats.mtime
                    });
                }
            });
        } catch (error) {
            console.error('Error reading LUTs directory:', error);
        }
        
        res.json({
            success: true,
            uploads: {
                ...uploadStats,
                formattedSize: formatFileSize(uploadStats.totalSize)
            },
            luts: {
                ...lutStats,
                formattedSize: formatFileSize(lutStats.totalSize)
            },
            proxy: proxyService.getProxyStats()
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get upload statistics', 
            error: error.message 
        });
    }
});

/**
 * Delete uploaded file
 * DELETE /upload/:filename
 */
router.delete('/upload/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const uploadsDir = process.env.MEDIA_PATH || './uploads';
        const filePath = path.join(uploadsDir, filename);
        
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            
            // Also delete proxy if it exists
            proxyService.deleteProxy(filename);
            
            console.log(`🗑️ Deleted file: ${filename}`);
            res.json({ success: true, message: 'File deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'File not found' });
        }

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete file', 
            error: error.message 
        });
    }
});

module.exports = router;
