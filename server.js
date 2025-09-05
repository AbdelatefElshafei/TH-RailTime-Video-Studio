const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cuid = require('cuid');
const sanitize = require("sanitize-filename");

const app = express();
const port = 3000;


app.use(cors());
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use('/processed', express.static(path.join(__dirname, 'processed')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/proxies', express.static(path.join(__dirname, 'proxies')));
app.use('/previews', express.static(path.join(__dirname, 'previews')));
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));

const jobs = {};

const pluginRegistry = {};

function loadPlugins() {
    const pluginsDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir);
        const examplePlugin = `
module.exports = {
  name: 'Vignette',
  type: 'vignette',
  effectType: 'video',
  params: [
    { name: 'Strength', key: 'strength', type: 'slider', min: 0, max: 1, step: 0.05, defaultValue: 0.5 },
  ],
  buildFilter: (params) => {
    const strength = params.strength ?? 0.5;
    const angle = Math.PI/2.5 * (1 - strength);
    return \`vignette=angle=\${angle}\`;
  }
};`;
        fs.writeFileSync(path.join(pluginsDir, 'vignette.js'), examplePlugin, 'utf8');
        console.log('✨ Created example plugin: vignette.js');
    }

    fs.readdirSync(pluginsDir).forEach(file => {
        if (file.endsWith('.js')) {
            try {
                const pluginPath = path.join(pluginsDir, file);
                const plugin = require(pluginPath);
                if (plugin.type && plugin.name && plugin.buildFilter) {
                    pluginRegistry[plugin.type] = plugin;
                    console.log(`🔌 Plugin loaded: ${plugin.name}`);
                }
            } catch (error) {
                console.error(`❌ Error loading plugin ${file}:`, error);
            }
        }
    });
}

app.get('/api/plugins', (req, res) => {
    res.json(Object.values(pluginRegistry));
});


