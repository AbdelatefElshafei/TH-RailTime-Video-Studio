const express = require('express');
const path = require('path');
const cuid = require('cuid');
const ffmpegService = require('../services/ffmpegService');
const proxyService = require('../services/proxyService');
const { fileExists } = require('../utils/fileHelpers');

const router = express.Router();

// In-memory job storage (in production, use Redis or database)
const jobs = {};

/**
 * Start render job
 * POST /render
 */
router.post('/render', (req, res) => {
    try {
        const { project } = req.body;
        
        if (!project) {
            return res.status(400).json({ 
                success: false, 
                message: 'Project data is required' 
            });
        }

        const jobId = cuid();
        jobs[jobId] = { 
            status: 'queued', 
            message: 'Render is in the queue.',
            progress: 0,
            createdAt: new Date()
        };
        
        console.log("🆕 New render job:", jobId);
        
        // Start render process asynchronously
        renderVideo(jobId, project);
        
        res.json({ success: true, jobId });

    } catch (error) {
        console.error('Render request error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to start render job', 
            error: error.message 
        });
    }
});

/**
 * Get render job status
 * GET /status/:jobId
 */
router.get('/status/:jobId', (req, res) => {
    try {
        const job = jobs[req.params.jobId];
        
        if (!job) {
            return res.status(404).json({ 
                success: false, 
                message: 'Job not found.' 
            });
        }
        
        res.json({ success: true, ...job });

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get job status', 
            error: error.message 
        });
    }
});

/**
 * Generate video preview
 * POST /preview
 */
router.post('/preview', async (req, res) => {
    try {
        const { project, timestamp, duration = 5, useProxy } = req.body;

        if (typeof timestamp !== 'number') {
            return res.status(400).json({ 
                success: false, 
                message: 'Timestamp is required' 
            });
        }

        const previewId = `preview_${timestamp}_${Date.now()}`;
        const previewFilename = `${previewId}.mp4`;
        const previewsDir = process.env.PREVIEWS_PATH || './previews';
        const previewPath = path.join(__dirname, '..', '..', previewsDir, previewFilename);

        console.log(`🔍 Generating video preview (Proxy: ${useProxy}) from ${timestamp}s for ${duration}s`);

        const success = await generatePreviewVideo(project, timestamp, duration, previewPath, useProxy);

        if (success) {
            res.json({
                success: true,
                previewUrl: `/previews/${previewFilename}`,
                timestamp,
                duration
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Preview generation failed' 
            });
        }

    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Preview generation error', 
            error: error.message 
        });
    }
});

/**
 * Generate thumbnail
 * POST /thumbnail
 */
router.post('/thumbnail', async (req, res) => {
    try {
        const { project, timestamp, useProxy } = req.body;

        if (typeof timestamp !== 'number') {
            return res.status(400).json({ 
                success: false, 
                message: 'A valid timestamp is required.' 
            });
        }

        const thumbId = `thumb_${timestamp.toFixed(2)}_${cuid.slug()}`;
        const thumbFilename = `${thumbId}.jpg`;
        const thumbnailsDir = process.env.THUMBNAILS_PATH || './thumbnails';
        const thumbPath = path.join(__dirname, '..', '..', thumbnailsDir, thumbFilename);

        const success = await generateThumbnail(project, timestamp, thumbPath, useProxy);
        
        if (success) {
            res.json({ 
                success: true, 
                thumbnailUrl: `/thumbnails/${thumbFilename}` 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Thumbnail generation failed.' 
            });
        }

    } catch (error) {
        console.error("Thumbnail endpoint error:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error generating thumbnail.' 
        });
    }
});

/**
 * Generate waveform data
 * GET /waveform/:filename
 */
