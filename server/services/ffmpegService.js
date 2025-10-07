const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { fileExists } = require('../utils/fileHelpers');

/**
 * FFmpeg service for video processing operations
 */

class FFmpegService {
    constructor() {
        this.ffmpegPath = process.env.FFMPEG_PATH || '';
        this.ffprobePath = process.env.FFPROBE_PATH || '';
        
        this.initializeFFmpeg();
    }

    /**
     * Initialize FFmpeg paths
     */
    initializeFFmpeg() {
        if (this.ffmpegPath) {
            ffmpeg.setFfmpegPath(this.ffmpegPath);
            console.log(`🔧 FFmpeg path set to: ${this.ffmpegPath}`);
        }
        
        if (this.ffprobePath) {
            ffmpeg.setFfprobePath(this.ffprobePath);
            console.log(`🔧 FFprobe path set to: ${this.ffprobePath}`);
        }
    }

    /**
     * Build keyframe expression for animated properties
     * @param {Array} keyframes - Array of keyframe objects
     * @param {*} defaultValue - Default value if no keyframes
     * @param {number} clipStartTime - Clip start time for offset calculation
     * @returns {string} FFmpeg expression string
     */
    buildKeyframeExpression(keyframes, defaultValue, clipStartTime) {
        if (!keyframes || keyframes.length === 0) {
            return String(defaultValue || 1);
        }
        
        const sortedKfs = [...keyframes].sort((a, b) => a.time - b.time);
        
        if (sortedKfs.length === 1) {
            return String(sortedKfs[0].value || 1);
        }

        let expr = '';
        
        for (let i = 0; i < sortedKfs.length - 1; i++) {
            const kf1 = sortedKfs[i];
            const kf2 = sortedKfs[i + 1];

            const time1 = kf1.time - clipStartTime;
            const time2 = kf2.time - clipStartTime;
            const val1 = kf1.value;
            const val2 = kf2.value;
            
            const duration = time2 - time1;
            if (duration <= 0) continue;
            
            const slope = (val2 - val1) / duration;
            const intercept = val1 - slope * time1;

            expr += `if(between(t,${time1},${time2}), ${intercept}+(t*${slope}), `;
        }

        expr += sortedKfs[sortedKfs.length - 1].value;

        for (let i = 0; i < sortedKfs.length - 1; i++) {
            expr += ')';
        }
        
        const firstKfTime = sortedKfs[0].time - clipStartTime;
        const firstKfValue = sortedKfs[0].value;
        expr = `if(lt(t,${firstKfTime}),${firstKfValue},${expr})`;
        
        return expr;
    }

    /**
     * Build visual filters for a clip
     * @param {Object} clip - Clip object
     * @param {boolean} isForPreview - Whether this is for preview
     * @returns {string} FFmpeg filter string
     */
    buildVisualFilters(clip, isForPreview = false) {
        const filters = [];
        const f = clip.filters || {};

        // Chroma key
        if (clip.keying && clip.keying.enabled) {
            const color = clip.keying.color.startsWith('#') ? '0x' + clip.keying.color.substring(1) : clip.keying.color;
            filters.push(`chromakey=color=${color}:similarity=${clip.keying.similarity}:blend=${clip.keying.blend}`);
        }
            
        // Basic color correction
        const brightness = f.brightness ?? 0;
        const contrast = f.contrast ?? 1;
        const saturation = f.saturation ?? 1;
        filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);

        // Color wheels
        const cw = f.colorWheels;
        if (cw && (cw.liftY !== 0 || cw.gammaY !== 0 || cw.gainY !== 0 || cw.lift.r !== 0 || cw.gamma.r !== 0 || cw.gain.r !== 0)) {
            const clamp = (val) => Math.max(0, Math.min(1, val));
            
            const R = `0/${clamp(cw.lift.r + cw.liftY + 0)} 0.5/${clamp(cw.gamma.r + cw.gammaY + 0.5)} 1/${clamp(cw.gain.r + cw.gainY + 1)}`;
            const G = `0/${clamp(cw.lift.g + cw.liftY + 0)} 0.5/${clamp(cw.gamma.g + cw.gammaY + 0.5)} 1/${clamp(cw.gain.g + cw.gainY + 1)}`;
            const B = `0/${clamp(cw.lift.b + cw.liftY + 0)} 0.5/${clamp(cw.gamma.b + cw.gammaY + 0.5)} 1/${clamp(cw.gain.b + cw.gainY + 1)}`;
            
            filters.push(`curves=r='${R}':g='${G}':b='${B}'`);
        }

        // RGB Curves
        if (f.curves) {
            const sanitizedCurves = f.curves.replace(/[^0-9\.\/ ]/g, '');
            filters.push(`curves=master='${sanitizedCurves}'`);
        }