function buildKeyframeExpression(keyframes, defaultValue, clipStartTime) {
    if (!keyframes || keyframes.length === 0) {
        return defaultValue;
    }
    
    const sortedKfs = [...keyframes].sort((a, b) => a.time - b.time);
    
    if (sortedKfs.length === 1) {
        return sortedKfs[0].value;
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


function buildVisualFilters(clip, isForPreview = false) {
    const filters = [];
    const f = clip.filters || {};

    if (clip.keying && clip.keying.enabled) {
        const color = clip.keying.color.startsWith('#') ? '0x' + clip.keying.color.substring(1) : clip.keying.color;
        filters.push(`chromakey=color=${color}:similarity=${clip.keying.similarity}:blend=${clip.keying.blend}`);
    }
        
    const brightness = f.brightness ?? 0;
    const contrast = f.contrast ?? 1;
    const saturation = f.saturation ?? 1;
    filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);

    const cw = f.colorWheels;
    if (cw && (cw.liftY !== 0 || cw.gammaY !== 0 || cw.gainY !== 0 || cw.lift.r !== 0 || cw.gamma.r !== 0 || cw.gain.r !== 0)) {
        const clamp = (val) => Math.max(0, Math.min(1, val));
        
        const R = `0/${clamp(cw.lift.r + cw.liftY + 0)} 0.5/${clamp(cw.gamma.r + cw.gammaY + 0.5)} 1/${clamp(cw.gain.r + cw.gainY + 1)}`;
        const G = `0/${clamp(cw.lift.g + cw.liftY + 0)} 0.5/${clamp(cw.gamma.g + cw.gammaY + 0.5)} 1/${clamp(cw.gain.g + cw.gainY + 1)}`;
        const B = `0/${clamp(cw.lift.b + cw.liftY + 0)} 0.5/${clamp(cw.gamma.b + cw.gammaY + 0.5)} 1/${clamp(cw.gain.b + cw.gainY + 1)}`;
        
        filters.push(`curves=r='${R}':g='${G}':b='${B}'`);
    }

    if (f.curves) {
        const sanitizedCurves = f.curves.replace(/[^0-9\.\/ ]/g, '');
        filters.push(`curves=master='${sanitizedCurves}'`);
    }
    if (f.lut) {
        const lutPath = path.join(__dirname, 'luts', sanitize(f.lut));
        if (fs.existsSync(lutPath)) {
            const escapedLutPath = lutPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            filters.push(`lut3d=file='${escapedLutPath}'`);
        }
    }
    
    if (clip.effects && Array.isArray(clip.effects)) {
        clip.effects.forEach(effect => {
            const plugin = pluginRegistry[effect.type];
            if (plugin) {
                if(plugin.effectType === 'video') {
                    const filterString = plugin.buildFilter(effect.params);
                    if(filterString) filters.push(filterString);
                }
            } else {
                if (effect.type === 'blur' && effect.params?.strength > 0) {
                    filters.push(`gblur=sigma=${effect.params.strength}`);
                }
                if (effect.type === 'sharpen' && effect.params?.strength > 0) {
                    filters.push(`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${effect.params.strength}`);
                }
            }
        });
    }

    filters.push(`format=yuva420p`);
    
    const clipStartTime = isForPreview ? (clip.timelineStart - (isForPreview.startTime || 0)) : clip.timelineStart;
    const opacityExpr = buildKeyframeExpression(clip.opacity.keyframes, clip.opacity.value, clipStartTime);
    filters.push(`colorchannelmixer=aa=(${opacityExpr})`);

    return filters.join(',');
}

function buildAudioFilters(clip) {
    const filters = [];
    if (clip.effects && Array.isArray(clip.effects)) {
        clip.effects.forEach(effect => {
            const plugin = pluginRegistry[effect.type];
            if (plugin) {
                if(plugin.effectType === 'audio') {
                    const filterString = plugin.buildFilter(effect.params);
                    if(filterString) filters.push(filterString);
                }
            } else {
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
            }
        });
    }
    return filters;
}



const uploadsDir = path.join(__dirname, 'uploads');
const proxiesDir = path.join(__dirname, 'proxies');
const processedDir = path.join(__dirname, 'processed');
const previewsDir = path.join(__dirname, 'previews');
const waveformsDir = path.join(__dirname, 'waveforms');
const lutsDir = path.join(__dirname, 'luts');
const thumbnailsDir = path.join(__dirname, 'thumbnails');

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(proxiesDir, { recursive: true });
fs.mkdirSync(processedDir, { recursive: true });
fs.mkdirSync(previewsDir, { recursive: true });
fs.mkdirSync(waveformsDir, { recursive: true });
fs.mkdirSync(lutsDir, { recursive: true });
fs.mkdirSync(thumbnailsDir, { recursive: true });


const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const safeFilename = `${cuid()}${path.extname(file.originalname)}`;
        cb(null, safeFilename);
    }
});
const upload = multer({ storage: storage });

const lutStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, lutsDir),
    filename: (req, file, cb) => {
        const safeFilename = `${cuid()}${path.extname(file.originalname)}`;
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


app.post('/upload', upload.single('media'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    console.log("📂 Uploaded file:", req.file);

    const isVideo = req.file.mimetype.startsWith('video/');
    if(isVideo) {
        const originalPath = req.file.path;
        const proxyPath = path.join(proxiesDir, req.file.filename);

        ffmpeg(originalPath)
            .size('?x540')
            .outputOptions(['-preset', 'ultrafast', '-crf', '30'])
            .on('end', () => console.log(`✅ Proxy generated for ${req.file.filename}`))
            .on('error', (err) => console.error(`❌ Proxy generation failed for ${req.file.filename}:`, err.message))
            .save(proxyPath);
    }

    res.json({ 
        success: true, 
        filename: req.file.filename, 
        originalName: req.file.originalname,
        hasProxy: isVideo
    });
});

app.post('/upload-lut', lutUpload.single('lut'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No LUT file uploaded.' });
    console.log("🎨 Uploaded LUT:", req.file);
    res.json({ success: true, filename: req.file.filename });
}, (error, req, res, next) => {
    res.status(400).json({ success: false, message: error.message });
});


app.post('/render', (req, res) => {
    const { project } = req.body;
    const jobId = cuid();
    jobs[jobId] = { status: 'queued', message: 'Render is in the queue.' };
    console.log("🆕 New render job:", jobId);
    res.json({ success: true, jobId });
    renderVideo(jobId, project);
});


app.post('/preview', async (req, res) => {
    const { project, timestamp, duration = 5, useProxy } = req.body;

    if (typeof timestamp !== 'number') {
        return res.status(400).json({ success: false, message: 'Timestamp is required' });
    }

    try {
        const previewId = `preview_${timestamp}_${Date.now()}`;
        const previewFilename = `${previewId}.mp4`;
        const previewPath = path.join(previewsDir, previewFilename);

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
            res.status(500).json({ success: false, message: 'Preview generation failed' });
        }
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ success: false, message: 'Preview generation error', error: error.message });
    }
});

app.post('/thumbnail', async (req, res) => {
    const { project, timestamp, useProxy } = req.body;

    if (typeof timestamp !== 'number') {
        return res.status(400).json({ success: false, message: 'A valid timestamp is required.' });
    }

    try {
        const thumbId = `thumb_${timestamp.toFixed(2)}_${cuid.slug()}`;
        const thumbFilename = `${thumbId}.jpg`;
        const thumbPath = path.join(thumbnailsDir, thumbFilename);

        const success = await generateThumbnail(project, timestamp, thumbPath, useProxy);
        if (success) {
            res.json({ success: true, thumbnailUrl: `/thumbnails/${thumbFilename}` });
        } else {
             res.status(500).json({ success: false, message: 'Thumbnail generation failed.' });
        }
    } catch (error) {
        console.error("Thumbnail endpoint error:", error);
        res.status(500).json({ success: false, message: 'Server error generating thumbnail.' });
    }
});


app.get('/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    res.json({ success: true, ...job });
});

app.get('/waveform/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found.' });
    }
    
    const waveformPath = path.join(waveformsDir, `${filename}.json`);
    
    if (fs.existsSync(waveformPath)) {
        try {
            const waveformData = JSON.parse(fs.readFileSync(waveformPath, 'utf8'));
            return res.json({ success: true, waveform: waveformData });
        } catch (error) {
            console.error('Error reading waveform cache:', error);
        }
    }
    
    const tempRawPath = path.join(waveformsDir, `${filename}.raw`);
    
    ffmpeg(filePath)
        .outputOptions([ '-f', 's16le', '-ac', '1', '-ar', '8000' ])
        .on('end', () => {
            try {
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
                res.status(500).json({ success: false, message: 'Error processing waveform data.' });
            }
        })
        .on('error', (err) => {
            console.error('FFmpeg waveform error:', err);
            res.status(500).json({ success: false, message: 'Error generating waveform.' });
        })
        .save(tempRawPath);
});