router.get('/waveform/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const uploadsDir = process.env.MEDIA_PATH || './uploads';
        const waveformsDir = process.env.WAVEFORMS_PATH || './waveforms';
        const filePath = path.join(__dirname, '..', '..', uploadsDir, filename);
        
        if (!fileExists(filePath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'File not found.' 
            });
        }
        
        const waveformPath = path.join(__dirname, '..', '..', waveformsDir, `${filename}.json`);
        
        // Check if waveform already exists
        if (fileExists(waveformPath)) {
            try {
                const fs = require('fs');
                const waveformData = JSON.parse(fs.readFileSync(waveformPath, 'utf8'));
                return res.json({ success: true, waveform: waveformData });
            } catch (error) {
                console.error('Error reading waveform cache:', error);
            }
        }
        
        // Generate new waveform
        const tempRawPath = path.join(__dirname, '..', '..', waveformsDir, `${filename}.raw`);
        
        ffmpegService.createCommand()
            .input(filePath)
            .outputOptions([ '-f', 's16le', '-ac', '1', '-ar', '8000' ])
            .on('end', () => {
                try {
                    const fs = require('fs');
                    const rawData = fs.readFileSync(tempRawPath);
                    const samples = [];
                    
                    for (let i = 0; i < rawData.length; i += 2) {
                        samples.push(rawData.readInt16LE(i) / 32768.0);
                    }
                    
                    const waveform = [];
                    const samplesPerPixel = Math.max(1, Math.floor(samples.length / 200));
                    
                    for (let i = 0; i < samples.length; i += samplesPerPixel) {
                        const chunk = samples.slice(i, i + samplesPerPixel);
                        waveform.push({ max: Math.max(...chunk), min: Math.min(...chunk) });
                    }
                    
                    fs.writeFileSync(waveformPath, JSON.stringify(waveform));
                    fs.unlinkSync(tempRawPath);
                    
                    res.json({ success: true, waveform });
                } catch (error) {
                    console.error('Error processing waveform data:', error);
                    res.status(500).json({ 
                        success: false, 
                        message: 'Error processing waveform data.' 
                    });
                }
            })
            .on('error', (err) => {
                console.error('FFmpeg waveform error:', err);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error generating waveform.' 
                });
            })
            .save(tempRawPath);

    } catch (error) {
        console.error('Waveform error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error generating waveform', 
            error: error.message 
        });
    }
});

/**
 * Render video function
 * @param {string} jobId - Job ID
 * @param {Object} project - Project data
 */
