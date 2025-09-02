

const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cuid = require('cuid');

const app = express();
const port = 3000;


app.use(cors());
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use('/processed', express.static(path.join(__dirname, 'processed')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/previews', express.static(path.join(__dirname, 'previews')));

const jobs = {}; 
const previewCache = {}; 

const uploadsDir = path.join(__dirname, 'uploads');
const processedDir = path.join(__dirname, 'processed');
const previewsDir = path.join(__dirname, 'previews');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(processedDir, { recursive: true });
fs.mkdirSync(previewsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const safeFilename = `${cuid()}${path.extname(file.originalname)}`;
        cb(null, safeFilename);
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('media'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    console.log("📂 Uploaded file:", req.file);
    res.json({ success: true, filename: req.file.filename, originalName: req.file.originalname });
});

app.post('/render', (req, res) => {
    const { project } = req.body;
    const jobId = cuid();
    jobs[jobId] = { status: 'queued', message: 'Render is in the queue.' };
    console.log("🆕 New render job:", jobId, JSON.stringify(project, null, 2));
    res.json({ success: true, jobId });
    renderVideo(jobId, project);
});


app.post('/preview', async (req, res) => {
    const { project, timestamp, duration = 5 } = req.body;
    
    if (typeof timestamp !== 'number') {
        return res.status(400).json({ success: false, message: 'Timestamp is required' });
    }

    try {
        const previewId = `preview_${timestamp}_${Date.now()}`;
        const previewFilename = `${previewId}.mp4`;
        const previewPath = path.join(previewsDir, previewFilename);
        
        console.log(`🔍 Generating video preview from ${timestamp}s for ${duration}s`);
        
        const success = await generatePreviewVideo(project, timestamp, duration, previewPath);
        
        if (success) {
            res.json({ 
                success: true, 
                previewUrl: `/previews/${previewFilename}`,
                timestamp,
                duration
            });
        } else {
            res.status(500).json({ success: false, message: 'Preview generation failed' });
        }
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ success: false, message: 'Preview generation error', error: error.message });
    }
});


app.post('/preview-thumbnails', async (req, res) => {
    const { project, intervals = 10, thumbDuration = 2 } = req.body;
    
    try {
        const projectDuration = Math.max(...project.tracks.flatMap(t => t.clips.map(c => c.timelineStart + c.duration)));
        const thumbnails = [];
        
        console.log(`🎬 Generating ${intervals} video thumbnails for duration: ${projectDuration}s`);
        
        for (let i = 0; i < intervals; i++) {
            const timestamp = (projectDuration / intervals) * i;
            const thumbnailId = `thumb_${i}_${Date.now()}`;
            const thumbnailFilename = `${thumbnailId}.mp4`;
            const thumbnailPath = path.join(previewsDir, thumbnailFilename);
            
            const success = await generatePreviewVideo(project, timestamp, thumbDuration, thumbnailPath, true);
            
            if (success) {
                thumbnails.push({
                    timestamp,
                    url: `/previews/${thumbnailFilename}`,
                    duration: thumbDuration
                });
            }
        }
        
        res.json({ success: true, thumbnails });
    } catch (error) {
        console.error('Thumbnail generation error:', error);
        res.status(500).json({ success: false, message: 'Thumbnail generation failed', error: error.message });
    }
});

app.get('/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    res.json({ success: true, ...job });
});


