const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const { fileExists, ensureDirectoryExists } = require('../utils/fileHelpers');

/**
 * Proxy service for generating low-resolution proxy files
 */

class ProxyService {
    constructor() {
        this.proxyDir = process.env.PROXY_PATH || './proxies';
        this.uploadsDir = process.env.MEDIA_PATH || './uploads';
        
        // Ensure proxy directory exists
        ensureDirectoryExists(this.proxyDir);
    }

    /**
     * Generate proxy for a video file
     * @param {string} originalPath - Path to original video file
     * @param {string} filename - Filename for the proxy
     * @returns {Promise<boolean>} Success status
     */
    async generateProxy(originalPath, filename) {
        return new Promise((resolve) => {
            const proxyPath = path.join(this.proxyDir, filename);
            
            // Check if proxy already exists
            if (fileExists(proxyPath)) {
                console.log(`✅ Proxy already exists: ${filename}`);
                resolve(true);
                return;
            }

            console.log(`🔄 Generating proxy for: ${filename}`);

            ffmpeg(originalPath)
                .size('?x540')
                .outputOptions([
                    '-preset', 'ultrafast',
                    '-crf', '35',  // Lower quality for faster generation
                    '-c:v', 'libx264',
                    '-c:a', 'aac',  // Include audio in proxy
                    '-b:a', '128k', // Lower audio bitrate
                    '-movflags', 'faststart',
                    '-threads', '0'  // Use all available threads
                ])
                .on('start', (commandLine) => {
                    console.log(`🚀 Proxy generation command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`📊 Proxy generation progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    console.log(`✅ Proxy generated: ${filename}`);
                    resolve(true);
                })
                .on('error', (err) => {
                    console.error(`❌ Proxy generation failed for ${filename}:`, err.message);
                    resolve(false);
                })
                .save(proxyPath);
        });
    }

    /**
     * Get proxy path for a file
     * @param {string} filename - Original filename
     * @returns {string} Proxy file path
     */
    getProxyPath(filename) {
        return path.join(this.proxyDir, filename);
    }

    /**
     * Check if proxy exists for a file
     * @param {string} filename - Original filename
     * @returns {boolean} True if proxy exists
     */
    hasProxy(filename) {
        return fileExists(this.getProxyPath(filename));
    }

    /**
     * Get the appropriate file path (proxy or original)
     * @param {string} filename - Original filename
     * @param {boolean} useProxy - Whether to use proxy
     * @returns {string} File path to use
     */
    getFilePath(filename, useProxy = false) {
        if (useProxy && this.hasProxy(filename)) {
            return this.getProxyPath(filename);
        }
        return path.join(this.uploadsDir, filename);
    }

    /**
     * Delete proxy file
     * @param {string} filename - Original filename
     * @returns {boolean} Success status
     */
    deleteProxy(filename) {
        const proxyPath = this.getProxyPath(filename);
        if (fileExists(proxyPath)) {
            try {
                require('fs').unlinkSync(proxyPath);
                console.log(`🗑️ Deleted proxy: ${filename}`);
                return true;
            } catch (error) {
                console.error(`❌ Error deleting proxy ${filename}:`, error);
                return false;
            }
        }
        return true;
    }

    /**
     * Clean up old proxy files
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} Number of files cleaned up
     */
    cleanupOldProxies(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        const { cleanupOldFiles } = require('../utils/fileHelpers');
        return cleanupOldFiles(this.proxyDir, maxAge);
    }

    /**
     * Get proxy file size
     * @param {string} filename - Original filename
     * @returns {number} File size in bytes
     */
    getProxySize(filename) {
        const { getFileSize } = require('../utils/fileHelpers');
        return getFileSize(this.getProxyPath(filename));
    }

    /**
     * Get proxy file stats
     * @param {string} filename - Original filename
     * @returns {Object|null} File stats or null
     */
    getProxyStats(filename) {
        const { getFileStats } = require('../utils/fileHelpers');
        return getFileStats(this.getProxyPath(filename));
    }

    /**
     * Batch generate proxies for multiple files
     * @param {Array<string>} filenames - Array of filenames
     * @returns {Promise<Object>} Results object with success/failure counts
     */
    async batchGenerateProxies(filenames) {
        const results = {
            success: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        for (const filename of filenames) {
            try {
                const originalPath = path.join(this.uploadsDir, filename);
                
                if (!fileExists(originalPath)) {
                    results.skipped++;
                    continue;
                }

                if (this.hasProxy(filename)) {
                    results.skipped++;
                    continue;
                }

                const success = await this.generateProxy(originalPath, filename);
                if (success) {
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push(`Failed to generate proxy for ${filename}`);
                }
            } catch (error) {
                results.failed++;
                results.errors.push(`Error processing ${filename}: ${error.message}`);
            }
        }

        return results;
    }

    /**
     * Get proxy directory size
     * @returns {number} Total size in bytes
     */
    getProxyDirectorySize() {
        const fs = require('fs');
        let totalSize = 0;
        
        try {
            const files = fs.readdirSync(this.proxyDir);
            files.forEach(file => {
                const filePath = path.join(this.proxyDir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                }
            });
        } catch (error) {
            console.error('Error calculating proxy directory size:', error);
        }
        
        return totalSize;
    }

    /**
     * Get proxy statistics
     * @returns {Object} Proxy statistics
     */
    getProxyStats() {
        const fs = require('fs');
        const { formatFileSize } = require('../utils/fileHelpers');
        
        try {
            const files = fs.readdirSync(this.proxyDir);
            const totalSize = this.getProxyDirectorySize();
            
            return {
                count: files.length,
                totalSize: totalSize,
                formattedSize: formatFileSize(totalSize),
                directory: this.proxyDir
            };
        } catch (error) {
            return {
                count: 0,
                totalSize: 0,
                formattedSize: '0 Bytes',
                directory: this.proxyDir,
                error: error.message
            };
        }
    }
}

module.exports = new ProxyService();