        // LUT - Fixed for Windows compatibility
        if (f.lut) {
            const lutPath = path.join(process.env.LUTS_PATH || './luts', f.lut);
            if (fileExists(lutPath)) {
                try {
                    // Use absolute path and proper escaping for Windows
                    const absolutePath = path.resolve(lutPath);
                    console.log(`🎨 Applying LUT: ${f.lut} from ${absolutePath}`);
                    
                    // Use appropriate LUT filter based on file extension
                    if (f.lut.endsWith('.cube')) {
                        // For .cube files, use lut3d filter with proper Windows path handling
                        const escapedPath = absolutePath.replace(/\\/g, '/').replace(/:/g, '\\:');
                        filters.push(`lut3d=file='${escapedPath}'`);
                    } else if (f.lut.endsWith('.3dl')) {
                        // For .3dl files, use lut3d filter
                        const escapedPath = absolutePath.replace(/\\/g, '/').replace(/:/g, '\\:');
                        filters.push(`lut3d=file='${escapedPath}'`);
                    } else if (f.lut.endsWith('.png') || f.lut.endsWith('.jpg') || f.lut.endsWith('.jpeg')) {
                        // For image LUTs, use lut filter
                        const escapedPath = absolutePath.replace(/\\/g, '/').replace(/:/g, '\\:');
                        filters.push(`lut=file='${escapedPath}'`);
                    } else {
                        console.warn(`⚠️ Unsupported LUT format: ${f.lut}. Supported: .cube, .3dl, .png, .jpg, .jpeg`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Error processing LUT ${f.lut}:`, error.message);
                }
            } else {
                console.warn(`⚠️ LUT file not found: ${lutPath}`);
            }
        }
        
        // Effects
        if (clip.effects && Array.isArray(clip.effects)) {
            clip.effects.forEach(effect => {
                if (effect.type === 'blur' && effect.params?.strength > 0) {
                    filters.push(`gblur=sigma=${effect.params.strength}`);
                }
                if (effect.type === 'sharpen' && effect.params?.strength > 0) {
                    filters.push(`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${effect.params.strength}`);
                }
            });
        }

        filters.push(`format=yuva420p`);
        
        const clipStartTime = isForPreview ? (clip.timelineStart - (isForPreview.startTime || 0)) : clip.timelineStart;
        
        // Ensure clip.opacity exists and has the expected structure
        const opacity = clip.opacity || { keyframes: [], value: 1 };
        const opacityExpr = this.buildKeyframeExpression(opacity.keyframes, opacity.value, clipStartTime);
        
        console.log('🔍 Opacity expression:', opacityExpr, 'Type:', typeof opacityExpr);
        
        // Use a more compatible opacity filter
        if (opacityExpr && typeof opacityExpr === 'string' && opacityExpr !== '1' && opacityExpr !== '(1)') {
            try {
                // Remove parentheses from the expression for colorchannelmixer
                const cleanOpacityExpr = opacityExpr.replace(/[()]/g, '');
                // Only apply if the value is not 1 (no opacity change needed)
                if (cleanOpacityExpr !== '1') {
                    filters.push(`colorchannelmixer=aa=${cleanOpacityExpr}`);
                }
            } catch (error) {
                console.warn('⚠️ Error processing opacity expression:', error.message);
            }
        }

        return filters.join(',');
    }

    /**
     * Build audio filters for a clip
     * @param {Object} clip - Clip object
     * @returns {Array} Array of FFmpeg filter strings
     */
    buildAudioFilters(clip) {
        const filters = [];
        if (clip.effects && Array.isArray(clip.effects)) {
            clip.effects.forEach(effect => {
                if (effect.type === 'compressor') {
                    const p = effect.params;
                    const threshold = 10 ** (p.threshold / 20);
                    filters.push(`acompressor=threshold=${threshold}:ratio=${p.ratio}:attack=${p.attack}:release=${p.release}`);
                }
                if (effect.type === 'equalizer') {
                    const bands = effect.params.bands
                        .map((b, i) => `${i+1}b=${b.g}`)
                        .join(':');
                    filters.push(`superequalizer=${bands}`);
                }
            });
        }
        return filters;
    }

    /**
     * Get animated value at specific time
     * @param {Object} clip - Clip object
     * @param {string} propPath - Property path (e.g., 'transform.scale')
     * @param {number} time - Time to get value at
     * @returns {*} Animated value
     */
    getAnimatedValueAtTime(clip, propPath, time) {
        const prop = propPath.split('.').reduce((acc, part) => acc && acc[part], clip);
        if (!prop || !prop.keyframes || prop.keyframes.length === 0) {
            return prop.value;
        }
        const kfs = prop.keyframes;
        if (time <= kfs[0].time) return kfs[0].value;
        if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
        
        let prevKf = kfs[0];
        for (let i = 1; i < kfs.length; i++) {
            const nextKf = kfs[i];
            if (time >= prevKf.time && time <= nextKf.time) {
                const timeDiff = nextKf.time - prevKf.time;
                if (timeDiff === 0) return prevKf.value;
                const progress = (time - prevKf.time) / timeDiff;
                return prevKf.value + (nextKf.value - prevKf.value) * progress;
            }
            prevKf = nextKf;
        }
        return prop.value;
    }

    /**
     * Create FFmpeg command instance
     * @returns {Object} FFmpeg command instance
     */
    createCommand() {
        return ffmpeg();
    }

    /**
     * Get video information
     * @param {string} filePath - Path to video file
     * @returns {Promise<Object>} Video metadata
     */
    getVideoInfo(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(metadata);
                }
            });
        });
    }

    /**
     * Check if FFmpeg is available
     * @returns {Promise<boolean>} True if FFmpeg is available
     */
    async isAvailable() {
        return new Promise((resolve) => {
            ffmpeg.getAvailableFormats((err, formats) => {
                resolve(!err);
            });
        });
    }
}

module.exports = new FFmpegService();