async function generatePreviewVideo(project, startTime, duration, outputPath, isThumbnail = false) {
    return new Promise((resolve) => {
        try {
            const command = ffmpeg();
            let videoFilters = [];
            let audioFilters = [];
            
            
            const uniqueInputs = [...new Set(project.tracks.flatMap(track => track.clips.map(clip => clip.src)).filter(Boolean))];
            
            uniqueInputs.forEach(src => {
                if (src) {
                    const fullPath = path.join(uploadsDir, src);
                    command.addInput(fullPath);
                }
            });

            
            const endTime = startTime + duration;
            const projectDuration = Math.max(...project.tracks.flatMap(t => t.clips.map(c => c.timelineStart + c.duration)));
            const actualDuration = Math.min(duration, projectDuration - startTime);
            
            if (actualDuration <= 0) {
                console.log('❌ Invalid preview duration');
                resolve(false);
                return;
            }
            
            
            videoFilters.push(`color=s=1280x720:c=black:d=${actualDuration}[base]`);
            let currentVideoStream = '[base]';

            
            const videoTracks = project.tracks.filter(t => t.type === 'video').reverse();
            videoTracks.forEach(track => {
                track.clips.forEach(clip => {
                    
                    const clipStart = clip.timelineStart;
                    const clipEnd = clip.timelineStart + clip.duration;
                    
                    if (clipEnd > startTime && clipStart < endTime) {
                        const inputIndex = uniqueInputs.indexOf(clip.src);
                        console.log(`🎞 Processing video clip for preview:`, clip);

                        
                        const previewClipStart = Math.max(0, clipStart - startTime);
                        const previewClipEnd = Math.min(actualDuration, clipEnd - startTime);
                        
                        
                        const sourceStart = clip.start + Math.max(0, startTime - clipStart);
                        const sourceDuration = Math.min(clip.duration - Math.max(0, startTime - clipStart), previewClipEnd - previewClipStart);

                        let clipStream = `[${inputIndex}:v:0]trim=start=${sourceStart}:duration=${sourceDuration},setpts=PTS-STARTPTS`;
                        clipStream += `,scale=w=${1280 * clip.transform.scale}:h=-1,format=yuva420p,colorchannelmixer=aa=${clip.opacity}`;

                        let filterEffects = [];
                        if (clip.filters?.grayscale) filterEffects.push('format=gray');
                        if (clip.filters?.sepia) filterEffects.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
                        if (clip.filters?.invert) filterEffects.push('negate');
                        if (filterEffects.length > 0) clipStream += `,${filterEffects.join(',')}`;

                        const processedClipStream = `[vclip${clip.id}]`;
                        videoFilters.push(clipStream + processedClipStream);

                        const newVideoStream = `[vchain${clip.id}]`;
                        videoFilters.push(`${currentVideoStream}${processedClipStream}overlay=x=${clip.transform.x}:y=${clip.transform.y}:enable='between(t,${previewClipStart},${previewClipEnd})'${newVideoStream}`);
                        currentVideoStream = newVideoStream;
                    }
                });
            });

            
            const textTrack = project.tracks.find(t => t.type === 'text');
            if (textTrack && textTrack.clips.length > 0) {
                textTrack.clips.forEach(clip => {
                    const clipStart = clip.timelineStart;
                    const clipEnd = clip.timelineStart + clip.duration;
                    
                    if (clipEnd > startTime && clipStart < endTime) {
                        console.log(`🔤 Adding text for preview:`, clip.text);
                        const fontPath = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';
                        
                        const escapedText = clip.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
                        
                        const previewClipStart = Math.max(0, clipStart - startTime);
                        const previewClipEnd = Math.min(actualDuration, clipEnd - startTime);
                        
                        const newVideoStream = `[vchain_text${clip.id}]`;
                        videoFilters.push(`${currentVideoStream}drawtext=fontfile='${fontPath}':text='${escapedText}':x=${clip.transform.x}:y=${clip.transform.y}:fontsize=${clip.fontSize}:fontcolor=${clip.fontColor}:enable='between(t,${previewClipStart},${previewClipEnd})'${newVideoStream}`);
                        currentVideoStream = newVideoStream;
                    }
                });
            }

            
            videoFilters.push(`${currentVideoStream}copy[outv]`);

            
            let audioMixInputs = [];
            project.tracks.filter(t => t.type === 'audio').forEach(track => {
                track.clips.forEach(clip => {
                    const clipStart = clip.timelineStart;
                    const clipEnd = clip.timelineStart + clip.duration;
                    
                    if (clipEnd > startTime && clipStart < endTime) {
                        console.log("🔊 Processing audio clip for preview:", clip);
                        const inputIndex = uniqueInputs.indexOf(clip.src);
                        
                        
                        const sourceStart = clip.start + Math.max(0, startTime - clipStart);
                        const sourceDuration = Math.min(clip.duration - Math.max(0, startTime - clipStart), actualDuration);
                        const previewDelay = Math.max(0, clipStart - startTime) * 1000;
                        
                        const clipStream = `[${inputIndex}:a:0]atrim=start=${sourceStart}:duration=${sourceDuration},asetpts=PTS-STARTPTS,volume=${clip.volume},adelay=${previewDelay}|${previewDelay}[aclip${clip.id}]`;
                        audioFilters.push(clipStream);
                        audioMixInputs.push(`[aclip${clip.id}]`);
                    }
                });
            });

            if (audioMixInputs.length > 0) {
                audioFilters.push(`${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}[outa]`);
            }

            
            const allFilters = [...videoFilters, ...audioFilters];
            console.log("🧩 Preview filter_complex:\n", allFilters.join(';'));

            command.complexFilter(allFilters.join(';'));
            command.outputOptions('-map', '[outv]');
            
            if (audioMixInputs.length > 0) {
                command.outputOptions('-map', '[outa]');
            }
            
            
            const encodingOptions = [
                '-c:v', 'libx264',
                '-preset', 'ultrafast', 
                '-crf', isThumbnail ? '32' : '28', 
                '-c:a', 'aac',
                '-movflags', 'faststart',
                '-t', actualDuration.toString() 
            ];
            
            if (isThumbnail) {
                encodingOptions.push('-vf', 'scale=320:180'); 
            }
            
            command.outputOptions(...encodingOptions);

            command
                .on('start', cmd => console.log(`🚀 Preview FFmpeg command: ${cmd}`))
                .on('end', () => {
                    console.log(`✅ Video preview generated: ${outputPath}`);
                    resolve(true);
                })
                .on('error', (err) => {
                    console.error(`❌ Preview error: ${err.message}`);
                    resolve(false);
                })
                .save(outputPath);

        } catch (err) {
            console.error("💥 Preview generation error:", err);
            resolve(false);
        }
    });
}