async function generatePreviewVideo(project, startTime, duration, outputPath, useProxy = false) {
    return new Promise((resolve) => {
        try {
            const projWidth = project.settings?.width || 1280;
            const projHeight = project.settings?.height || 720;
            const baseDir = useProxy ? proxiesDir : uploadsDir;

            const command = ffmpeg();
            let videoFilters = [];
            let audioFilters = [];

            const allClips = project.tracks.flatMap(track => track.clips);
            const uniqueInputs = [...new Set(allClips.map(clip => clip.src).filter(Boolean))];

            uniqueInputs.forEach(src => {
                if (src) {
                    const fullPath = path.join(baseDir, src);
                    if (fs.existsSync(fullPath)) {
                        command.addInput(fullPath);
                    } else {
                        const fallbackPath = path.join(uploadsDir, src);
                        if(fs.existsSync(fallbackPath)) command.addInput(fallbackPath);
                    }
                }
            });

            const endTime = startTime + duration;
            const projectDuration = Math.max(0, ...allClips.map(c => c.timelineStart + c.duration));
            const actualDuration = Math.min(duration, projectDuration - startTime);

            if (actualDuration <= 0) {
                console.log('❌ Invalid preview duration');
                resolve(false); return;
            }

            
            let currentVideoStream = `[base]`;
            videoFilters.push(`color=s=${projWidth}x${projHeight}:c=black:d=${actualDuration},format=yuva420p[base]`);
            
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
                        
                        
                        if (clip.mask && clip.mask.enabled && clip.mask.path.length > 2) {
                            const points = clip.mask.path.map(p => `${p.x}*${clip.originalWidth/projWidth}/${p.y}*${clip.originalHeight/projHeight}`).join(':');
                            videoFilters.push(`color=s=${clip.originalWidth}x${clip.originalHeight}:c=black,drawfill=c=white:p=${points}[mask_${clip.id}]`);
                            videoFilters.push(`[${inputIndex}:v:0][mask_${clip.id}]alphamerge[clip_alpha_${clip.id}]`);
                            clipStream = `[clip_alpha_${clip.id}]trim=start=${sourceStart},setpts=PTS-STARTPTS`;
                        }
                        
                        const visualFX = buildVisualFilters(clip, { isPreview: true, startTime });
                        if (visualFX) clipStream += `,${visualFX}`;
                        
                        const scaleExpr = buildKeyframeExpression(clip.transform.scale.keyframes, clip.transform.scale.value, clipStart);
                        const xExpr = buildKeyframeExpression(clip.transform.x.keyframes, clip.transform.x.value, clipStart);
                        const yExpr = buildKeyframeExpression(clip.transform.y.keyframes, clip.transform.y.value, clipStart);
                        
                        // --- FIX IS HERE ---
                        clipStream += `,scale=w='iw*(${scaleExpr})':h=-1,scale=${projWidth}:${projHeight}:force_original_aspect_ratio=decrease,pad=${projWidth}:${projHeight}:-1:-1`;
                        
                        const processedClipStream = `[vclip${clip.id}]`;
                        videoFilters.push(clipStream + processedClipStream);

                        const newVideoStream = `[vchain${clip.id}]`;
                        videoFilters.push(`${trackCompStream}${processedClipStream}overlay=x='(${xExpr})':y='(${yExpr})':enable='between(t,${previewClipStart},${previewClipEnd})'${newVideoStream}`);
                        trackCompStream = newVideoStream;
                    }
                });

                
                const adjLayersOnTrack = track.clips.filter(c => c.type === 'adjustment');
                adjLayersOnTrack.forEach(adjClip => {
                    const clipStart = adjClip.timelineStart;
                    const clipEnd = adjClip.timelineStart + adjClip.duration;
                     if (clipEnd > startTime && clipStart < endTime) {
                        const previewClipStart = Math.max(0, clipStart - startTime);
                        const previewClipEnd = Math.min(actualDuration, clipEnd - startTime);
                        
                        const adjFX = buildVisualFilters(adjClip, { isPreview: true, startTime });
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


            let audioMixInputs = [];
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
                        
                        const audioFX = buildAudioFilters(clip);

                        let clipStream = `[${inputIndex}:a:0]atrim=start=${sourceStart},asetpts=PTS-STARTPTS`;
                        if(audioFX.length > 0) clipStream += `,${audioFX.join(',')}`;
                        clipStream += `,volume=${clip.volume},volume=${track.volume ?? 1},pan=stereo|c0=${leftGain}*c0|c1=${rightGain}*c1,adelay=${previewDelay}|${previewDelay}[aclip${clip.id}]`;

                        audioFilters.push(clipStream);
                        audioMixInputs.push(`[aclip${clip.id}]`);
                    }
                });
            });

            if (audioMixInputs.length > 0) {
                audioFilters.push(`${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}[outa]`);
            }

            const allFilters = [...videoFilters, ...audioFilters];
            command.complexFilter(allFilters.join(';'));
            command.outputOptions('-map', '[outv]');
            if (audioMixInputs.length > 0) command.outputOptions('-map', '[outa]');
            const encodingOptions = [ '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-movflags', 'faststart', '-t', actualDuration.toString() ];
            command.outputOptions(...encodingOptions);
            command.on('start', cmd => console.log(`🚀 Preview FFmpeg command: ${cmd}`)).on('end', () => { console.log(`✅ Video preview generated: ${outputPath}`); resolve(true); }).on('error', (err) => { console.error(`❌ Preview error: ${err.message}`); resolve(false); }).save(outputPath);
        } catch (err) {
            console.error("💥 Preview generation error:", err);
            resolve(false);
        }
    });
}

