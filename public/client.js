document.addEventListener('DOMContentLoaded', () => {
    
    let project = {
        settings: {
            width: 1280,
            height: 720,
        },
        tracks: [
            { id: `video-${Date.now()}`, type: 'video', clips: [] },
            { id: `audio-${Date.now()}`, type: 'audio', clips: [], volume: 1, pan: 0 },
            { id: 'text-track', type: 'text', clips: [] }
        ],
        markers: []
    };
    let selectedClipId = null;
    let mediaBinFiles = [];
    const SNAPPING_THRESHOLD = 10; 
    let PIXELS_PER_SECOND = 60;

    
    let history = [];
    let redoStack = [];
    
    let ws;
    let previewTimestamp = 0;
    let isScrubbing = false;
    let previewRequestTimeout;
    let isVideoPlaybackMode = false;
    let currentPreviewSegment = { url: null, start: -1, duration: -1 };
    let isAnimatingPlayhead = false; 
    let jklPlaybackRate = 1;

    // --- NEW: Proxy & Plugin State ---
    let useProxies = true; // Default to true for performance
    let availablePlugins = []; // Cache for loaded plugins
    // ---

    
    let fabricCanvas = null;
    let isMaskEditingMode = false;
    let scopesUpdateTimeout;
    
    
    
    const importButton = document.getElementById('import-button');
    const fileInput = document.getElementById('file-input');
    const mediaBin = document.getElementById('media-bin');
    const effectsBin = document.getElementById('effects-bin');
    const transitionsBin = document.getElementById('transitions-bin');
    const timelineScrollPane = document.getElementById('timeline-scroll-pane'); 
    const timelineContainer = document.getElementById('timeline-container');
    const trackHeaders = document.getElementById('track-headers');
    const propertiesPanelWrapper = document.getElementById('properties-panel-wrapper');
    const propertiesContent = document.getElementById('properties-content');
    const keyframeEditorPanel = document.getElementById('keyframe-editor-panel');
    const keyframeEditorContent = document.getElementById('keyframe-editor-content');
    const deleteClipButton = document.getElementById('delete-clip-button');
    const previewWindow = document.getElementById('preview-window');
    const previewContent = document.getElementById('preview-content');
    const previewImage = document.getElementById('preview-image');
    const previewVideo = document.getElementById('preview-video');
    const interactiveOverlay = document.getElementById('interactive-overlay');
    const maskOverlayCanvas = document.getElementById('mask-overlay-canvas');
    const maskControls = document.getElementById('mask-controls');
    const finishMaskButton = document.getElementById('finish-mask-button');
    const clearMaskButton = document.getElementById('clear-mask-button');
    const selectionBox = document.getElementById('selection-box');
    const playhead = document.getElementById('playhead');
    const exportButton = document.getElementById('export-button');
    const addVideoTrackButton = document.getElementById('add-video-track-button');
    const addAudioTrackButton = document.getElementById('add-audio-track-button');
    const addTextClipButton = document.getElementById('add-text-clip-button');
    const addAdjustmentLayerButton = document.getElementById('add-adjustment-layer-button');
    const statusOverlay = document.getElementById('status-overlay');
    const statusMessage = document.getElementById('status-message');
    const statusProgress = document.getElementById('status-progress');
    const downloadLink = document.getElementById('download-link');
    const playPauseButton = document.getElementById('play-pause-button');
    const stopButton = document.getElementById('stop-button');
    const timeDisplay = document.getElementById('time-display');
    const splitClipButton = document.getElementById('split-clip-button');
    const undoButton = document.getElementById('undo-button');
    const redoButton = document.getElementById('redo-button');
    const rippleDeleteToggle = document.getElementById('ripple-delete-toggle');
    const useProxiesToggle = document.getElementById('use-proxies-toggle'); // <-- New proxy toggle
    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomOutButton = document.getElementById('zoom-out-button');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const loadingIcon = document.getElementById('loading-icon');
    const timelineThumbnailPreview = document.getElementById('timeline-thumbnail-preview');
    const timelineThumbnailImg = document.getElementById('timeline-thumbnail-img');
    const timelineThumbnailTime = document.getElementById('timeline-thumbnail-time');
    
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active', 'text-white', 'border-indigo-500'));
                button.classList.add('active', 'text-white', 'border-indigo-500');
                
                tabContents.forEach(content => {
                    content.classList.add('hidden');
                    if (content.id === button.dataset.tab) {
                        content.classList.remove('hidden');
                    }
                });
            });
        });
        
        document.querySelector('.tab-button.active').classList.add('text-white', 'border-indigo-500');
    }
    
    async function populateEffectsBin() {
        // --- DYNAMICALLY LOAD PLUGINS ---
        effectsBin.innerHTML = '';
        try {
            const response = await fetch('/api/plugins');
            const plugins = await response.json();
            availablePlugins = plugins; // Cache for later use
            
            plugins.forEach(plugin => {
                const el = document.createElement('div');
                el.className = 'effect-item p-2 rounded cursor-grab';
                el.textContent = plugin.name;
                el.draggable = true;
                // Construct the effect object with default parameters
                const defaultParams = {};
                if(plugin.params) {
                    plugin.params.forEach(p => defaultParams[p.key] = p.defaultValue);
                }
                el.dataset.effect = JSON.stringify({
                    type: plugin.type,
                    name: plugin.name,
                    effectType: plugin.effectType,
                    params: defaultParams
                });
                effectsBin.appendChild(el);
            });

        } catch (error) {
            console.error("Failed to load plugins:", error);
            effectsBin.innerHTML = '<p class="text-red-400 text-xs">Could not load effects.</p>';
        }
        // --- End Dynamic Loading ---

        const effects = [
            { type: 'blur', name: 'Gaussian Blur', params: { strength: 5 }, effectType: 'video' },
            { type: 'sharpen', name: 'Sharpen', params: { strength: 0.8 }, effectType: 'video' },
            { type: 'compressor', name: 'Compressor', params: { threshold: -20, ratio: 4, attack: 20, release: 250 }, effectType: 'audio' },
            { type: 'equalizer', name: 'Parametric EQ', params: { bands: [
                { f: 100, w: 100, g: 0 },
                { f: 1000, w: 500, g: 0 },
                { f: 8000, w: 2000, g: 0 }
            ]}, effectType: 'audio' }
        ];
        
        effects.forEach(effect => {
            const el = document.createElement('div');
            el.className = 'effect-item p-2 rounded cursor-grab';
            el.textContent = effect.name;
            el.draggable = true;
            el.dataset.effect = JSON.stringify(effect);
            effectsBin.appendChild(el);
        });
    }

    function populateTransitionsBin() {
        const transitions = [
            { type: 'crossfade', name: 'Crossfade', duration: 1.0 },
        ];
        
        transitions.forEach(trans => {
            const el = document.createElement('div');
            el.className = 'transition-item p-2 rounded cursor-grab';
            el.textContent = trans.name;
            el.draggable = true;
            el.dataset.transition = JSON.stringify(trans);
            transitionsBin.appendChild(el);
        });
    }

    effectsBin.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('effect-item')) {
            e.dataTransfer.setData('application/json-effect', e.target.dataset.effect);
        }
    });

    transitionsBin.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('transition-item')) {
            e.dataTransfer.setData('application/json-transition', e.target.dataset.transition);
        }
    });

    
    function saveState() {
        history.push(JSON.parse(JSON.stringify(project)));
        redoStack = [];
        if (history.length > 50) {
            history.shift(); 
        }
        updateUndoRedoButtons();
    }

    function undo() {
        if (history.length === 0) return;
        redoStack.push(JSON.parse(JSON.stringify(project)));
        project = history.pop();
        selectClip(null); 
        renderAll();
        requestStaticFrame(previewTimestamp); 
        updateUndoRedoButtons();
    }

    function redo() {
        if (redoStack.length === 0) return;
        history.push(JSON.parse(JSON.stringify(project)));
        project = redoStack.pop();
        selectClip(null);
        renderAll();
        requestStaticFrame(previewTimestamp);
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        undoButton.disabled = history.length === 0;
        redoButton.disabled = redoStack.length === 0;
    }


    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
        ws.onopen = () => console.log('🔌 Preview WebSocket connected');
        ws.onclose = () => setTimeout(connectWebSocket, 1000);
        ws.onerror = (err) => console.error('WebSocket error:', err);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'preview_ready' && !isVideoPlaybackMode) {
                previewImage.src = data.previewUrl + `?t=${Date.now()}`;
            }
        };
    }

    async function requestStaticFrame(timestamp) {
        if (isVideoPlaybackMode) await switchToStaticPreviewMode();
        previewTimestamp = timestamp;
        updatePlayheadAndTimeDisplay(timestamp);
        
        if (ws && ws.readyState === WebSocket.OPEN) {
             ws.send(JSON.stringify({
                type: 'preview_request', project, timestamp, duration: 0, 
                sessionId: 'static_' + Date.now(),
                useProxy: useProxies // <-- Send proxy flag
            }));
        }
    }
    
    function requestStaticFrameThrottled(timestamp) {
        updatePlayheadAndTimeDisplay(timestamp);
        clearTimeout(previewRequestTimeout);
        previewRequestTimeout = setTimeout(() => requestStaticFrame(timestamp), 250);
    }

    
    function handlePlayPause() {
        if (isMaskEditingMode) return;
        if (isVideoPlaybackMode) {
            if (previewVideo.paused) {
                previewVideo.play();
            } else {
                previewVideo.pause();
            }
        } else {
            switchToRealtimeVideoMode();
        }
    }

    async function stopPlayback() {
        await switchToStaticPreviewMode();
        await requestStaticFrame(0);
    }
    
    function startPlaybackAnimation() {
        isAnimatingPlayhead = true;
        function animate() {
            if (!isAnimatingPlayhead) return;
            previewTimestamp = currentPreviewSegment.start + previewVideo.currentTime;
            updatePlayheadAndTimeDisplay(previewTimestamp);
            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    }

    function stopPlaybackAnimation() {
        isAnimatingPlayhead = false;
    }

    async function switchToRealtimeVideoMode() {
        try {
            isVideoPlaybackMode = true;
            previewImage.classList.add('hidden');
            previewVideo.classList.remove('hidden');
            interactiveOverlay.classList.add('hidden');

            playIcon.classList.add('hidden');
            pauseIcon.classList.add('hidden');
            loadingIcon.classList.remove('hidden');
            playPauseButton.disabled = true;
            playPauseButton.title = 'Loading...';

            const response = await fetch('/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project, timestamp: previewTimestamp, duration: 30, useProxy: useProxies }) // <-- Send proxy flag
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || 'Server failed to generate preview.');

            currentPreviewSegment = { url: result.previewUrl, start: result.timestamp, duration: result.duration };
            previewVideo.src = result.previewUrl;
            
        } catch(error) {
            console.error("Failed to start real-time preview:", error);
            await switchToStaticPreviewMode();
        }
    }

    async function switchToStaticPreviewMode() {
        const wasInVideoMode = isVideoPlaybackMode;
        stopPlaybackAnimation();
        previewVideo.pause();
        
        if (wasInVideoMode) { 
            previewTimestamp = currentPreviewSegment.start + previewVideo.currentTime;
        }

        isVideoPlaybackMode = false;
        
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        loadingIcon.classList.add('hidden');
        playPauseButton.title = 'Play';
        playPauseButton.disabled = false;

        previewVideo.classList.add('hidden');
        previewImage.classList.remove('hidden');
        if (selectedClipId) renderInteractiveOverlay();
    }
    
    function invalidatePreview() {
        if (isVideoPlaybackMode) {
            switchToStaticPreviewMode();
            requestStaticFrameThrottled(previewTimestamp);
        }
    }
    
    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        const ms = Math.floor((seconds - Math.floor(seconds)) * 10);
        return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`;
    }

    function updatePlayheadAndTimeDisplay(time) {
        playhead.style.left = `${time * PIXELS_PER_SECOND}px`;
        timeDisplay.textContent = formatTime(time);
        updateSplitButtonState();
    }

    
    function updatePreviewAspectRatio() {
        if (project.settings.width && project.settings.height) {
            previewContent.style.aspectRatio = `${project.settings.width} / ${project.settings.height}`;
        }
    }
    
    function renderAll() {
        const projectDuration = Math.max(10, ...project.tracks.flatMap(t => t.clips.map(c => c.timelineStart + c.duration)));
        timelineContainer.style.width = `${projectDuration * PIXELS_PER_SECOND + 200}px`; 

        renderTracks();
        renderTimelineClips();
        renderPropertiesPanel();
        renderMediaBin();
        renderInteractiveOverlay();
    }

    function renderTracks() {
        timelineContainer.querySelectorAll('.track').forEach(t => t.remove());
        trackHeaders.innerHTML = '<div class="h-6"></div>';

        project.tracks.filter(t => t.type !== 'text').forEach((track, index) => {
            const trackEl = document.createElement('div');
            trackEl.id = track.id;
            trackEl.dataset.trackType = track.type;
            trackEl.className = 'track h-16 bg-gray-600 rounded relative mb-2';
            timelineContainer.appendChild(trackEl);
            
            const headerEl = document.createElement('div');
            headerEl.className = 'track-header h-21 flex flex-col justify-center items-center p-2 rounded bg-gray-700 mb-2';
            
            if (track.type === 'audio') {
                headerEl.innerHTML = `
                    <span class="text-xs text-gray-400 font-semibold uppercase">AUDIO ${index + 1}</span>
                    <div class="w-full mt-1">
                        <label class="text-xs text-gray-500">Vol</label>
                        <input type="range" min="0" max="2" step="0.05" value="${track.volume}" class="w-full h-1 track-volume-slider" data-track-id="${track.id}">
                    </div>
                     <div class="w-full mt-1">
                        <label class="text-xs text-gray-500">Pan</label>
                        <input type="range" min="-1" max="1" step="0.1" value="${track.pan}" class="w-full h-1 pan-slider" data-track-id="${track.id}">
                    </div>
                `;
            } else {
                 headerEl.innerHTML = `<span class="text-xs text-gray-400 font-semibold uppercase">VIDEO ${index + 1}</span>`;
            }

            trackHeaders.appendChild(headerEl);
        });
        renderMarkers();
    }

    function renderMarkers() {
        timelineContainer.querySelectorAll('.marker').forEach(el => el.remove());

        project.markers.forEach(marker => {
            const markerEl = document.createElement('div');
            markerEl.className = 'marker';
            markerEl.style.left = `${marker.time * PIXELS_PER_SECOND}px`;
            markerEl.title = marker.name;

            const labelEl = document.createElement('div');
            labelEl.className = 'marker-label';
            labelEl.textContent = marker.name;
            
            markerEl.appendChild(labelEl);
            timelineContainer.appendChild(markerEl);
        });
    }

    function renderTimelineClips() {
        timelineContainer.querySelectorAll('.track').forEach(trackEl => {
            trackEl.innerHTML = '';
        });

        project.tracks.forEach(track => {
            const trackEl = document.getElementById(track.id);
            if (!trackEl) return;
            track.clips.forEach(clip => {
                const clipEl = document.createElement('div');
                clipEl.className = `clip ${clip.type}-clip ${selectedClipId === clip.id ? 'selected' : ''}`;
                clipEl.style.left = `${clip.timelineStart * PIXELS_PER_SECOND}px`;
                clipEl.style.width = `${clip.duration * PIXELS_PER_SECOND}px`;
                clipEl.dataset.id = clip.id;
                
                if (clip.type === 'audio' && clip.src) {
                    
                    const waveformContainer = document.createElement('div');
                    waveformContainer.className = 'waveform-container';
                    waveformContainer.style.width = '100%';
                    waveformContainer.style.height = '100%';
                    waveformContainer.style.position = 'relative';
                    waveformContainer.style.overflow = 'hidden';
                    
                    const waveformCanvas = document.createElement('canvas');
                    waveformCanvas.className = 'waveform-canvas';
                    waveformCanvas.style.width = '100%';
                    waveformCanvas.style.height = '100%';
                    waveformCanvas.style.position = 'absolute';
                    waveformCanvas.style.top = '0';
                    waveformCanvas.style.left = '0';
                    
                    const clipLabel = document.createElement('div');
                    clipLabel.className = 'clip-label';
                    clipLabel.textContent = clip.displayName || clip.src;
                    clipLabel.style.position = 'absolute';
                    clipLabel.style.top = '4px';
                    clipLabel.style.left = '8px';
                    clipLabel.style.fontSize = '10px';
                    clipLabel.style.fontWeight = '600';
                    clipLabel.style.color = 'white';
                    clipLabel.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
                    clipLabel.style.zIndex = '2';
                    clipLabel.style.pointerEvents = 'none';
                    
                    waveformContainer.appendChild(waveformCanvas);
                    waveformContainer.appendChild(clipLabel);
                    clipEl.appendChild(waveformContainer);
                    
                    
                    loadAndDrawWaveform(clip.src, waveformCanvas, clip.duration);
                } else {
                    clipEl.textContent = clip.displayName || clip.src || clip.text;
                }
                
                if (selectedClipId === clip.id) {
                    const leftHandle = document.createElement('div');
                    leftHandle.className = 'resize-handle left';
                    const rightHandle = document.createElement('div');
                    rightHandle.className = 'resize-handle right';
                    clipEl.appendChild(leftHandle);
                    clipEl.appendChild(rightHandle);
                }

                if (clip.transitionOut && clip.transitionOut.duration > 0) {
                    const transEl = document.createElement('div');
                    transEl.className = 'transition-visual';
                    transEl.style.width = `${clip.transitionOut.duration * PIXELS_PER_SECOND / 2}px`;
                    clipEl.appendChild(transEl);
                }

                trackEl.appendChild(clipEl);
            });
        });
    }
    
    
    async function loadAndDrawWaveform(filename, canvas, duration) {
        try {
            const response = await fetch(`/waveform/${filename}`);
            const data = await response.json();
            
            if (data.success && data.waveform) {
                drawWaveform(canvas, data.waveform, duration);
            }
        } catch (error) {
            console.error('Error loading waveform:', error);
            
            drawPlaceholderWaveform(canvas);
        }
    }
    
    function drawWaveform(canvas, waveformData, duration) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const width = rect.width;
        const height = rect.height;
        const centerY = height / 2;
        
        
        ctx.clearRect(0, 0, width, height);
        
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        
        
        ctx.beginPath();
        const stepX = width / waveformData.length;
        
        for (let i = 0; i < waveformData.length; i++) {
            const x = i * stepX;
            const maxY = centerY - (waveformData[i].max * centerY * 0.8);
            if (i === 0) {
                ctx.moveTo(x, maxY);
            } else {
                ctx.lineTo(x, maxY);
            }
        }
        
        
        for (let i = waveformData.length - 1; i >= 0; i--) {
            const x = i * stepX;
            const minY = centerY - (waveformData[i].min * centerY * 0.8);
            ctx.lineTo(x, minY);
        }
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    function drawPlaceholderWaveform(canvas) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const width = rect.width;
        const height = rect.height;
        const centerY = height / 2;
        
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        
        
        ctx.beginPath();
        for (let x = 0; x < width; x += 2) {
            const y = centerY + Math.sin(x * 0.1) * (height * 0.3);
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
    
    function renderPropertiesPanel() {
        if (!selectedClipId) {
            propertiesPanelWrapper.classList.add('hidden');
            keyframeEditorPanel.classList.add('hidden');
            return;
        }
        const { clip } = getClip(selectedClipId);
        if (!clip) return;

        let content = `<div class="font-bold text-sm mb-2">${clip.displayName}</div>`;
        content += `<fieldset class="border border-gray-600 p-2 rounded"><legend class="text-xs px-1">Timing</legend><div class="grid grid-cols-2 gap-2 text-sm">
                        <label>Start</label><input class="property-input" type="number" step="0.1" data-prop="timelineStart" value="${clip.timelineStart.toFixed(2)}">
                        <label>Duration</label><input class="property-input" type="number" step="0.1" data-prop="duration" value="${clip.duration.toFixed(2)}" disabled>
                    </div></fieldset>`;
        
        if (clip.type === 'video' || clip.type === 'audio') {
            content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Speed</legend><div class="grid grid-cols-2 gap-2 text-sm items-center">
                           <label>Speed (%)</label><input class="property-input" type="number" step="10" min="10" data-prop="speed" value="${clip.speed * 100}">
                           <label class="flex items-center gap-2">Reverse<input class="form-checkbox" type="checkbox" data-prop="reverse" ${clip.reverse ? 'checked' : ''}></label>
                        </div></fieldset>`;
        }
        
        const createPropUI = (label, propPath, value) => {
            const prop = getPropertyByPath(clip, propPath);
            const isKeyframed = prop.keyframes && prop.keyframes.length > 0;
            return `
                <div class="flex items-center gap-2">
                    <span class="keyframe-button ${isKeyframed ? 'active' : ''}" data-keyframe-prop="${propPath}" title="Toggle Keyframe">◇</span>
                    <label>${label}</label>
                </div>
                <input class="property-input" type="number" data-prop="${propPath}.value" value="${Math.round(value)}">
            `;
        };

        if (clip.type === 'video' || clip.type === 'text' || clip.type === 'adjustment') {
            content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Transform</legend><div class="grid grid-cols-2 gap-2 text-sm">
                           ${createPropUI('X', 'transform.x', clip.transform.x.value)}
                           ${createPropUI('Y', 'transform.y', clip.transform.y.value)}
                        </div>`;
            if (clip.type === 'video' || clip.type === 'adjustment') {
                 content += `<div class="text-sm mt-2 grid grid-cols-[auto,1fr] gap-2 items-center">
                                <span class="keyframe-button ${clip.transform.scale.keyframes.length > 0 ? 'active' : ''}" data-keyframe-prop="transform.scale" title="Toggle Keyframe">◇</span>
                                <label>Scale</label>
                                <input class="w-full col-span-2" type="range" min="0.1" max="2" step="0.01" data-prop="transform.scale.value" value="${clip.transform.scale.value.toFixed(2)}">
                            </div>`;
            }
            content += `</fieldset>`;
        }
        if (clip.type === 'video' || clip.type === 'adjustment') {
            content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Opacity</legend>
                        <div class="text-sm grid grid-cols-[auto,1fr] gap-2 items-center">
                            <span class="keyframe-button ${clip.opacity.keyframes.length > 0 ? 'active' : ''}" data-keyframe-prop="opacity" title="Toggle Keyframe">◇</span>
                            <label>Opacity</label>
                            <input class="w-full col-span-2" type="range" min="0" max="1" step="0.01" data-prop="opacity.value" value="${clip.opacity.value.toFixed(2)}">
                        </div>
                        </fieldset>`;
            
            content += `<fieldset class="color-correction-panel p-2 rounded mt-4"><legend class="text-xs px-1">Color Wheels</legend>
                            <div class="flex justify-around text-center text-xs">
                                ${createColorWheel('lift', clip.filters.colorWheels.lift, clip.filters.colorWheels.liftY)}
                                ${createColorWheel('gamma', clip.filters.colorWheels.gamma, clip.filters.colorWheels.gammaY)}
                                ${createColorWheel('gain', clip.filters.colorWheels.gain, clip.filters.colorWheels.gainY)}
                            </div>
                        </fieldset>`;

            content += `<fieldset class="color-correction-panel p-2 rounded mt-4"><legend class="text-xs px-1">Color Correction</legend>
                        <div class="space-y-3 text-sm">
                            <div><label>Brightness</label><input class="w-full color-slider" type="range" min="-1" max="1" step="0.05" data-prop="filters.brightness" value="${clip.filters.brightness ?? 0}"></div>
                            <div><label>Contrast</label><input class="w-full color-slider" type="range" min="0" max="2" step="0.05" data-prop="filters.contrast" value="${clip.filters.contrast ?? 1}"></div>
                            <div><label>Saturation</label><input class="w-full color-slider" type="range" min="0" max="2" step="0.05" data-prop="filters.saturation" value="${clip.filters.saturation ?? 1}"></div>
                        </div>
                        </fieldset>`;

            content += `<fieldset class="color-correction-panel p-2 rounded mt-4"><legend class="text-xs px-1">Color Grading</legend>
                        <div class="space-y-3 text-sm">
                            <div><label class="block mb-1">LUT (.cube)</label><input type="file" class="property-input text-xs" id="lut-upload" accept=".cube"><span class="text-xs text-gray-400">${clip.filters.lut || 'None applied'}</span></div>
                            <div><label class="block mb-1">Curves (master)</label><textarea class="property-input text-xs" data-prop="filters.curves" placeholder="e.g., 0/0 0.5/0.6 1/1">${clip.filters.curves || ''}</textarea></div>
                        </div>
                        </fieldset>`;
            
            content += `<fieldset class="creative-effects-panel p-2 rounded mt-4"><legend class="text-xs px-1">Applied Effects</legend>
                        <div id="applied-effects-list" class="space-y-2 text-sm"></div></fieldset>`;
        }
        if (clip.type === 'video') {
             content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Chroma Key</legend>
                         <div class="space-y-3 text-sm">
                            <div class="flex items-center gap-2"><label>Enable</label><input class="form-checkbox" type="checkbox" data-prop="keying.enabled" ${clip.keying.enabled ? 'checked' : ''}></div>
                            <div class="flex items-center gap-2"><label>Key Color</label><input class="w-full h-8 p-1 bg-gray-800 border border-gray-600 rounded cursor-pointer" type="color" data-prop="keying.color" value="${clip.keying.color}"></div>
                            <div><label>Similarity</label><input class="w-full color-slider" type="range" min="0.01" max="0.5" step="0.01" data-prop="keying.similarity" value="${clip.keying.similarity}"></div>
                            <div><label>Blend</label><input class="w-full color-slider" type="range" min="0.01" max="0.5" step="0.01" data-prop="keying.blend" value="${clip.keying.blend}"></div>
                         </div>
                         </fieldset>`;
             content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Masking</legend>
                        <button id="edit-mask-button" class="modern-button secondary w-full text-xs">Edit Mask</button>
                        </fieldset>`;
        }
        if (clip.type === 'audio') {
             content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Audio</legend>
                         <div class="text-sm"><label>Clip Volume</label><input class="w-full" type="range" min="0" max="2" step="0.01" data-prop="volume" value="${clip.volume.toFixed(2)}"></div></fieldset>`;
            content += `<fieldset class="creative-effects-panel p-2 rounded mt-4"><legend class="text-xs px-1">Applied Effects</legend>
                        <div id="applied-effects-list" class="space-y-2 text-sm"></div></fieldset>`;
        }
        if (clip.type === 'text') {
            content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Text</legend>
                        <div class="space-y-2 text-sm">
                           <div><label>Content</label><input class="property-input" type="text" data-prop="text" value="${clip.text}"></div>
                           <div><label>Font Size</label><input class="property-input" type="number" data-prop="fontSize" value="${clip.fontSize}"></div>
                           <div><label>Color</label><input class="w-full h-8 p-1 bg-gray-800 border border-gray-600 rounded cursor-pointer" type="color" data-prop="fontColor" value="${clip.fontColor}"></div>
                        </div></fieldset>`;
        }
        propertiesContent.innerHTML = content;
        
        if (clip.type === 'video' || clip.type === 'adjustment' || clip.type === 'audio') {
            renderAppliedEffects(clip);
            if (clip.type !== 'audio') {
                const lutUpload = document.getElementById('lut-upload');
                if(lutUpload) lutUpload.addEventListener('change', handleLutUpload);
            }
        }

        if (clip.type === 'video' || clip.type === 'adjustment') {
             setupColorWheels();
        }

        if (clip.type === 'video') {
            document.getElementById('edit-mask-button').addEventListener('click', enterMaskEditingMode);
        }

        propertiesPanelWrapper.classList.remove('hidden');
        renderKeyframeEditor(clip);
    }

    function renderKeyframeEditor(clip) {
        const animatableProps = ['transform.x', 'transform.y', 'transform.scale', 'opacity'];
        let content = '';
        let hasAnyKeyframes = false;

        animatableProps.forEach(propPath => {
            const prop = getPropertyByPath(clip, propPath);
            if (prop && prop.keyframes && prop.keyframes.length > 0) {
                hasAnyKeyframes = true;
                const propName = propPath.split('.').pop();
                content += `<div class="text-sm">
                                <label class="font-semibold capitalize">${propName}</label>
                                <div class="keyframe-timeline" data-prop-path="${propPath}">`;
                prop.keyframes.forEach(kf => {
                    const percent = ((kf.time - clip.timelineStart) / clip.duration) * 100;
                    content += `<div class="keyframe-dot" style="left: ${percent}%" title="Value: ${kf.value.toFixed(2)} at ${kf.time.toFixed(2)}s"></div>`;
                });
                content += `</div></div>`;
            }
        });

        if (hasAnyKeyframes) {
            keyframeEditorContent.innerHTML = content;
            keyframeEditorPanel.classList.remove('hidden');
        } else {
            keyframeEditorPanel.classList.add('hidden');
        }
    }


    function renderAppliedEffects(clip) {
        const container = document.getElementById('applied-effects-list');
        if (!container) return;
        container.innerHTML = ''; 
        if (!clip.effects || clip.effects.length === 0) {
            container.innerHTML = '<p class="text-gray-400">Drag an effect here.</p>';
            return;
        }

        clip.effects.forEach((effect, index) => {
            let effectControls = `<div class="flex justify-between items-center"><span class="font-semibold capitalize">${effect.name || effect.type}</span><button class="text-red-500 hover:text-red-400 text-xs" data-effect-index="${index}">Remove</button></div>`;
            
            // --- DYNAMIC PLUGIN UI RENDERING ---
            const plugin = availablePlugins.find(p => p.type === effect.type);
            if (plugin && plugin.params) {
                plugin.params.forEach(param => {
                    const currentValue = effect.params[param.key] ?? param.defaultValue;
                    effectControls += '<div><label class="text-xs text-gray-400">' + param.name + '</label>';
                    if (param.type === 'slider') {
                        effectControls += `<input class="w-full color-slider" type="range" min="${param.min}" max="${param.max}" step="${param.step}" data-effect-prop="${param.key}" data-effect-index="${index}" value="${currentValue}">`;
                    } else if (param.type === 'number') {
                        effectControls += `<input type="number" step="${param.step || 1}" data-effect-prop="${param.key}" data-effect-index="${index}" value="${currentValue}" class="property-input !py-1 text-xs">`;
                    }
                    effectControls += '</div>';
                });
            }
            // --- END DYNAMIC UI ---
            else if (effect.type === 'blur') {
                effectControls += `<div><label>Strength</label><input class="w-full color-slider" type="range" min="0" max="20" step="0.5" data-effect-prop="strength" data-effect-index="${index}" value="${effect.params.strength}"></div>`;
            } else if (effect.type === 'sharpen') {
                 effectControls += `<div><label>Strength</label><input class="w-full color-slider" type="range" min="0" max="2" step="0.1" data-effect-prop="strength" data-effect-index="${index}" value="${effect.params.strength}"></div>`;
            } else if (effect.type === 'compressor') {
                effectControls += `
                    <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <label>Threshold (dB)</label><input type="number" step="1" data-effect-prop="threshold" data-effect-index="${index}" value="${effect.params.threshold}" class="property-input !py-1">
                        <label>Ratio</label><input type="number" step="0.5" data-effect-prop="ratio" data-effect-index="${index}" value="${effect.params.ratio}" class="property-input !py-1">
                        <label>Attack (ms)</label><input type="number" step="1" data-effect-prop="attack" data-effect-index="${index}" value="${effect.params.attack}" class="property-input !py-1">
                        <label>Release (ms)</label><input type="number" step="10" data-effect-prop="release" data-effect-index="${index}" value="${effect.params.release}" class="property-input !py-1">
                    </div>
                `;
            } else if (effect.type === 'equalizer') {
                const bandLabels = ['Low', 'Mid', 'High'];
                effect.params.bands.forEach((band, bandIndex) => {
                    effectControls += `
                        <div class="mt-2 border-t border-gray-700 pt-2">
                            <p class="font-semibold text-xs mb-1">${bandLabels[bandIndex]}</p>
                            <div class="grid grid-cols-3 gap-2 text-xs">
                                <div><label>Freq</label><input type="number" data-effect-prop="f" data-effect-index="${index}" data-band-index="${bandIndex}" value="${band.f}" class="property-input !py-1"></div>
                                <div><label>Gain</label><input type="number" step="0.5" data-effect-prop="g" data-effect-index="${index}" data-band-index="${bandIndex}" value="${band.g}" class="property-input !py-1"></div>
                                <div><label>Q</label><input type="number" step="10" data-effect-prop="w" data-effect-index="${index}" data-band-index="${bandIndex}" value="${band.w}" class="property-input !py-1"></div>
                            </div>
                        </div>`;
                });
            }

            container.innerHTML += `<div class="p-2 bg-gray-900 rounded">${effectControls}</div>`;
        });
    }

    async function handleLutUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('lut', file);
        
        try {
            const response = await fetch('/upload-lut', { method: 'POST', body: formData });
            const result = await response.json();
            if(result.success) {
                saveState();
                updateClipProperty('filters.lut', result.filename);
                requestStaticFrameThrottled(previewTimestamp);
            } else {
                alert(`LUT Upload Failed: ${result.message}`);
            }
        } catch(err) {
            alert(`Error uploading LUT: ${err.message}`);
        }
    }
    
    function renderMediaBin() {
        mediaBin.innerHTML = '';
        mediaBinFiles.forEach(file => {
            const el = document.createElement('div');
            el.className = 'media-item p-2 rounded bg-gray-900 cursor-grab';
            el.textContent = file.originalName.length > 25 ? file.originalName.substring(0, 22) + '...' : file.originalName;
            el.draggable = true;
            el.dataset.file = JSON.stringify(file); // Store full file object
            mediaBin.appendChild(el);
        });
    }

    function renderInteractiveOverlay() {
        if (!selectedClipId || isVideoPlaybackMode || isMaskEditingMode) {
            interactiveOverlay.classList.add('hidden');
            return;
        }
        const { clip } = getClip(selectedClipId);
        if (clip.type !== 'video' && clip.type !== 'text') {
            interactiveOverlay.classList.add('hidden');
            return;
        }
        const previewRect = previewWindow.getBoundingClientRect();
        if (previewRect.width === 0 || previewRect.height === 0) return;
        const scaleFactor = previewRect.width / project.settings.width;
        let width, height, x, y;
        if (clip.type === 'video') {
            const scale = getPropertyValueAtTime(clip, 'transform.scale', previewTimestamp);
            width = (clip.originalWidth * scale) * scaleFactor;
            height = (clip.originalHeight * scale) * scaleFactor;
            x = getPropertyValueAtTime(clip, 'transform.x', previewTimestamp) * scaleFactor;
            y = getPropertyValueAtTime(clip, 'transform.y', previewTimestamp) * scaleFactor;
        } else {
            width = (clip.fontSize * clip.text.length * 0.55) * scaleFactor;
            height = (clip.fontSize * 1.2) * scaleFactor;
            x = getPropertyValueAtTime(clip, 'transform.x', previewTimestamp) * scaleFactor;
            y = getPropertyValueAtTime(clip, 'transform.y', previewTimestamp) * scaleFactor;
        }
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
        selectionBox.style.left = `${x}px`;
        selectionBox.style.top = `${y}px`;
        interactiveOverlay.classList.remove('hidden');
    }

    
    
    
    function getClip(clipId) {
        for (const track of project.tracks) {
            const clip = track.clips.find(c => c.id === clipId);
            if (clip) return { clip, track };
        }
        return { clip: null, track: null };
    }

    function selectClip(clipId) {
        if (isMaskEditingMode) exitMaskEditingMode(false);
        if (selectedClipId === clipId) return;
        invalidatePreview();
        selectedClipId = clipId;
        renderAll(); 
        if (clipId) {
            const { clip } = getClip(clipId);
            requestStaticFrame(clip.timelineStart);
            renderInteractiveOverlay();
        } else {
            interactiveOverlay.classList.add('hidden');
        }
    }
    
    function getPropertyByPath(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
    
    function setPropertyByPath(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const target = parts.reduce((acc, part) => acc[part], obj);
        target[last] = value;
    }

    function updateClipProperty(propPath, value) {
        if (!selectedClipId) return;
        const { clip } = getClip(selectedClipId);
        
        const prop = getPropertyByPath(clip, propPath);
        
        if (typeof prop === 'object' && prop !== null && 'keyframes' in prop) {
             const keyframeIndex = prop.keyframes.findIndex(kf => Math.abs(kf.time - previewTimestamp) < 0.01);
             if (keyframeIndex > -1) {
                 prop.keyframes[keyframeIndex].value = value;
             }
             prop.value = value;
        } else {
            setPropertyByPath(clip, propPath, value);
        }

        if (propPath === 'speed') {
            if (value > 0) {
                clip.duration = clip.originalDuration / value;
            }
        }

        renderAll();
    }
    
     function updateEffectProperty(effectIndex, propName, value, bandIndex) {
        if (!selectedClipId) return;
        const { clip } = getClip(selectedClipId);
        if (clip && clip.effects && clip.effects[effectIndex]) {
            if (bandIndex !== undefined) {
                clip.effects[effectIndex].params.bands[bandIndex][propName] = value;
            } else {
                clip.effects[effectIndex].params[propName] = value;
            }
            renderPropertiesPanel();
        }
    }

    function removeEffect(effectIndex) {
        if (!selectedClipId) return;
        const { clip } = getClip(selectedClipId);
        if (clip && clip.effects) {
            clip.effects.splice(effectIndex, 1);
            renderPropertiesPanel();
        }
    }

    function deleteClip(clipId) {
        if (!clipId) return;
    
        const { clip: clipToDelete, track: trackOfClip } = getClip(clipId);
        if (!clipToDelete || !trackOfClip) return;
    
        const isRippleActive = rippleDeleteToggle.checked;
        
        if (isRippleActive && trackOfClip.type !== 'text') { 
            const gapDuration = clipToDelete.duration;
            const gapStart = clipToDelete.timelineStart;
    
            
            trackOfClip.clips = trackOfClip.clips.filter(c => c.id !== clipId);
    
            
            trackOfClip.clips.forEach(c => {
                if (c.timelineStart >= gapStart) {
                    c.timelineStart -= gapDuration;
                }
            });
        } else {
            
            trackOfClip.clips = trackOfClip.clips.filter(c => c.id !== clipId);
        }
    
        selectClip(null); 
    }
    
    
    function splitClip() {
        if (!selectedClipId) return;

        const { clip, track } = getClip(selectedClipId);
        if (!clip || !track || (clip.type !== 'video' && clip.type !== 'audio')) return;

        const EDGE_EPSILON = 0.001;
        const clipStart = clip.timelineStart;
        const clipEnd = clip.timelineStart + clip.duration;
        
        let splitTime = Math.min(clipEnd - EDGE_EPSILON, Math.max(clipStart + EDGE_EPSILON, previewTimestamp));

        
        if (clipEnd - clipStart <= 2 * EDGE_EPSILON) {
            return;
        }

        const firstPartDuration = splitTime - clip.timelineStart;
        const secondPartDuration = clip.duration - firstPartDuration;
        
        const firstPartOriginalDuration = firstPartDuration * clip.speed;

        
        const newClip = JSON.parse(JSON.stringify(clip)); 
        newClip.id = Date.now();
        newClip.timelineStart = splitTime;
        newClip.duration = secondPartDuration;
        
        newClip.start = clip.start + firstPartOriginalDuration;
        newClip.originalDuration = clip.originalDuration - firstPartOriginalDuration;

        
        clip.duration = firstPartDuration;
        clip.originalDuration = firstPartOriginalDuration;
        
        
        track.clips.push(newClip);
        track.clips.sort((a,b) => a.timelineStart - b.timelineStart);

        
        selectClip(clip.id);
    }

    
    function updateSplitButtonState() {
        if (!selectedClipId) {
            splitClipButton.disabled = true;
            return;
        }
        const { clip } = getClip(selectedClipId);
        
        splitClipButton.disabled = !clip || (clip.type !== 'video' && clip.type !== 'audio');
    }
    
    
    
    playPauseButton.addEventListener('click', handlePlayPause);
    stopButton.addEventListener('click', stopPlayback);
    
    splitClipButton.addEventListener('click', () => {
        saveState();
        splitClip();
        renderAll();
    });
    
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);

    // --- PROXY TOGGLE EVENT LISTENER ---
    useProxiesToggle.checked = useProxies;
    useProxiesToggle.addEventListener('change', () => {
        useProxies = useProxiesToggle.checked;
        console.log(`Proxy mode: ${useProxies ? 'ON' : 'OFF'}`);
        // Refresh the current frame with the new resolution setting
        requestStaticFrame(previewTimestamp);
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return; 
        }

        if (isMaskEditingMode && e.key === 'Escape') {
            exitMaskEditingMode(false);
        }

        if (e.key.toLowerCase() === 'k') {
            e.preventDefault();
            handlePlayPause();
            jklPlaybackRate = 1;
        }
        if (e.key.toLowerCase() === 'l') {
            e.preventDefault();
            if (!isVideoPlaybackMode) switchToRealtimeVideoMode();
            if (jklPlaybackRate < 0) jklPlaybackRate = 1;
            else if (jklPlaybackRate < 8) jklPlaybackRate *= 2;
            previewVideo.playbackRate = jklPlaybackRate;
            previewVideo.play();
        }
         if (e.key.toLowerCase() === 'j') {
            e.preventDefault();
            if (!isVideoPlaybackMode) switchToRealtimeVideoMode();
            if (jklPlaybackRate > 0) jklPlaybackRate = -1;
            else if (jklPlaybackRate > -8) jklPlaybackRate *= 2;
            previewVideo.playbackRate = jklPlaybackRate;
            previewVideo.play();
        }

        if (e.key === ' ') {
            e.preventDefault();
            handlePlayPause();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    });

    importButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        for (const file of fileInput.files) {
            const formData = new FormData();
            formData.append('media', file);
            const response = await fetch('/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if(result.success) {
                mediaBinFiles.push({ 
                    filename: result.filename, 
                    originalName: result.originalName, 
                    type: file.type.split('/')[0],
                    hasProxy: result.hasProxy
                });
            }
        }
        renderMediaBin();
    });

    addVideoTrackButton.addEventListener('click', () => { 
        saveState();
        invalidatePreview(); 
        project.tracks.push({ id: `video-${Date.now()}`, type: 'video', clips: [] }); 
        previewTimestamp = 0; 
        renderAll(); 
        updatePlayheadAndTimeDisplay(previewTimestamp); 
    });
    addAudioTrackButton.addEventListener('click', () => { 
        saveState();
        invalidatePreview(); 
        project.tracks.push({ id: `audio-${Date.now()}`, type: 'audio', clips: [], volume: 1, pan: 0 }); 
        previewTimestamp = 0; 
        renderAll(); 
        updatePlayheadAndTimeDisplay(previewTimestamp); 
    });
    addTextClipButton.addEventListener('click', () => {
        saveState();
        invalidatePreview();
        const newClip = {
            id: Date.now(), type: 'text', displayName: 'New Text', text: 'New Text', timelineStart: previewTimestamp, duration: 5,
            fontSize: 48, fontColor: '#FFFFFF', 
            transform: { 
                x: { value: (project.settings.width / 2) - 100, keyframes: [] },
                y: { value: (project.settings.height / 2) - 50, keyframes: [] },
                scale: { value: 1, keyframes: [] },
            }
        };
        project.tracks.find(t => t.type === 'text').clips.push(newClip);
        selectClip(newClip.id);
        renderAll();
    });
    addAdjustmentLayerButton.addEventListener('click', () => {
        saveState();
        invalidatePreview();
        
        const videoTrack = project.tracks.find(t => t.type === 'video');
        if (!videoTrack) {
            alert("Please add a video track first.");
            return;
        }

        const newClip = {
            id: Date.now(),
            type: 'adjustment',
            displayName: 'Adjustment Layer',
            timelineStart: previewTimestamp,
            duration: 10,
            opacity: { value: 1, keyframes: [] },
            transform: {
                x: { value: 0, keyframes: [] },
                y: { value: 0, keyframes: [] },
                scale: { value: 1, keyframes: [] }
            },
            effects: [],
            filters: { 
                brightness: 0, contrast: 1, saturation: 1, 
                lut: null, curves: null,
                colorWheels: {
                    lift: { r: 0, g: 0, b: 0 }, liftY: 0,
                    gamma: { r: 0, g: 0, b: 0 }, gammaY: 0,
                    gain: { r: 0, g: 0, b: 0 }, gainY: 0,
                }
            }
        };

        videoTrack.clips.push(newClip);
        selectClip(newClip.id);
    });

    deleteClipButton.addEventListener('click', () => { 
        saveState();
        invalidatePreview(); 
        deleteClip(selectedClipId); 
        renderAll();
    });

    mediaBin.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('media-item')) {
            e.dataTransfer.setData('application/json', e.target.dataset.file);
        }
    });

    function getVideoMetadata(src) {
        return new Promise((resolve, reject) => {
            // Use proxy URL for faster metadata loading if available
            const el = document.createElement('video');
            el.preload = 'metadata';
            el.onloadedmetadata = () => {
                resolve({
                    duration: el.duration,
                    width: el.videoWidth,
                    height: el.videoHeight
                });
            };
            el.onerror = () => reject(new Error('Could not load media metadata.'));
            el.src = `/uploads/${src}`; // Always get metadata from original for accurate dimensions
        });
    }

    timelineContainer.addEventListener('dragover', (e) => e.preventDefault());
    timelineContainer.addEventListener('drop', async (e) => {
        e.preventDefault();

        const effectDataJSON = e.dataTransfer.getData('application/json-effect');
        if (effectDataJSON) {
            const clipEl = e.target.closest('.clip');
            if (!clipEl) return;
            const clipId = parseInt(clipEl.dataset.id, 10);
            const { clip } = getClip(clipId);
            const effect = JSON.parse(effectDataJSON);

            const isVideoEffect = effect.effectType === 'video';
            const isAudioEffect = effect.effectType === 'audio';
            const isVideoTarget = clip.type === 'video' || clip.type === 'adjustment';
            const isAudioTarget = clip.type === 'audio';

            if ((isVideoEffect && isVideoTarget) || (isAudioEffect && isAudioTarget)) {
                saveState();
                if (!clip.effects) clip.effects = [];
                clip.effects.push(effect);
                selectClip(clipId);
                renderAll();
                requestStaticFrameThrottled(previewTimestamp);
            } else {
                alert(`Cannot apply a ${effect.effectType} effect to a ${clip.type} clip.`);
            }
            return;
        }
        
        const transitionData = e.dataTransfer.getData('application/json-transition');
        if (transitionData) {
            const trackEl = e.target.closest('.track');
            if (!trackEl) return;
            const rect = trackEl.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineScrollPane.scrollLeft;
            const dropTime = x / PIXELS_PER_SECOND;

            const trackId = trackEl.id;
            const track = project.tracks.find(t => t.id === trackId);
            const clipsOnTrack = track.clips.sort((a,b) => a.timelineStart - b.timelineStart);
            
            for (let i = 0; i < clipsOnTrack.length - 1; i++) {
                const clipA = clipsOnTrack[i];
                const clipB = clipsOnTrack[i+1];
                const junctionTime = clipA.timelineStart + clipA.duration;
                
                if (Math.abs(dropTime - junctionTime) < 0.5) {
                    saveState();
                    const transition = JSON.parse(transitionData);
                    clipA.transitionOut = { type: transition.type, duration: transition.duration };
                    renderAll();
                    invalidatePreview();
                    return;
                }
            }
            return;
        }

        saveState();
        invalidatePreview();
        const trackEl = e.target.closest('.track');
        if (!trackEl) return;
        const fileData = JSON.parse(e.dataTransfer.getData('application/json'));
        const trackType = trackEl.dataset.trackType;
        if (fileData.type !== trackType) return alert(`Cannot place a ${fileData.type} clip on a ${trackType} track.`);
        const rect = trackEl.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineScrollPane.scrollLeft;
        const timelineStart = Math.max(0, x / PIXELS_PER_SECOND);
        
        let metadata = { duration: 5, width: 1280, height: 720 };
        try {
            metadata = await getVideoMetadata(fileData.filename);
        } catch (error) {
            console.warn(error.message, "Using default duration.");
        }

        const isFirstVideoClip = !project.tracks.some(t => t.clips.some(c => c.type === 'video'));
        if (fileData.type === 'video' && isFirstVideoClip) {
            console.log(`Setting project resolution to ${metadata.width}x${metadata.height}`);
            project.settings.width = metadata.width;
            project.settings.height = metadata.height;
            updatePreviewAspectRatio();
        }
        
        const newClip = {
            id: Date.now(), 
            src: fileData.filename, // <-- Key change: Use the unique filename
            displayName: fileData.originalName, 
            type: fileData.type, 
            timelineStart: parseFloat(timelineStart.toFixed(2)),
            start: 0, 
            duration: parseFloat(metadata.duration.toFixed(2)),
            originalDuration: parseFloat(metadata.duration.toFixed(2)), 
            originalWidth: metadata.width,
            originalHeight: metadata.height,
            hasProxy: fileData.hasProxy, // <-- Store proxy info
            volume: 1, 
            opacity: { value: 1, keyframes: [] },
            speed: 1, 
            reverse: false,
            transform: { 
                x: { value: 0, keyframes: [] },
                y: { value: 0, keyframes: [] },
                scale: { value: 1, keyframes: [] }
            },
            effects: [],
            filters: { 
                brightness: 0, contrast: 1, saturation: 1, 
                lut: null, curves: null,
                 colorWheels: {
                    lift: { r: 0, g: 0, b: 0 }, liftY: 0,
                    gamma: { r: 0, g: 0, b: 0 }, gammaY: 0,
                    gain: { r: 0, g: 0, b: 0 }, gainY: 0,
                }
            },
            keying: {
                enabled: false,
                color: '#00ff00',
                similarity: 0.2,
                blend: 0.1
            },
            mask: {
                enabled: false,
                path: []
            },
            transitionOut: { type: 'none', duration: 0 } 
        };

        project.tracks.find(t => t.id === trackEl.id).clips.push(newClip);
        selectClip(newClip.id);
        renderAll();
    });

    
    timelineContainer.addEventListener('mousedown', (e) => {
        if (isMaskEditingMode) return;
        stopPlaybackAnimation();
        invalidatePreview();
        const clipEl = e.target.closest('.clip');
        if (clipEl) {
            saveState();

            const clipId = parseInt(clipEl.dataset.id, 10);
            selectClip(clipId);
            e.preventDefault();
            const { clip } = getClip(clipId);
            const startX = e.clientX;
            const initialLeft = clip.timelineStart;
            const initialStart = clip.start;
            const initialOriginalDuration = clip.originalDuration;
            
            const handle = e.target.classList.contains('resize-handle') ? (e.target.classList.contains('left') ? 'left' : 'right') : null;
            
            
            function getSnapPoints() {
                const points = [previewTimestamp, ...project.markers.map(m => m.time)]; 
                project.tracks.forEach(track => {
                    track.clips.forEach(c => {
                        if (c.id !== clipId) { 
                            points.push(c.timelineStart);
                            points.push(c.timelineStart + c.duration);
                        }
                    });
                });
                return [...new Set(points)]; 
            }

            function onMouseMove(moveEvent) {
                invalidatePreview();
                const dx = (moveEvent.clientX - startX) / PIXELS_PER_SECOND;
                
                
                const snapPoints = getSnapPoints();

                if (handle === 'left') {
                    let newStart = Math.max(0, initialLeft + dx);
                     for (const point of snapPoints) {
                        if (Math.abs((newStart - point) * PIXELS_PER_SECOND) < SNAPPING_THRESHOLD) { newStart = point; break; }
                    }
                    const delta = newStart - initialLeft;
                    
                    if (clip.type === 'video' || clip.type === 'audio') {
                        const durationChange = delta * clip.speed;
                        clip.start = Math.max(0, initialStart + durationChange);
                        clip.originalDuration = Math.max(0.5, initialOriginalDuration - durationChange);
                        clip.duration = clip.originalDuration / clip.speed;
                    } else {
                        clip.duration = Math.max(0.5, clip.duration - delta);
                    }
                    clip.timelineStart = newStart;


                } else if (handle === 'right') {
                    let newDuration = Math.max(0.5, clip.duration + dx);
                    let newEnd = clip.timelineStart + newDuration;
                     for (const point of snapPoints) {
                        if (Math.abs((newEnd - point) * PIXELS_PER_SECOND) < SNAPPING_THRESHOLD) { newEnd = point; break; }
                    }
                    clip.duration = Math.max(0.5, newEnd - clip.timelineStart);
                    if (clip.type === 'video' || clip.type === 'audio') {
                        clip.originalDuration = clip.duration * clip.speed;
                    }

                } else { 
                    let newStart = Math.max(0, initialLeft + dx);
                    let newEnd = newStart + clip.duration;
                    
                    let snapped = false;
                    for (const point of snapPoints) {
                        
                        if (Math.abs((newStart - point) * PIXELS_PER_SECOND) < SNAPPING_THRESHOLD) {
                            newStart = point;
                            snapped = true;
                            break;
                        }
                        
                        if (Math.abs((newEnd - point) * PIXELS_PER_SECOND) < SNAPPING_THRESHOLD) {
                            newStart = point - clip.duration;
                            snapped = true;
                            break;
                        }
                    }
                    clip.timelineStart = Math.max(0, parseFloat(newStart.toFixed(2)));
                }

                renderAll();
                requestStaticFrameThrottled(previewTimestamp);
            }
            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        } else {
            if (!e.target.closest('#properties-panel-wrapper')) selectClip(null);
            isScrubbing = true;
            const rect = timelineContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineScrollPane.scrollLeft;
            const time = Math.max(0, x / PIXELS_PER_SECOND);
            requestStaticFrameThrottled(time);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isScrubbing) {
            const rect = timelineContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineScrollPane.scrollLeft;
            const time = Math.max(0, x / PIXELS_PER_SECOND);
            requestStaticFrameThrottled(time);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isScrubbing) {
            isScrubbing = false;
            const rect = timelineContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineScrollPane.scrollLeft;
            const time = Math.max(0, x / PIXELS_PER_SECOND);
            requestStaticFrame(time);
        }
    });
    
    
    let isEditingProperty = false;
    propertiesPanelWrapper.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.target.classList.contains('color-wheel')) {
             if (!isEditingProperty) {
                isEditingProperty = true;
                saveState();
            }
        }
    });
    document.addEventListener('mouseup', () => {
        if (isEditingProperty) {
            isEditingProperty = false;
        }
    });

    propertiesPanelWrapper.addEventListener('input', (e) => {
        const propPath = e.target.dataset.prop;
        if (propPath) {
            let value = e.target.value;
            if (e.target.type === 'checkbox') {
                value = e.target.checked;
            } else if (e.target.type === 'number' || e.target.type === 'range') {
                value = parseFloat(e.target.value);
                if (propPath === 'speed') {
                    value = Math.max(1, value) / 100; 
                }
            }
            updateClipProperty(propPath, value);
        }

        const effectProp = e.target.dataset.effectProp;
        if (effectProp) {
            const effectIndex = parseInt(e.target.dataset.effectIndex, 10);
            const bandIndex = e.target.dataset.bandIndex !== undefined ? parseInt(e.target.dataset.bandIndex, 10) : undefined;
            let value = e.target.value;
            if (e.target.type !== 'text') {
                 value = parseFloat(e.target.value);
            }
            updateEffectProperty(effectIndex, effectProp, value, bandIndex);
        }

        invalidatePreview();
        renderInteractiveOverlay();
        requestStaticFrameThrottled(previewTimestamp);
    });
    
    function handleKeyframeButtonClick(e) {
        const propPath = e.target.dataset.keyframeProp;
        if (!propPath || !selectedClipId) return;
        saveState();

        const { clip } = getClip(selectedClipId);
        const prop = getPropertyByPath(clip, propPath);
        
        const existingKeyframeIndex = prop.keyframes.findIndex(kf => Math.abs(kf.time - previewTimestamp) < 0.01);

        if (existingKeyframeIndex > -1) {
            prop.keyframes.splice(existingKeyframeIndex, 1);
        } else {
            prop.keyframes.push({ time: previewTimestamp, value: prop.value });
            prop.keyframes.sort((a,b) => a.time - b.time);
        }
        
        renderAll();
        invalidatePreview();
        requestStaticFrameThrottled(previewTimestamp);
    }

    propertiesPanelWrapper.addEventListener('click', (e) => {
        if (e.target.classList.contains('keyframe-button')) {
            handleKeyframeButtonClick(e);
        }
        const target = e.target.closest('button');
        if (target && target.dataset.effectIndex) {
            saveState();
            invalidatePreview();
            removeEffect(parseInt(target.dataset.effectIndex, 10));
            requestStaticFrameThrottled(previewTimestamp);
        }
    });
    
    trackHeaders.addEventListener('input', e => {
        if(e.target.classList.contains('track-volume-slider') || e.target.classList.contains('pan-slider')) {
            const trackId = e.target.dataset.trackId;
            const track = project.tracks.find(t => t.id === trackId);
            if(track) {
                saveState();
                if (e.target.classList.contains('track-volume-slider')) {
                    track.volume = parseFloat(e.target.value);
                } else {
                    track.pan = parseFloat(e.target.value);
                }
                invalidatePreview();
                requestStaticFrameThrottled(previewTimestamp);
            }
        }
    });
    
    function getPropertyValueAtTime(clip, propPath, time) {
        const prop = getPropertyByPath(clip, propPath);
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
                return prevKf.value + (nextKf.value - prevKf.value) * progress; // Linear interpolation
            }
            prevKf = nextKf;
        }

        return prop.value; // Fallback
    }


    interactiveOverlay.addEventListener('mousedown', (e) => {
        saveState();
        invalidatePreview();
        if (!selectedClipId) return;
        const { clip } = getClip(selectedClipId);
        if (!clip.transform) return;
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;

        const initialClipX = getPropertyValueAtTime(clip, 'transform.x', previewTimestamp);
        const initialClipY = getPropertyValueAtTime(clip, 'transform.y', previewTimestamp);
        const initialScale = getPropertyValueAtTime(clip, 'transform.scale', previewTimestamp);

        const previewRect = previewWindow.getBoundingClientRect();
        const scaleFactor = previewRect.width / project.settings.width;
        const handle = e.target.classList.contains('selection-handle') ? e.target : null;

        function onMouseMove(moveEvent) {
            const dx = (moveEvent.clientX - startX) / scaleFactor;
            const dy = (moveEvent.clientY - startY) / scaleFactor;
            if (handle) {
                
                const newScale = Math.max(0.1, initialScale + (dx / clip.originalWidth));
                updateClipProperty('transform.scale.value', parseFloat(newScale.toFixed(3)));
            } else {
                updateClipProperty('transform.x.value', Math.round(initialClipX + dx));
                updateClipProperty('transform.y.value', Math.round(initialClipY + dy));
            }
            renderPropertiesPanel();
            renderInteractiveOverlay();
            requestStaticFrame(previewTimestamp);
        }
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    
    previewImage.addEventListener('load', () => {
        clearTimeout(scopesUpdateTimeout);
        scopesUpdateTimeout = setTimeout(updateScopes, 100);
    });
    previewVideo.addEventListener('play', () => {
        playPauseButton.disabled = false;
        loadingIcon.classList.add('hidden');
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        playPauseButton.title = 'Pause';
        startPlaybackAnimation();
    });

    previewVideo.addEventListener('pause', () => {
        stopPlaybackAnimation();
        pauseIcon.classList.add('hidden');
        playIcon.classList.remove('hidden');
        loadingIcon.classList.add('hidden');
        playPauseButton.title = 'Play';
    });
    
    previewVideo.addEventListener('canplay', () => {
        if (isVideoPlaybackMode) {
             previewVideo.play();
             previewVideo.playbackRate = jklPlaybackRate;
        }
    });
    
    
    previewVideo.addEventListener('timeupdate', () => {
        if (isVideoPlaybackMode && !isAnimatingPlayhead && !previewVideo.paused) {
             previewTimestamp = currentPreviewSegment.start + previewVideo.currentTime;
             updatePlayheadAndTimeDisplay(previewTimestamp);
        }

        
        if (isVideoPlaybackMode && !previewVideo.seeking) {
            const progress = previewVideo.currentTime / previewVideo.duration;
            if (progress > 0.8 && !previewVideo.dataset.nextSegmentLoading) {
                loadNextVideoSegment();
            }
        }
    });

    async function loadNextVideoSegment() {
        if (previewVideo.dataset.nextSegmentLoading === 'true') return;
        
        previewVideo.dataset.nextSegmentLoading = 'true';
        try {
            const nextSegmentStart = currentPreviewSegment.start + currentPreviewSegment.duration;
            const projectDuration = Math.max(10, ...project.tracks.flatMap(t => t.clips.map(c => c.timelineStart + c.duration)));
            if (nextSegmentStart >= projectDuration) {
                 previewVideo.dataset.nextSegmentUrl = '';
                 return;
            }

            const response = await fetch('/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    project, 
                    timestamp: nextSegmentStart,
                    duration: 30,
                    useProxy: useProxies // <-- Send proxy flag
                })
            });
            const result = await response.json();
            if (result.success && result.previewUrl) {
                previewVideo.dataset.nextSegmentUrl = result.previewUrl;
                previewVideo.dataset.nextSegmentStart = result.timestamp;
                previewVideo.dataset.nextSegmentDuration = result.duration;
            } else {
                 previewVideo.dataset.nextSegmentUrl = '';
            }
        } catch (error) {
            console.error('Failed to preload next segment:', error);
            previewVideo.dataset.nextSegmentUrl = '';
        } finally {
            previewVideo.dataset.nextSegmentLoading = 'false';
        }
    }

    previewVideo.addEventListener('ended', () => {
        if (isVideoPlaybackMode) {
            if (previewVideo.dataset.nextSegmentUrl) {
                currentPreviewSegment = {
                    url: previewVideo.dataset.nextSegmentUrl,
                    start: parseFloat(previewVideo.dataset.nextSegmentStart),
                    duration: parseFloat(previewVideo.dataset.nextSegmentDuration)
                };
                previewVideo.src = previewVideo.dataset.nextSegmentUrl;
                previewVideo.dataset.nextSegmentUrl = '';
            } else {
                switchToStaticPreviewMode();
                requestStaticFrame(previewTimestamp);
            }
        }
    });

    exportButton.addEventListener('click', async () => {
        if (project.tracks.flatMap(t => t.clips).length === 0) return alert('Your timeline is empty!');
        exportButton.disabled = true;
        statusOverlay.classList.remove('hidden');
        downloadLink.classList.add('hidden');
        statusMessage.textContent = 'Sending project to server...';
        statusProgress.style.width = '0%';
        try {
            // IMPORTANT: Final render never uses proxies.
            const response = await fetch('/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project }) // Send original project data
            });
            const result = await response.json();
            if (result.success) {
                pollJobStatus(result.jobId);
            } else {
                throw new Error(result.message || 'Failed to start render job.');
            }
        } catch (error) {
            statusMessage.textContent = `Error: ${error.message}`;
            exportButton.disabled = false;
        }
    });

    function pollJobStatus(jobId) {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/status/${jobId}`);
                const result = await response.json();
                if (!result.success) throw new Error(result.message);
                statusMessage.textContent = result.message;
                statusProgress.style.width = `${result.progress || 0}%`;
                if (result.status === 'complete' || result.status === 'error') {
                    clearInterval(interval);
                    exportButton.disabled = false;
                    if (result.status === 'complete') {
                        downloadLink.href = result.downloadUrl;
                        downloadLink.classList.remove('hidden');
                    }
                }
            } catch (error) {
                clearInterval(interval);
                statusMessage.textContent = `Error checking status: ${error.message}`;
                exportButton.disabled = false;
            }
        }, 2000);
    }
    
    
    timelineContainer.addEventListener('dblclick', (e) => {
         if(!e.target.closest('#marker-track')) return;
        saveState();
        const rect = e.target.closest('#marker-track').getBoundingClientRect();
        const x = e.clientX - rect.left + timelineScrollPane.scrollLeft;
        const time = Math.max(0, x / PIXELS_PER_SECOND);
        const name = prompt("Enter marker name:", "New Marker");
        if (name) {
            project.markers.push({ id: Date.now(), time, name });
            renderAll();
        }
    });

    zoomInButton.addEventListener('click', () => {
        const centerTime = previewTimestamp;
        const oldScroll = timelineScrollPane.scrollLeft;
        const oldOffset = centerTime * PIXELS_PER_SECOND;

        PIXELS_PER_SECOND *= 1.5;
        renderAll();

        const newOffset = centerTime * PIXELS_PER_SECOND;
        timelineScrollPane.scrollLeft = oldScroll + (newOffset - oldOffset);
    });

    zoomOutButton.addEventListener('click', () => {
        const centerTime = previewTimestamp;
        const oldScroll = timelineScrollPane.scrollLeft;
        const oldOffset = centerTime * PIXELS_PER_SECOND;

        PIXELS_PER_SECOND /= 1.5;
        renderAll();
        
        const newOffset = centerTime * PIXELS_PER_SECOND;
        timelineScrollPane.scrollLeft = oldScroll + (newOffset - oldOffset);
    });

    
    let lastThumbnailTimestamp = -1;
    let thumbnailRequestTimer;

    timelineScrollPane.addEventListener('mouseenter', () => {
        timelineThumbnailPreview.classList.remove('hidden');
    });

    timelineScrollPane.addEventListener('mouseleave', () => {
        timelineThumbnailPreview.classList.add('hidden');
    });

    timelineScrollPane.addEventListener('mousemove', e => {
        if(isMaskEditingMode) return;
        const rect = timelineContainer.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineScrollPane.scrollLeft;
        const time = Math.max(0, x / PIXELS_PER_SECOND);
        
        const previewX = e.clientX - timelineScrollPane.getBoundingClientRect().left;
        timelineThumbnailPreview.style.left = `${previewX}px`;
        timelineThumbnailPreview.style.top = `${timelineScrollPane.getBoundingClientRect().height}px`;

        timelineThumbnailTime.textContent = formatTime(time);

        clearTimeout(thumbnailRequestTimer);
        thumbnailRequestTimer = setTimeout(async () => {
            if (Math.abs(time - lastThumbnailTimestamp) < 0.1) return;
            lastThumbnailTimestamp = time;

            try {
                const response = await fetch('/thumbnail', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project, timestamp: time, useProxy: useProxies }) // <-- Send proxy flag
                });
                const result = await response.json();
                if (result.success) {
                    timelineThumbnailImg.src = `${result.thumbnailUrl}?t=${Date.now()}`;
                }
            } catch(error) {
                console.error("Thumbnail request failed:", error);
            }
        }, 100); 
    });


    
    function enterMaskEditingMode() {
        if (!selectedClipId) return;
        isMaskEditingMode = true;

        interactiveOverlay.classList.add('hidden');
        maskControls.classList.remove('hidden');
        maskOverlayCanvas.classList.remove('hidden');

        const { clip } = getClip(selectedClipId);
        const rect = previewContent.getBoundingClientRect();

        maskOverlayCanvas.width = rect.width;
        maskOverlayCanvas.height = rect.height;

        fabricCanvas = new fabric.Canvas('mask-overlay-canvas');
        fabricCanvas.selection = false;

        const scaleX = rect.width / project.settings.width;
        const scaleY = rect.height / project.settings.height;

        if (clip.mask.path && clip.mask.path.length > 0) {
            const scaledPath = clip.mask.path.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
            const polygon = new fabric.Polygon(scaledPath, {
                fill: 'rgba(0, 212, 255, 0.3)',
                stroke: 'rgba(0, 212, 255, 1)',
                strokeWidth: 2,
                objectCaching: false,
                transparentCorners: false,
                cornerColor: 'white',
                cornerStrokeColor: '#00d4ff',
                borderColor: '#00d4ff',
            });
            fabricCanvas.add(polygon);
        }

        fabricCanvas.on('mouse:down', function(options) {
            if (options.target || fabricCanvas.getObjects().length > 0) return;
            const pointer = fabricCanvas.getPointer(options.e);
            const polygon = new fabric.Polygon([{ x: pointer.x, y: pointer.y }], {
                fill: 'rgba(0, 212, 255, 0.3)',
                stroke: 'rgba(0, 212, 255, 1)',
                strokeWidth: 2,
            });
            fabricCanvas.add(polygon);
        });
        
        fabricCanvas.on('object:modified', saveMaskPath);
    }

    function saveMaskPath() {
        if (!fabricCanvas) return;
        const polygon = fabricCanvas.getObjects('polygon')[0];
        if (!polygon) {
            updateClipProperty('mask.path', []);
            updateClipProperty('mask.enabled', false);
            return;
        }

        const rect = previewContent.getBoundingClientRect();
        const scaleX = project.settings.width / rect.width;
        const scaleY = project.settings.height / rect.height;
        
        const path = polygon.points.map(p => ({
            x: p.x * scaleX,
            y: p.y * scaleY
        }));

        updateClipProperty('mask.path', path);
        updateClipProperty('mask.enabled', path.length > 2);
    }

    function exitMaskEditingMode(shouldSave = true) {
        if (!isMaskEditingMode) return;

        if (shouldSave) {
            saveState();
            saveMaskPath();
        }

        isMaskEditingMode = false;
        fabricCanvas.dispose();
        fabricCanvas = null;

        maskControls.classList.add('hidden');
        maskOverlayCanvas.classList.add('hidden');
        renderInteractiveOverlay();
        requestStaticFrame(previewTimestamp);
    }
    finishMaskButton.addEventListener('click', () => exitMaskEditingMode(true));
    clearMaskButton.addEventListener('click', () => {
         if (fabricCanvas) {
            fabricCanvas.clear();
            saveMaskPath();
            exitMaskEditingMode(true);
        }
    });

    
    
    function createColorWheel(name, color, yValue) {
        const {r, g, b} = color;
        const angle = Math.atan2(g - b, r - (g+b)/2) * 180 / Math.PI;
        const radius = Math.sqrt( (r-(g+b)/2)**2 + (g-b)**2 );
        
        return `
            <div class="flex flex-col items-center space-y-2">
                <div class="color-wheel-container">
                    <div class="color-wheel" data-wheel-name="${name}">
                        <div class="color-wheel-handle" style="left: 50%; top: 50%; transform: rotate(${angle}deg) translateX(${radius * 40}px) rotate(${-angle}deg) translate(-50%, -50%); background-color: rgb(${128+r*127}, ${128+g*127}, ${128+b*127});"></div>
                    </div>
                    <input type="range" min="-1" max="1" step="0.01" value="${yValue}" class="color-wheel-y-slider" data-wheel-name="${name}" style="writing-mode: vertical-lr; direction: rtl;">
                </div>
                <span class="capitalize font-semibold">${name}</span>
            </div>
        `;
    }

    function setupColorWheels() {
        document.querySelectorAll('.color-wheel').forEach(wheel => {
            function handleDrag(e) {
                const rect = wheel.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                let angle = Math.atan2(y, x);
                let radius = Math.min(rect.width / 2, Math.sqrt(x*x + y*y)) / (rect.width / 2);

                const r = radius * Math.cos(angle);
                const g = radius * Math.cos(angle - 2 * Math.PI / 3);
                const b = radius * Math.cos(angle - 4 * Math.PI / 3);

                const name = wheel.dataset.wheelName;
                updateClipProperty(`filters.colorWheels.${name}`, {r,g,b});
                requestStaticFrameThrottled(previewTimestamp);
            }
            
            wheel.addEventListener('mousedown', e => {
                handleDrag(e);
                document.addEventListener('mousemove', handleDrag);
                document.addEventListener('mouseup', () => {
                    document.removeEventListener('mousemove', handleDrag);
                }, { once: true });
            });
        });

        document.querySelectorAll('.color-wheel-y-slider').forEach(slider => {
             slider.addEventListener('input', e => {
                 const name = slider.dataset.wheelName;
                 const value = parseFloat(e.target.value);
                 updateClipProperty(`filters.colorWheels.${name}Y`, value);
                 requestStaticFrameThrottled(previewTimestamp);
             });
        });
    }

    
    function updateScopes() {
        const source = isVideoPlaybackMode ? previewVideo : previewImage;
        if (!source || (source.tagName === 'IMG' && !source.complete) || (source.tagName === 'VIDEO' && source.readyState < 2)) return;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        const SCOPE_RES = 128;
        tempCanvas.width = SCOPE_RES;
        tempCanvas.height = Math.round(SCOPE_RES / (source.videoWidth || source.naturalWidth) * (source.videoHeight || source.naturalHeight));
        
        tempCtx.drawImage(source, 0, 0, tempCanvas.width, tempCanvas.height);
        
        try {
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            drawWaveformScope(imageData.data, tempCanvas.width, tempCanvas.height);
            drawVectorscope(imageData.data, tempCanvas.width, tempCanvas.height);
            drawHistogram(imageData.data, tempCanvas.width, tempCanvas.height);
        } catch (e) {
            console.error("Scope Update Failed:", e);
        }
    }
    
    function drawWaveformScope(data, w, h) {
        const canvas = document.getElementById('waveform-canvas');
        canvas.width = 256; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, 256, 128);

        const lumaData = new Uint8ClampedArray(256 * 128).fill(0);

        for(let i=0; i < data.length; i+=4) {
            const r = data[i], g = data[i+1], b = data[i+2];
            const y = 0.299 * r + 0.587 * g + 0.114 * b;
            const x = Math.floor(((i/4) % w) / w * 256);
            const lumaIndex = Math.floor(y / 255 * 127);
            lumaData[x + (127-lumaIndex) * 256]++;
        }

        const imgData = ctx.createImageData(256, 128);
        for(let i=0; i < lumaData.length; i++) {
            const intensity = Math.min(255, lumaData[i] * 20);
            if(intensity > 0) {
                imgData.data[i*4] = 60;
                imgData.data[i*4 + 1] = 200;
                imgData.data[i*4 + 2] = 255;
                imgData.data[i*4 + 3] = intensity;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }
    
    function drawVectorscope(data, w, h) {
        const canvas = document.getElementById('vectorscope-canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, 128, 128);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath(); ctx.arc(64, 64, 42, 0, 2*Math.PI); ctx.stroke();
        
        const scopeData = new Uint8ClampedArray(128*128).fill(0);
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;
            const u = -0.147*r - 0.289*g + 0.436*b;
            const v = 0.615*r - 0.515*g - 0.100*b;
            const x = Math.round(u * 100 + 64);
            const y = Math.round(v * -100 + 64);
            if(x >= 0 && x < 128 && y >= 0 && y < 128) {
                scopeData[x + y * 128]++;
            }
        }
        
        const imgData = ctx.createImageData(128, 128);
        for(let i=0; i < scopeData.length; i++) {
            const intensity = Math.min(255, scopeData[i] * 20);
             if(intensity > 0) {
                imgData.data[i*4] = 60;
                imgData.data[i*4 + 1] = 200;
                imgData.data[i*4 + 2] = 255;
                imgData.data[i*4 + 3] = intensity;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }

    function drawHistogram(data, w, h) {
        const canvas = document.getElementById('histogram-canvas');
        canvas.width = 256; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, 256, 128);

        const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
        for (let i = 0; i < data.length; i += 4) {
            hist[0][data[i]]++;
            hist[1][data[i+1]]++;
            hist[2][data[i+2]]++;
        }

        const max = Math.max(...hist[0], ...hist[1], ...hist[2]);
        const colors = ['rgba(255,0,0,0.7)', 'rgba(0,255,0,0.7)', 'rgba(0,0,255,0.7)'];
        
        ctx.globalCompositeOperation = 'lighter';
        for(let c=0; c<3; c++) {
            ctx.fillStyle = colors[c];
            for(let i=0; i<256; i++) {
                const h = hist[c][i] / max * 128;
                ctx.fillRect(i, 128-h, 1, h);
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    document.querySelectorAll('.scope-tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
             document.querySelectorAll('.scope-tab-button').forEach(b => b.classList.remove('active'));
             btn.classList.add('active');
             document.querySelectorAll('.scope-content').forEach(c => c.classList.add('hidden'));
             document.getElementById(btn.dataset.scope).classList.remove('hidden');
        });
    });

    
    setupTabs();
    populateEffectsBin();
    populateTransitionsBin();
    connectWebSocket();
    updatePreviewAspectRatio();
    previewTimestamp = 0;
    renderAll();
    updatePlayheadAndTimeDisplay(previewTimestamp);
    requestStaticFrame(0);
    
    updateUndoRedoButtons();
});