async function generatePreviewFrame(project, timestamp, outputPath, isThumbnail = false) {
    return new Promise((resolve) => {
        try {
            const command = ffmpeg();
            let videoFilters = [];
            
            
            const uniqueInputs = [...new Set(project.tracks.flatMap(track => track.clips.map(clip => clip.src)).filter(Boolean))];
            
            uniqueInputs.forEach(src => {
                if (src) {
                    const fullPath = path.join(uploadsDir, src);
                    command.addInput(fullPath);
                }
            });

            
            const projectDuration = Math.max(...project.tracks.flatMap(t => t.clips.map(c => c.timelineStart + c.duration)));
            
            
            videoFilters.push(`color=s=1280x720:c=black:d=${projectDuration}[base]`);
            let currentVideoStream = '[base]';

            
            const videoTracks = project.tracks.filter(t => t.type === 'video').reverse();
            videoTracks.forEach(track => {
                track.clips.forEach(clip => {
                    
                    if (timestamp >= clip.timelineStart && timestamp <= clip.timelineStart + clip.duration) {
                        const inputIndex = uniqueInputs.indexOf(clip.src);
                        console.log(`🎞 Processing video clip at ${timestamp}s:`, clip);

                        let clipStream = `[${inputIndex}:v:0]trim=start=${clip.start}:duration=${clip.duration},setpts=PTS-STARTPTS`;
                        clipStream += `,scale=w=${1280 * clip.transform.scale}:h=-1,format=yuva420p,colorchannelmixer=aa=${clip.opacity}`;

                        let filterEffects = [];
                        if (clip.filters?.grayscale) filterEffects.push('format=gray');
                        if (clip.filters?.sepia) filterEffects.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
                        if (clip.filters?.invert) filterEffects.push('negate');
                        if (filterEffects.length > 0) clipStream += `,${filterEffects.join(',')}`;

                        const processedClipStream = `[vclip${clip.id}]`;
                        videoFilters.push(clipStream + processedClipStream);

                        const newVideoStream = `[vchain${clip.id}]`;
                        videoFilters.push(`${currentVideoStream}${processedClipStream}overlay=x=${clip.transform.x}:y=${clip.transform.y}${newVideoStream}`);
                        currentVideoStream = newVideoStream;
                    }
                });
            });

            
            const textTrack = project.tracks.find(t => t.type === 'text');
            if (textTrack && textTrack.clips.length > 0) {
                textTrack.clips.forEach(clip => {
                    
                    if (timestamp >= clip.timelineStart && timestamp <= clip.timelineStart + clip.duration) {
                        console.log(`🔤 Adding text at ${timestamp}s:`, clip.text);
                        const fontPath = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';
                        
                        const escapedText = clip.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
                        
                        const newVideoStream = `[vchain_text${clip.id}]`;
                        videoFilters.push(`${currentVideoStream}drawtext=fontfile='${fontPath}':text='${escapedText}':x=${clip.transform.x}:y=${clip.transform.y}:fontsize=${clip.fontSize}:fontcolor=${clip.fontColor}${newVideoStream}`);
                        currentVideoStream = newVideoStream;
                    }
                });
            }

            
            videoFilters.push(`${currentVideoStream}copy[outv]`);

            console.log("🧩 Preview filter_complex:\n", videoFilters.join(';'));

            command.complexFilter(videoFilters.join(';'));
            command.outputOptions('-map', '[outv]');
            
            
            command.outputOptions('-vframes', '1'); 
            command.outputOptions('-ss', timestamp.toString()); 
            command.outputOptions('-f', 'image2'); 
            
            if (isThumbnail) {
                command.outputOptions('-vf', 'scale=160:90'); 
            }

            command
                .on('start', cmd => console.log(`🚀 Preview FFmpeg command: ${cmd}`))
                .on('end', () => {
                    console.log(`✅ Preview generated: ${outputPath}`);
                    resolve(true);
                })
                .on('error', (err) => {
                    console.error(`❌ Preview error: ${err.message}`);
                    resolve(false);
                })
                .save(outputPath);

        } catch (err) {
            console.error("💥 Preview generation error:", err);
            resolve(false);
        }
    });
}

