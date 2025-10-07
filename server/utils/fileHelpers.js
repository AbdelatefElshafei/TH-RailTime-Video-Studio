const fs = require('fs');
const path = require('path');
const cuid = require('cuid');
const sanitize = require('sanitize-filename');

/**
 * File helper utilities for TH Realtime Video Studio
 */

/**
 * Ensure directory exists, create if it doesn't
 * @param {string} dirPath - Directory path to ensure exists
 */
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`);
    }
}

/**
 * Generate a safe filename using cuid
 * @param {string} originalName - Original filename
 * @returns {string} Safe filename
 */
function generateSafeFilename(originalName) {
    return `${cuid()}${path.extname(originalName)}`;
}

/**
 * Sanitize filename for safe storage
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
    return sanitize(filename);
}

/**
 * Check if file exists
 * @param {string} filePath - File path to check
 * @returns {boolean} True if file exists
 */
function fileExists(filePath) {
    return fs.existsSync(filePath);
}

/**
 * Get file stats
 * @param {string} filePath - File path
 * @returns {Object|null} File stats or null if not found
 */
function getFileStats(filePath) {
    try {
        return fs.statSync(filePath);
    } catch (error) {
        return null;
    }
}

/**
 * Read file as JSON
 * @param {string} filePath - File path
 * @returns {Object|null} Parsed JSON or null if error
 */
function readJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading JSON file ${filePath}:`, error);
        return null;
    }
}

/**
 * Write JSON to file
 * @param {string} filePath - File path
 * @param {Object} data - Data to write
 * @returns {boolean} Success status
 */
function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing JSON file ${filePath}:`, error);
        return false;
    }
}

/**
 * Delete file if it exists
 * @param {string} filePath - File path to delete
 * @returns {boolean} Success status
 */
function deleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
        return false;
    }
}

/**
 * Clean up old files in directory
 * @param {string} dirPath - Directory path
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {number} Number of files cleaned up
 */
function cleanupOldFiles(dirPath, maxAge) {
    let cleanedCount = 0;
    try {
        if (!fs.existsSync(dirPath)) return 0;
        
        const files = fs.readdirSync(dirPath);
        const cutoffTime = Date.now() - maxAge;
        
        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            
            if (stats.mtime.getTime() < cutoffTime) {
                fs.unlinkSync(filePath);
                cleanedCount++;
                console.log(`🗑️ Cleaned up old file: ${file} from ${path.basename(dirPath)}`);
            }
        });
    } catch (error) {
        console.error(`Cleanup error in ${dirPath}:`, error);
    }
    
    return cleanedCount;
}

/**
 * Get file extension
 * @param {string} filename - Filename
 * @returns {string} File extension (lowercase)
 */
function getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
}

/**
 * Check if file is video
 * @param {string} mimetype - MIME type
 * @returns {boolean} True if video file
 */
function isVideoFile(mimetype) {
    return mimetype.startsWith('video/');
}

/**
 * Check if file is audio
 * @param {string} mimetype - MIME type
 * @returns {boolean} True if audio file
 */
function isAudioFile(mimetype) {
    return mimetype.startsWith('audio/');
}

/**
 * Check if file is image
 * @param {string} mimetype - MIME type
 * @returns {boolean} True if image file
 */
function isImageFile(mimetype) {
    return mimetype.startsWith('image/');
}

/**
 * Get file size in bytes
 * @param {string} filePath - File path
 * @returns {number} File size in bytes
 */
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
    ensureDirectoryExists,
    generateSafeFilename,
    sanitizeFilename,
    fileExists,
    getFileStats,
    readJsonFile,
    writeJsonFile,
    deleteFile,
    cleanupOldFiles,
    getFileExtension,
    isVideoFile,
    isAudioFile,
    isImageFile,
    getFileSize,
    formatFileSize
};