async function renderVideo(jobId, project) {
    try {
        jobs[jobId].status = 'processing';
        const projWidth = project.settings?.width || 1280;
        const projHeight = project.settings?.height || 720;
        
        const uploadsDir = process.env.MEDIA_PATH || './uploads';
        const processedDir = process.env.PROCESSED_PATH || './processed';
        const command = ffmpegService.createCommand();
        let complexFilters = [];
        const outputFilename = `final-${jobId}.mp4`;
        const outputPath = path.join(__dirname, '..', '..', processedDir, outputFilename);
        
        console.log(`🎬 Starting render job: ${jobId} at ${projWidth}x${projHeight}`);

        const allClips = project.tracks.flatMap(track => track.clips);
        const uniqueInputs = [...new Set(allClips.map(clip => clip.src).filter(Boolean))];
        
        uniqueInputs.forEach((src, index) => {
            if (src) {
                const inputPath = path.join(__dirname, '..', '..', uploadsDir, src);
                command.addInput(inputPath);
                console.log(`📁 Input ${index}: ${src}`);
            }
        });

        const projectDuration = Math.max(0, ...allClips.map(c => c.timelineStart + c.duration));
        
        // Create base canvas using a simpler approach
        let currentVideoStream = `[base_canvas]`;
        complexFilters.push(`color=s=${projWidth}x${projHeight}:c=black,format=yuva420p[base_canvas]`);
        
        const videoTracks = project.tracks.filter(t => t.type === 'video').sort((a,b) => project.tracks.indexOf(a) - project.tracks.indexOf(b));

        for(const track of videoTracks) {
            // Create track composite stream
            let trackCompositeStream = `[track_base_${track.id}]`;
            complexFilters.push(`color=s=${projWidth}x${projHeight}:c=black${trackCompositeStream}`);

            for (const clip of track.clips.filter(c => c.type === 'video')) {
                const inputIndex = uniqueInputs.indexOf(clip.src);
                let stream = `[${inputIndex}:v]trim=${clip.start}:${clip.start + clip.originalDuration},setpts=PTS-STARTPTS`;
                
                const visualFX = ffmpegService.buildVisualFilters(clip, false);
                if(visualFX) stream += `,${visualFX}`;

                const scaleExpr = ffmpegService.buildKeyframeExpression(clip.transform.scale.keyframes, clip.transform.scale.value, clip.timelineStart);
                const xExpr = ffmpegService.buildKeyframeExpression(clip.transform.x.keyframes, clip.transform.x.value, clip.timelineStart);
                const yExpr = ffmpegService.buildKeyframeExpression(clip.transform.y.keyframes, clip.transform.y.value, clip.timelineStart);

                stream += `,scale=w='iw*(${scaleExpr})':h=-1,scale=${projWidth}:${projHeight}:force_original_aspect_ratio=decrease,pad=${projWidth}:${projHeight}:-1:-1`;
                
                complexFilters.push(`${stream}[clip_${clip.id}_processed]`);
                
                const newTrackComposite = `[track_comp_${clip.id}]`;
                complexFilters.push(`${trackCompositeStream}[clip_${clip.id}_processed]overlay=x='(${xExpr})':y='(${yExpr})':enable='between(t,${clip.timelineStart},${clip.timelineStart+clip.duration})'${newTrackComposite}`);
                trackCompositeStream = newTrackComposite;
            }

            // Apply adjustment layers
            for (const adjClip of track.clips.filter(c => c.type === 'adjustment')) {
                const adjFX = ffmpegService.buildVisualFilters(adjClip, false);
                if (adjFX) {
                    const adjStream = `[adj_applied_${adjClip.id}]`;
                    complexFilters.push(`${currentVideoStream}split[adj_in_${adjClip.id}][adj_passthru_${adjClip.id}]`);
                    complexFilters.push(`[adj_in_${adjClip.id}]${adjFX}[adj_fx_${adjClip.id}]`);
                    complexFilters.push(`[adj_passthru_${adjClip.id}][adj_fx_${adjClip.id}]overlay=enable='between(t,${adjClip.timelineStart},${adjClip.timelineStart+adjClip.duration})'${adjStream}`);
                    currentVideoStream = adjStream;
                }
            }

            const finalTrackStream = `[final_track_${track.id}]`;
            complexFilters.push(`${currentVideoStream}${trackCompositeStream}overlay=0:0${finalTrackStream}`);
            currentVideoStream = finalTrackStream;
        }
        
        // Add text tracks
        const textTrack = project.tracks.find(t => t.type === 'text');
        if (textTrack && textTrack.clips.length > 0) {
            textTrack.clips.forEach(clip => {
                const fontPath = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';
                const escapedText = clip.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
                const newVideoStream = `[vchain_text_${clip.id}]`;
                complexFilters.push(`${currentVideoStream}drawtext=fontfile='${fontPath}':text='${escapedText}':x=${clip.transform.x.value}:y=${clip.transform.y.value}:fontsize=${clip.fontSize}:fontcolor=${clip.fontColor}:enable='between(t,${clip.timelineStart},${clip.timelineStart + clip.duration})'${newVideoStream}`);
                currentVideoStream = newVideoStream;
            });
        }
        
        complexFilters.push(`${currentVideoStream}copy[outv]`);

        // Process audio tracks
        let audioMixInputs = [];
        
        // Process dedicated audio tracks
        const audioTracks = project.tracks.filter(t => t.type === 'audio');
        console.log(`🎵 Processing ${audioTracks.length} dedicated audio tracks`);
        audioTracks.forEach(track => {
            track.clips.forEach(clip => {
                const inputIndex = uniqueInputs.indexOf(clip.src);
                let audioClipStream = `[${inputIndex}:a:0]atrim=start=${clip.start}:duration=${clip.originalDuration},asetpts=PTS-STARTPTS`;
                
                let audioTimeFilters = [];
                if (clip.reverse) audioTimeFilters.push('areverse');
                if (clip.speed !== 1) audioTimeFilters.push(`atempo=${clip.speed}`);
                if(audioTimeFilters.length > 0) audioClipStream += `,${audioTimeFilters.join(',')}`;
                
                const audioFX = ffmpegService.buildAudioFilters(clip);
                if(audioFX.length > 0) audioClipStream += `,${audioFX.join(',')}`;

                const pan = track.pan ?? 0;
                const leftGain = Math.cos((pan + 1) * Math.PI / 4);
                const rightGain = Math.sin((pan + 1) * Math.PI / 4);
                
                audioClipStream += `,volume=${clip.volume},volume=${track.volume ?? 1},pan=stereo|c0=${leftGain.toFixed(3)}*c0|c1=${rightGain.toFixed(3)}*c1,adelay=${clip.timelineStart * 1000}|${clip.timelineStart * 1000}[aclip${clip.id}]`;
                
                complexFilters.push(audioClipStream);
                audioMixInputs.push(`[aclip${clip.id}]`);
            });
        });

        // Process audio from video tracks (embedded audio)
        const videoTracksForAudio = project.tracks.filter(t => t.type === 'video');
        console.log(`🎬 Processing audio from ${videoTracksForAudio.length} video tracks`);
        videoTracksForAudio.forEach(track => {
            track.clips.forEach(clip => {
                const inputIndex = uniqueInputs.indexOf(clip.src);
                const clipStart = clip.timelineStart;
                const clipEnd = clip.timelineStart + clip.duration;
                
                if (clipEnd > 0 && clipStart < projectDuration) {
                    const sourceStart = clip.start + Math.max(0, 0 - clipStart) * clip.speed;
                    const sourceEnd = sourceStart + (clipEnd - Math.max(0, clipStart)) * clip.speed;
                    const timelineDelay = Math.max(0, clipStart) * 1000;
                    
                    // Process audio from video track with proper timing
                    let audioClipStream = `[${inputIndex}:a:0]atrim=start=${sourceStart}:end=${sourceEnd},asetpts=PTS-STARTPTS`;
                    
                    let audioTimeFilters = [];
                    if (clip.reverse) audioTimeFilters.push('areverse');
                    if (clip.speed !== 1) audioTimeFilters.push(`atempo=${clip.speed}`);
                    if(audioTimeFilters.length > 0) audioClipStream += `,${audioTimeFilters.join(',')}`;
                    
                    const audioFX = ffmpegService.buildAudioFilters(clip);
                    if(audioFX.length > 0) audioClipStream += `,${audioFX.join(',')}`;

                    const pan = track.pan ?? 0;
                    const leftGain = Math.cos((pan + 1) * Math.PI / 4);
                    const rightGain = Math.sin((pan + 1) * Math.PI / 4);
                    
                    audioClipStream += `,volume=${clip.volume || 1},volume=${track.volume ?? 1},pan=stereo|c0=${leftGain.toFixed(3)}*c0|c1=${rightGain.toFixed(3)}*c1,adelay=${timelineDelay}|${timelineDelay}[avideo${clip.id}]`;
                    
                    complexFilters.push(audioClipStream);
                    audioMixInputs.push(`[avideo${clip.id}]`);
                }
            });
        });

        if (audioMixInputs.length > 0) {
            console.log(`🎵 Mixing ${audioMixInputs.length} audio sources`);
            complexFilters.push(`${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}:dropout_transition=3[outa]`);
        } else {
            console.log(`⚠️ No audio sources found - video will be rendered without audio`);
        }

        console.log("🧩 Final filter_complex:\n", complexFilters.join(';'));
        command.complexFilter(complexFilters.join(';'));
        command.outputOptions('-map', '[outv]');
        if (audioMixInputs.length > 0) command.outputOptions('-map', '[outa]');
        command.outputOptions('-c:v', 'libx264', '-c:a', 'aac', '-movflags', 'faststart', '-t', projectDuration.toString());
        
        command
            .on('start', cmd => console.log("🚀 FFmpeg command:", cmd))
            .on('progress', progress => { 
                jobs[jobId].progress = progress.percent < 0 ? 0 : progress.percent; 
                jobs[jobId].message = `Rendering... ${Math.round(jobs[jobId].progress || 0)}%`; 
                console.log("⏳ Progress:", jobs[jobId].progress); 
            })
            .on('end', () => { 
                jobs[jobId] = { 
                    status: 'complete', 
                    progress: 100, 
                    message: 'Render finished!', 
                    downloadUrl: `/processed/${outputFilename}`,
                    completedAt: new Date()
                }; 
                console.log("✅ Render finished:", outputPath); 
            })
            .on('error', (err) => { 
                console.error("❌ FFmpeg error:", err.message); 
                jobs[jobId] = { 
                    status: 'error', 
                    message: 'Render failed. Check server console.', 
                    error: err.message,
                    failedAt: new Date()
                }; 
            })
            .save(outputPath);

    } catch (err) {
        console.error("💥 Critical error:", err);
        jobs[jobId] = { 
            status: 'error', 
            message: 'A critical server error occurred.', 
            error: err.message,
            failedAt: new Date()
        };
    }
}