function getAnimatedValueAtTime(clip, propPath, time) {
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

async function generateThumbnail(project, timestamp, outputPath, useProxy = false) {
    return new Promise((resolve) => {
        try {
            const projWidth = project.settings?.width || 1280;
            const projHeight = project.settings?.height || 720;
            const baseDir = useProxy ? proxiesDir : uploadsDir;
            
            const command = ffmpeg();
            let complexFilters = [];

            
            const visibleVideoClips = project.tracks
                .filter(t => t.type === 'video')
                .flatMap(t => t.clips)
                .filter(c => c.type === 'video' && timestamp >= c.timelineStart && timestamp < c.timelineStart + c.duration)
                .sort((a,b) => project.tracks.findIndex(t => t.id === a.trackId) - project.tracks.findIndex(t => t.id === b.trackId));
            
            const visibleInputs = [...new Set(visibleVideoClips.map(c => c.src))];
            
            if (visibleInputs.length === 0) {
                
                return ffmpeg(`color=s=${projWidth}x${projHeight}:c=black:d=1`)
                    .inputOption('-f lavfi')
                    .outputOptions(['-vframes 1', `-s 160x${Math.round(160*projHeight/projWidth)}`])
                    .on('end', () => resolve(true))
                    .on('error', (err) => { console.error('Black frame thumbnail error:', err); resolve(false); })
                    .save(outputPath);
            }

            visibleInputs.forEach(src => {
                const fullPath = path.join(baseDir, src);
                if (fs.existsSync(fullPath)) {
                    command.addInput(fullPath);
                } else {
                    const fallbackPath = path.join(uploadsDir, src);
                    if (fs.existsSync(fallbackPath)) command.addInput(fallbackPath);
                }
            });

            complexFilters.push(`color=s=${projWidth}x${projHeight}:c=black:d=1[base]`);
            let lastVideoStream = '[base]';

            
            visibleVideoClips.forEach(clip => {
                const inputIndex = visibleInputs.indexOf(clip.src);
                const timeIntoClip = (timestamp - clip.timelineStart) * clip.speed;
                const sourceTime = clip.start + timeIntoClip;
                
                const scaleValue = getAnimatedValueAtTime(clip, 'transform.scale', timestamp);
                const xValue = getAnimatedValueAtTime(clip, 'transform.x', timestamp);
                const yValue = getAnimatedValueAtTime(clip, 'transform.y', timestamp);

                let clipStream = `[${inputIndex}:v:0]trim=start=${sourceTime}:duration=0.1,setpts=PTS-STARTPTS`;
                const visualFX = buildVisualFilters(clip, false);
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
                .on('end', () => { console.log(`✅ Thumbnail generated: ${outputPath}`); resolve(true); })
                .on('error', (err) => { console.error(`❌ Thumbnail generation error: ${err.message}`); resolve(false); })
                .save(outputPath);

        } catch (err) {
            console.error("💥 Thumbnail generation critical error:", err);
            resolve(false);
        }
    });
}


async function renderVideo(jobId, project) {
    try {
        jobs[jobId].status = 'processing';
        const projWidth = project.settings?.width || 1280;
        const projHeight = project.settings?.height || 720;
        
        const baseDir = uploadsDir; 

        const command = ffmpeg();
        let complexFilters = [];
        const outputFilename = `final-${jobId}.mp4`;
        const outputPath = path.join(processedDir, outputFilename);
        console.log(`🎬 Starting render job: ${jobId} at ${projWidth}x${projHeight}`);

        const allClips = project.tracks.flatMap(track => track.clips);
        const uniqueInputs = [...new Set(allClips.map(clip => clip.src).filter(Boolean))];
        uniqueInputs.forEach(src => {
            if (src) command.addInput(path.join(baseDir, src));
        });

        const projectDuration = Math.max(0, ...allClips.map(c => c.timelineStart + c.duration));
        
        
        let currentVideoStream = `[base_canvas]`;
        complexFilters.push(`color=s=${projWidth}x${projHeight}:c=black:d=${projectDuration}:r=30,format=yuva420p[base_canvas]`);
        
        const videoTracks = project.tracks.filter(t => t.type === 'video').sort((a,b) => project.tracks.indexOf(a) - project.tracks.indexOf(b));

        for(const track of videoTracks) {
            
            let trackCompositeStream = `[track_base_${track.id}]`;
            complexFilters.push(`color=s=${projWidth}x${projHeight}:c=black:d=${projectDuration}:r=30:a=0${trackCompositeStream}`);

            for (const clip of track.clips.filter(c => c.type === 'video')) {
                 const inputIndex = uniqueInputs.indexOf(clip.src);
                 let stream = `[${inputIndex}:v]trim=${clip.start}:${clip.start + clip.originalDuration},setpts=PTS-STARTPTS`;
                 
                 const visualFX = buildVisualFilters(clip, false);
                 if(visualFX) stream += `,${visualFX}`;

                 const scaleExpr = buildKeyframeExpression(clip.transform.scale.keyframes, clip.transform.scale.value, clip.timelineStart);
                 const xExpr = buildKeyframeExpression(clip.transform.x.keyframes, clip.transform.x.value, clip.timelineStart);
                 const yExpr = buildKeyframeExpression(clip.transform.y.keyframes, clip.transform.y.value, clip.timelineStart);

                 // --- FIX IS HERE ---
                 stream += `,scale=w='iw*(${scaleExpr})':h=-1,scale=${projWidth}:${projHeight}:force_original_aspect_ratio=decrease,pad=${projWidth}:${projHeight}:-1:-1`;
                 
                 complexFilters.push(`${stream}[clip_${clip.id}_processed]`);
                 
                 const newTrackComposite = `[track_comp_${clip.id}]`;
                 complexFilters.push(`${trackCompositeStream}[clip_${clip.id}_processed]overlay=x='(${xExpr})':y='(${yExpr})':enable='between(t,${clip.timelineStart},${clip.timelineStart+clip.duration})'${newTrackComposite}`);
                 trackCompositeStream = newTrackComposite;
            }

            for (const adjClip of track.clips.filter(c => c.type === 'adjustment')) {
                const adjFX = buildVisualFilters(adjClip, false);
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

        let audioMixInputs = [];
        const audioTracks = project.tracks.filter(t => t.type === 'audio');
        
        audioTracks.forEach(track => {
            track.clips.forEach(clip => {
                const inputIndex = uniqueInputs.indexOf(clip.src);
                let audioClipStream = `[${inputIndex}:a:0]atrim=start=${clip.start}:duration=${clip.originalDuration},asetpts=PTS-STARTPTS`;
                
                let audioTimeFilters = [];
                if (clip.reverse) audioTimeFilters.push('areverse');
                if (clip.speed !== 1) audioTimeFilters.push(`atempo=${clip.speed}`);
                if(audioTimeFilters.length > 0) audioClipStream += `,${audioTimeFilters.join(',')}`;
                
                const audioFX = buildAudioFilters(clip);
                if(audioFX.length > 0) audioClipStream += `,${audioFX.join(',')}`;

                const pan = track.pan ?? 0;
                const leftGain = Math.cos((pan + 1) * Math.PI / 4);
                const rightGain = Math.sin((pan + 1) * Math.PI / 4);
                
                audioClipStream += `,volume=${clip.volume},volume=${track.volume ?? 1},pan=stereo|c0=${leftGain.toFixed(3)}*c0|c1=${rightGain.toFixed(3)}*c1,adelay=${clip.timelineStart * 1000}|${clip.timelineStart * 1000}[aclip${clip.id}]`;
                
                complexFilters.push(audioClipStream);
                audioMixInputs.push(`[aclip${clip.id}]`);
            });
        });

        if (audioMixInputs.length > 0) {
            complexFilters.push(`${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}:dropout_transition=3[outa]`);
        }

        console.log("🧩 Final filter_complex:\n", complexFilters.join(';'));
        command.complexFilter(complexFilters.join(';'));
        command.outputOptions('-map', '[outv]');
        if (audioMixInputs.length > 0) command.outputOptions('-map', '[outa]');
        command.outputOptions('-c:v', 'libx264', '-c:a', 'aac', '-movflags', 'faststart');
        command.on('start', cmd => console.log("🚀 FFmpeg command:", cmd)).on('progress', progress => { jobs[jobId].progress = progress.percent < 0 ? 0 : progress.percent; jobs[jobId].message = `Rendering... ${Math.round(jobs[jobId].progress || 0)}%`; console.log("⏳ Progress:", jobs[jobId].progress); }).on('end', () => { jobs[jobId] = { status: 'complete', progress: 100, message: 'Render finished!', downloadUrl: `/processed/${outputFilename}` }; console.log("✅ Render finished:", outputPath); }).on('error', (err) => { console.error("❌ FFmpeg error:", err.message); jobs[jobId] = { status: 'error', message: 'Render failed. Check server console.', error: err.message }; }).save(outputPath);

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
                const { project, timestamp, duration = 3, sessionId, useProxy } = data;
                if (previewSessions.has(sessionId)) previewSessions.get(sessionId).cancel = true;
                const session = { cancel: false };
                previewSessions.set(sessionId, session);
                const previewId = `ws_preview_${timestamp}_${Date.now()}`;
                const previewFilename = `${previewId}.mp4`;
                const previewPath = path.join(previewsDir, previewFilename);
                const success = await generatePreviewVideo(project, timestamp, duration, previewPath, useProxy);
                if (!session.cancel && success) {
                    ws.send(JSON.stringify({ type: 'preview_ready', previewUrl: `/previews/${previewFilename}`, timestamp, duration, sessionId }));
                }
                previewSessions.delete(sessionId);
            }
        } catch (error) {
            console.error('WebSocket preview error:', error);
            ws.send(JSON.stringify({ type: 'preview_error', error: error.message }));
        }
    });
    ws.on('close', () => console.log('🔌 Preview client disconnected'));
});

setInterval(() => {
    const cleanup = (dir, age) => {
        try {
            const files = fs.readdirSync(dir);
            const cutoffTime = Date.now() - age;
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                if (stats.mtime.getTime() < cutoffTime) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Cleaned up old file: ${file} from ${path.basename(dir)}`);
                }
            });
        } catch (error) {
            console.error(`Cleanup error in ${dir}:`, error);
        }
    };
    cleanup(previewsDir, 15 * 60 * 1000);
    cleanup(thumbnailsDir, 5 * 60 * 1000);
}, 5 * 60 * 1000);

server.listen(port, () => {
    loadPlugins();
    console.log(`Backend server with preview support running on http://localhost:${port}`)
});