async function renderVideo(jobId, project) {
    try {
        jobs[jobId].status = 'processing';
        const command = ffmpeg();
        let videoFilters = [];
        let audioFilters = [];
        const outputFilename = `final-${jobId}.mp4`;
        const outputPath = path.join(processedDir, outputFilename);

        console.log("🎬 Starting render job:", jobId);

        
        const uniqueInputs = [...new Set(project.tracks.flatMap(track => track.clips.map(clip => clip.src)).filter(Boolean))];
        console.log("🎥 Unique inputs:", uniqueInputs);

        uniqueInputs.forEach(src => {
            if (src) {
                const fullPath = path.join(uploadsDir, src);
                console.log("➕ Adding input:", fullPath);
                command.addInput(fullPath);
            }
        });

        
        const projectDuration = Math.max(...project.tracks.flatMap(t => t.clips.map(c => c.timelineStart + c.duration)));
        console.log("⏱ Project duration:", projectDuration);

        
        videoFilters.push(`color=s=1280x720:c=black:d=${projectDuration}[base]`);
        let currentVideoStream = '[base]';

        
        const videoTracks = project.tracks.filter(t => t.type === 'video').reverse();
        videoTracks.forEach(track => {
            track.clips.forEach(clip => {
                const inputIndex = uniqueInputs.indexOf(clip.src);
                console.log("🎞 Processing video clip:", clip);

                let clipStream = `[${inputIndex}:v:0]trim=start=${clip.start}:duration=${clip.duration},setpts=PTS-STARTPTS`;
                clipStream += `,scale=w=${1280 * clip.transform.scale}:h=-1,format=yuva420p,colorchannelmixer=aa=${clip.opacity}`;

                let filterEffects = [];
                if (clip.filters?.grayscale) filterEffects.push('format=gray');
                if (clip.filters?.sepia) filterEffects.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
                if (clip.filters?.invert) filterEffects.push('negate');
                if (filterEffects.length > 0) clipStream += `,${filterEffects.join(',')}`;

                const processedClipStream = `[vclip${clip.id}]`;
                videoFilters.push(clipStream + processedClipStream);

                const newVideoStream = `[vchain${clip.id}]`;
                videoFilters.push(`${currentVideoStream}${processedClipStream}overlay=x=${clip.transform.x}:y=${clip.transform.y}:enable='between(t,${clip.timelineStart},${clip.timelineStart + clip.duration})'${newVideoStream}`);
                currentVideoStream = newVideoStream;
            });
        });

        
        const textTrack = project.tracks.find(t => t.type === 'text');
        if (textTrack && textTrack.clips.length > 0) {
            textTrack.clips.forEach(clip => {
                console.log("🔤 Adding text:", clip.text);
                const fontPath = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';
                
                const escapedText = clip.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
                
                const newVideoStream = `[vchain_text${clip.id}]`;
                videoFilters.push(`${currentVideoStream}drawtext=fontfile='${fontPath}':text='${escapedText}':x=${clip.transform.x}:y=${clip.transform.y}:fontsize=${clip.fontSize}:fontcolor=${clip.fontColor}:enable='between(t,${clip.timelineStart},${clip.timelineStart + clip.duration})'${newVideoStream}`);
                currentVideoStream = newVideoStream;
            });
        }

        
        videoFilters.push(`${currentVideoStream}copy[outv]`);

        
        let audioMixInputs = [];
        project.tracks.filter(t => t.type === 'audio').forEach(track => {
            track.clips.forEach(clip => {
                console.log("🔊 Processing audio clip:", clip);
                const inputIndex = uniqueInputs.indexOf(clip.src);
                const clipStream = `[${inputIndex}:a:0]atrim=start=${clip.start}:duration=${clip.duration},asetpts=PTS-STARTPTS,volume=${clip.volume},adelay=${clip.timelineStart * 1000}|${clip.timelineStart * 1000}[aclip${clip.id}]`;
                audioFilters.push(clipStream);
                audioMixInputs.push(`[aclip${clip.id}]`);
            });
        });

        if (audioMixInputs.length > 0) {
            audioFilters.push(`${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}[outa]`);
        }

        
        const allFilters = [...videoFilters, ...audioFilters];
        console.log("🧩 Final filter_complex:\n", allFilters.join(';'));

        if (allFilters.length > 0) {
            command.complexFilter(allFilters.join(';'));
        }

        command.outputOptions('-map', '[outv]');
        if (audioMixInputs.length > 0) {
            command.outputOptions('-map', '[outa]');
        }

        
        command.outputOptions('-c:v', 'libx264', '-c:a', 'aac', '-movflags', 'faststart');

        console.log("📤 Output path:", outputPath);

        command
            .on('start', cmd => console.log("🚀 FFmpeg command:", cmd))
            .on('progress', progress => {
                jobs[jobId].progress = progress.percent < 0 ? 0 : progress.percent;
                jobs[jobId].message = `Rendering... ${Math.round(jobs[jobId].progress || 0)}%`;
                console.log("⏳ Progress:", jobs[jobId].progress);
            })
            .on('end', () => {
                jobs[jobId] = { status: 'complete', progress: 100, message: 'Render finished!', downloadUrl: `/processed/${outputFilename}` };
                console.log("✅ Render finished:", outputPath);
            })
            .on('error', (err) => {
                console.error("❌ FFmpeg error:", err.message);
                jobs[jobId] = { status: 'error', message: 'Render failed. Check server console.', error: err.message };
            })
            .save(outputPath);

    } catch (err) {
        console.error("💥 Critical error:", err);
        jobs[jobId] = { status: 'error', message: 'A critical server error occurred.', error: err.message };
    }
}


const http = require('http');
const WebSocket = require('ws');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


const previewSessions = new Map();

wss.on('connection', (ws) => {
    console.log('🔌 Preview client connected');
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'preview_request') {
                const { project, timestamp, duration = 3, sessionId } = data;
                
                
                if (previewSessions.has(sessionId)) {
                    previewSessions.get(sessionId).cancel = true;
                }
                
                const session = { cancel: false };
                previewSessions.set(sessionId, session);
                
                const previewId = `ws_preview_${timestamp}_${Date.now()}`;
                const previewFilename = `${previewId}.mp4`;
                const previewPath = path.join(previewsDir, previewFilename);
                
                const success = await generatePreviewVideo(project, timestamp, duration, previewPath);
                
                
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
});


setInterval(() => {
    try {
        const files = fs.readdirSync(previewsDir);
        const cutoffTime = Date.now() - (15 * 60 * 1000); 
        
        files.forEach(file => {
            const filePath = path.join(previewsDir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.mtime.getTime() < cutoffTime) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Cleaned up old preview: ${file}`);
            }
        });
    } catch (error) {
        console.error('Preview cleanup error:', error);
    }
}, 5 * 60 * 1000); 

server.listen(port, () => console.log(`Backend server with preview support running on http://localhost:${port}`));