/**
 * Generate preview video
 * @param {Object} project - Project data
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration in seconds
 * @param {string} outputPath - Output file path
 * @param {boolean} useProxy - Whether to use proxy files
 * @returns {Promise<boolean>} Success status
 */
async function generatePreviewVideo(project, startTime, duration, outputPath, useProxy = false) {
    return new Promise((resolve) => {
        try {
            const projWidth = project.settings?.width || 1280;
            const projHeight = project.settings?.height || 720;
            const uploadsDir = process.env.MEDIA_PATH || './uploads';

            const command = ffmpegService.createCommand();
            let videoFilters = [];
            let audioFilters = [];

            const allClips = project.tracks.flatMap(track => track.clips);
            const uniqueInputs = [...new Set(allClips.map(clip => clip.src).filter(Boolean))];

            uniqueInputs.forEach(src => {
                if (src) {
                    const filePath = proxyService.getFilePath(src, useProxy);
                    if (fileExists(filePath)) {
                        command.addInput(filePath);
                    } else {
                        const fallbackPath = path.join(__dirname, '..', '..', uploadsDir, src);
                        if(fileExists(fallbackPath)) command.addInput(fallbackPath);
                    }
                }
            });

            const endTime = startTime + duration;
            const projectDuration = Math.max(0, ...allClips.map(c => c.timelineStart + c.duration));
            const actualDuration = Math.min(duration, projectDuration - startTime);

            if (actualDuration <= 0) {
                console.log('❌ Invalid preview duration');
                resolve(false); 
                return;
            }

            // Create base canvas
            let currentVideoStream = `[base]`;
            videoFilters.push(`color=s=${projWidth}x${projHeight}:c=black,format=yuva420p[base]`);
            
            const videoTracks = project.tracks.filter(t => t.type === 'video').sort((a,b) => project.tracks.indexOf(a) - project.tracks.indexOf(b));

            for(const track of videoTracks) {
                let trackCompStream = currentVideoStream;
                
                const clipsOnTrack = track.clips.filter(c => c.type === 'video');
                
                clipsOnTrack.forEach(clip => {
                    const clipStart = clip.timelineStart;
                    const clipEnd = clip.timelineStart + clip.duration;

                    if (clipEnd > startTime && clipStart < endTime) {
                        const inputIndex = uniqueInputs.indexOf(clip.src);
                        const previewClipStart = Math.max(0, clipStart - startTime);
                        const previewClipEnd = Math.min(actualDuration, clipEnd - startTime);
                        const sourceStart = clip.start + Math.max(0, startTime - clipStart) * clip.speed;

                        let clipStream = `[${inputIndex}:v:0]trim=start=${sourceStart},setpts=PTS-STARTPTS`;
                        
                        // Apply masking if enabled
                        if (clip.mask && clip.mask.enabled && clip.mask.path.length > 2) {
                            const points = clip.mask.path.map(p => `${p.x}*${clip.originalWidth/projWidth}/${p.y}*${clip.originalHeight/projHeight}`).join(':');
                            videoFilters.push(`color=s=${clip.originalWidth}x${clip.originalHeight}:c=black,drawfill=c=white:p=${points}[mask_${clip.id}]`);
                            videoFilters.push(`[${inputIndex}:v:0][mask_${clip.id}]alphamerge[clip_alpha_${clip.id}]`);
                            clipStream = `[clip_alpha_${clip.id}]trim=start=${sourceStart},setpts=PTS-STARTPTS`;
                        }
                        
                        const visualFX = ffmpegService.buildVisualFilters(clip, { isPreview: true, startTime });
                        if (visualFX) clipStream += `,${visualFX}`;
                        
                        const scaleExpr = ffmpegService.buildKeyframeExpression(clip.transform.scale.keyframes, clip.transform.scale.value, clipStart);
                        const xExpr = ffmpegService.buildKeyframeExpression(clip.transform.x.keyframes, clip.transform.x.value, clipStart);
                        const yExpr = ffmpegService.buildKeyframeExpression(clip.transform.y.keyframes, clip.transform.y.value, clipStart);
                        
                        clipStream += `,scale=w='iw*(${scaleExpr})':h=-1,scale=${projWidth}:${projHeight}:force_original_aspect_ratio=decrease,pad=${projWidth}:${projHeight}:-1:-1`;
                        
                        const processedClipStream = `[vclip${clip.id}]`;
                        videoFilters.push(clipStream + processedClipStream);

                        const newVideoStream = `[vchain${clip.id}]`;
                        videoFilters.push(`${trackCompStream}${processedClipStream}overlay=x='(${xExpr})':y='(${yExpr})':enable='between(t,${previewClipStart},${previewClipEnd})'${newVideoStream}`);
                        trackCompStream = newVideoStream;
                    }
                });

                // Apply adjustment layers
                const adjLayersOnTrack = track.clips.filter(c => c.type === 'adjustment');
                adjLayersOnTrack.forEach(adjClip => {
                    const clipStart = adjClip.timelineStart;
                    const clipEnd = adjClip.timelineStart + adjClip.duration;
                    if (clipEnd > startTime && clipStart < endTime) {
                        const previewClipStart = Math.max(0, clipStart - startTime);
                        const previewClipEnd = Math.min(actualDuration, clipEnd - startTime);
                        
                        const adjFX = ffmpegService.buildVisualFilters(adjClip, { isPreview: true, startTime });
                        if (adjFX) {
                            const adjStream = `[adj_applied_${adjClip.id}]`;
                            videoFilters.push(`${currentVideoStream}split[adj_in_${adjClip.id}][adj_passthru_${adjClip.id}]`);
                            videoFilters.push(`[adj_in_${adjClip.id}]${adjFX}[adj_fx_${adjClip.id}]`);
                            videoFilters.push(`[adj_passthru_${adjClip.id}][adj_fx_${adjClip.id}]overlay=enable='between(t,${previewClipStart},${previewClipEnd})'${adjStream}`);
                            currentVideoStream = adjStream;
                        }
                    }
                });

                currentVideoStream = trackCompStream;
            }

            // Add text tracks
            const textTrack = project.tracks.find(t => t.type === 'text');
            if (textTrack && textTrack.clips.length > 0) {
                textTrack.clips.forEach(clip => {
                    const clipStart = clip.timelineStart;
                    const clipEnd = clip.timelineStart + clip.duration;
                    if (clipEnd > startTime && clipStart < endTime) {
                        const fontPath = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';
                        const escapedText = clip.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
                        const previewClipStart = Math.max(0, clipStart - startTime);
                        const previewClipEnd = Math.min(actualDuration, clipEnd - startTime);
                        const newVideoStream = `[vchain_text${clip.id}]`;
                        videoFilters.push(`${currentVideoStream}drawtext=fontfile='${fontPath}':text='${escapedText}':x=${clip.transform.x.value}:y=${clip.transform.y.value}:fontsize=${clip.fontSize}:fontcolor=${clip.fontColor}:enable='between(t,${previewClipStart},${previewClipEnd})'${newVideoStream}`);
                        currentVideoStream = newVideoStream;
                    }
                });
            }

            videoFilters.push(`${currentVideoStream}copy[outv]`);

            // Process audio from both audio tracks and video tracks
            let audioMixInputs = [];
            
            // Process dedicated audio tracks
            project.tracks.filter(t => t.type === 'audio').forEach(track => {
                track.clips.forEach(clip => {
                    const clipStart = clip.timelineStart;
                    const clipEnd = clip.timelineStart + clip.duration;
                    if (clipEnd > startTime && clipStart < endTime) {
                        const inputIndex = uniqueInputs.indexOf(clip.src);
                        const sourceStart = clip.start + Math.max(0, startTime - clipStart);
                        const previewDelay = Math.max(0, clipStart - startTime) * 1000;
                        const pan = track.pan ?? 0;
                        const leftGain = Math.cos((pan + 1) * Math.PI / 4);
                        const rightGain = Math.sin((pan + 1) * Math.PI / 4);
                        
                        const audioFX = ffmpegService.buildAudioFilters(clip);

                        let clipStream = `[${inputIndex}:a:0]atrim=start=${sourceStart},asetpts=PTS-STARTPTS`;
                        if(audioFX.length > 0) clipStream += `,${audioFX.join(',')}`;
                        clipStream += `,volume=${clip.volume},volume=${track.volume ?? 1},pan=stereo|c0=${leftGain}*c0|c1=${rightGain}*c1,adelay=${previewDelay}|${previewDelay}[aclip${clip.id}]`;

                        audioFilters.push(clipStream);
                        audioMixInputs.push(`[aclip${clip.id}]`);
                    }
                });
            });

            // Process audio from video tracks (embedded audio)
            project.tracks.filter(t => t.type === 'video').forEach(track => {
                track.clips.forEach(clip => {
                    const clipStart = clip.timelineStart;
                    const clipEnd = clip.timelineStart + clip.duration;
                    if (clipEnd > startTime && clipStart < endTime) {
                        const inputIndex = uniqueInputs.indexOf(clip.src);
                        const sourceStart = clip.start + Math.max(0, startTime - clipStart) * clip.speed;
                        const previewDelay = Math.max(0, clipStart - startTime) * 1000;
                        
                        // Check if the input has audio
                        const audioStream = `[${inputIndex}:a:0]atrim=start=${sourceStart},asetpts=PTS-STARTPTS,volume=${clip.volume || 1},adelay=${previewDelay}|${previewDelay}[avideo${clip.id}]`;
                        audioFilters.push(audioStream);
                        audioMixInputs.push(`[avideo${clip.id}]`);
                    }
                });
            });

            if (audioMixInputs.length > 0) {
                audioFilters.push(`${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}[outa]`);
            }

            const allFilters = [...videoFilters, ...audioFilters];
            const filterString = allFilters.join(';');
            console.log('🔧 FFmpeg filter chain:', filterString);
            command.complexFilter(filterString);
            command.outputOptions('-map', '[outv]');
            if (audioMixInputs.length > 0) command.outputOptions('-map', '[outa]');
            
            const encodingOptions = [ '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-movflags', 'faststart', '-t', actualDuration.toString() ];
            command.outputOptions(...encodingOptions);
            
            command
                .on('start', cmd => {
                    console.log(`🚀 Preview FFmpeg command: ${cmd}`);
                    console.log(`📁 Output path: ${outputPath}`);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`📊 Render progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => { 
                    console.log(`✅ Video preview generated: ${outputPath}`); 
                    resolve(true); 
                })
                .on('error', (err) => { 
                    console.error(`❌ Preview error: ${err.message}`);
                    console.error(`❌ Error details:`, err);
                    console.error(`❌ Filter chain that failed:`, filterString);
                    resolve(false); 
                })
                .save(outputPath);
                
        } catch (err) {
            console.error("💥 Preview generation error:", err);
            resolve(false);
        }
    });
}

/**
 * Generate thumbnail
 * @param {Object} project - Project data
 * @param {number} timestamp - Timestamp in seconds
 * @param {string} outputPath - Output file path
 * @param {boolean} useProxy - Whether to use proxy files
 * @returns {Promise<boolean>} Success status
 */
async function generateThumbnail(project, timestamp, outputPath, useProxy = false) {
    return new Promise((resolve) => {
        try {
            const projWidth = project.settings?.width || 1280;
            const projHeight = project.settings?.height || 720;
            const uploadsDir = process.env.MEDIA_PATH || './uploads';
            
            const command = ffmpegService.createCommand();
            let complexFilters = [];

            // Find visible video clips at timestamp
            const visibleVideoClips = project.tracks
                .filter(t => t.type === 'video')
                .flatMap(t => t.clips)
                .filter(c => c.type === 'video' && timestamp >= c.timelineStart && timestamp < c.timelineStart + c.duration)
                .sort((a,b) => project.tracks.findIndex(t => t.id === a.trackId) - project.tracks.findIndex(t => t.id === b.trackId));
            
            const visibleInputs = [...new Set(visibleVideoClips.map(c => c.src))];
            
            if (visibleInputs.length === 0) {
                // Skip black frame thumbnail generation for now
                console.log('⚠️ No visible clips, skipping thumbnail generation');
                resolve(false);
                return;
            }

            visibleInputs.forEach(src => {
                const filePath = proxyService.getFilePath(src, useProxy);
                if (fileExists(filePath)) {
                    command.addInput(filePath);
                } else {
                    const fallbackPath = path.join(__dirname, '..', '..', uploadsDir, src);
                    if (fileExists(fallbackPath)) command.addInput(fallbackPath);
                }
            });

            complexFilters.push(`color=s=${projWidth}x${projHeight}:c=black:d=1[base]`);
            let lastVideoStream = '[base]';

            // Process visible clips
            visibleVideoClips.forEach(clip => {
                const inputIndex = visibleInputs.indexOf(clip.src);
                const timeIntoClip = (timestamp - clip.timelineStart) * clip.speed;
                const sourceTime = clip.start + timeIntoClip;
                
                const scaleValue = ffmpegService.getAnimatedValueAtTime(clip, 'transform.scale', timestamp);
                const xValue = ffmpegService.getAnimatedValueAtTime(clip, 'transform.x', timestamp);
                const yValue = ffmpegService.getAnimatedValueAtTime(clip, 'transform.y', timestamp);

                let clipStream = `[${inputIndex}:v:0]trim=start=${sourceTime}:duration=0.1,setpts=PTS-STARTPTS`;
                const visualFX = ffmpegService.buildVisualFilters(clip, false);
                if(visualFX) clipStream += `,${visualFX}`;
                
                clipStream += `,scale=w=${clip.originalWidth * scaleValue}:h=-1,scale=${projWidth}:${projHeight}:force_original_aspect_ratio=decrease,pad=${projWidth}:${projHeight}:-1:-1[fg_${clip.id}]`;
                
                const newStream = `[comp_${clip.id}]`;
                complexFilters.push(clipStream);
                complexFilters.push(`${lastVideoStream}[fg_${clip.id}]overlay=${xValue}:${yValue}${newStream}`);
                lastVideoStream = newStream;
            });
            
            complexFilters.push(`${lastVideoStream}scale=160:-1[thumb_scaled]`);

            command.complexFilter(complexFilters.join(';'));
            
            const thumbOptions = [ '-map', '[thumb_scaled]', '-vframes', '1', '-q:v', '5', '-f', 'image2' ];
            command.outputOptions(...thumbOptions);

            command
                .on('start', cmd => console.log(`📸 Thumbnail command: ${cmd}`))
                .on('end', () => { 
                    console.log(`✅ Thumbnail generated: ${outputPath}`); 
                    resolve(true); 
                })
                .on('error', (err) => { 
                    console.error(`❌ Thumbnail generation error: ${err.message}`); 
                    resolve(false); 
                })
                .save(outputPath);

        } catch (err) {
            console.error("💥 Thumbnail generation critical error:", err);
            resolve(false);
        }
    });
}

// List available LUT files
router.get('/luts', (req, res) => {
    try {
        const lutsDir = path.join(__dirname, '..', '..', 'luts');
        
        if (!fs.existsSync(lutsDir)) {
            return res.json({
                success: true,
                luts: []
            });
        }
        
        const lutFiles = fs.readdirSync(lutsDir)
            .filter(file => file.endsWith('.cube') || file.endsWith('.3dl') || 
                          file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
            .map(file => {
                const filePath = path.join(lutsDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    modified: stats.mtime,
                    type: file.split('.').pop().toLowerCase()
                };
            });
        
        res.json({
            success: true,
            luts: lutFiles
        });
        
    } catch (error) {
        console.error('Error listing LUTs:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to list LUT files', 
            error: error.message 
        });
    }
});

// Test LUT functionality
router.post('/test-lut', async (req, res) => {
    try {
        const { lutFile } = req.body;
        
        if (!lutFile) {
            return res.status(400).json({ 
                success: false, 
                message: 'LUT file name required' 
            });
        }

        const lutPath = path.join(__dirname, '..', '..', 'luts', lutFile);
        
        if (!fs.existsSync(lutPath)) {
            return res.status(404).json({ 
                success: false, 
                message: `LUT file not found: ${lutFile}` 
            });
        }

        const absolutePath = path.resolve(lutPath);
        const escapedPath = absolutePath.replace(/\\/g, '/').replace(/:/g, '\\:');
        
        res.json({
            success: true,
            message: 'LUT file found and path processed',
            data: {
                originalPath: lutPath,
                absolutePath: absolutePath,
                escapedPath: escapedPath,
                fileExists: true,
                fileSize: fs.statSync(lutPath).size
            }
        });
        
    } catch (error) {
        console.error('LUT test error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'LUT test failed', 
            error: error.message 
        });
    }
});

module.exports = {
    router,
    renderVideo,
    generatePreviewVideo,
    generateThumbnail
};
