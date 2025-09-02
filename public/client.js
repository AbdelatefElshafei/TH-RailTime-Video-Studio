

document.addEventListener('DOMContentLoaded', () => {
    
    
    
    let project = {
        tracks: [
            { id: `video-${Date.now()}`, type: 'video', clips: [] },
            { id: `audio-${Date.now()}`, type: 'audio', clips: [] },
            { id: 'text-track', type: 'text', clips: [] }
        ]
    };
    let selectedClipId = null;
    let mediaBinFiles = [];
    const PIXELS_PER_SECOND = 60;
    const RENDER_WIDTH = 1280;

    
    let ws;
    let previewTimestamp = 0;
    let isScrubbing = false;
    let previewRequestTimeout;
    let isVideoPlaybackMode = false;
    let currentPreviewSegment = { url: null, start: -1, duration: -1 };

    
    
    
    const importButton = document.getElementById('import-button');
    const fileInput = document.getElementById('file-input');
    const mediaBin = document.getElementById('media-bin');
    const timelineContainer = document.getElementById('timeline-container');
    const propertiesPanel = document.getElementById('properties-panel');
    const propertiesContent = document.getElementById('properties-content');
    const deleteClipButton = document.getElementById('delete-clip-button');
    const previewWindow = document.getElementById('preview-window');
    const previewImage = document.getElementById('preview-image');
    const previewVideo = document.getElementById('preview-video');
    const interactiveOverlay = document.getElementById('interactive-overlay');
    const selectionBox = document.getElementById('selection-box');
    const playhead = document.getElementById('playhead');
    const exportButton = document.getElementById('export-button');
    const addVideoTrackButton = document.getElementById('add-video-track-button');
    const addAudioTrackButton = document.getElementById('add-audio-track-button');
    const addTextClipButton = document.getElementById('add-text-clip-button');
    const statusOverlay = document.getElementById('status-overlay');
    const statusMessage = document.getElementById('status-message');
    const statusProgress = document.getElementById('status-progress');
    const downloadLink = document.getElementById('download-link');
    const playPauseButton = document.getElementById('play-pause-button');
    const stopButton = document.getElementById('stop-button');
    const timeDisplay = document.getElementById('time-display');
    
    
    
    
    
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
                sessionId: 'static_' + Date.now()
            }));
        }
    }
    
    function requestStaticFrameThrottled(timestamp) {
        updatePlayheadAndTimeDisplay(timestamp);
        clearTimeout(previewRequestTimeout);
        previewRequestTimeout = setTimeout(() => requestStaticFrame(timestamp), 250);
    }

    async function requestVideoSegment(timestamp) {
        if (!isVideoPlaybackMode) await switchToVideoPreviewMode();
        playPauseButton.textContent = 'Loading...';
        playPauseButton.disabled = true;

        try {
            const response = await fetch('/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project, timestamp })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || 'Server failed to generate preview.');

            currentPreviewSegment = { url: result.previewUrl, start: result.timestamp, duration: result.duration };
            previewVideo.src = result.previewUrl;
            
        } catch(error) {
            console.error("Failed to fetch preview video:", error);
            await switchToStaticPreviewMode(); 
        }
    }
    
    function handlePlayPause() {
        if (isVideoPlaybackMode) {
            if (previewVideo.paused) {
                previewVideo.play();
                playPauseButton.textContent = 'Pause';
            } else {
                previewVideo.pause();
                playPauseButton.textContent = 'Play';
            }
        } else {
            requestVideoSegment(previewTimestamp);
        }
    }

    async function stopPlayback() {
        await switchToStaticPreviewMode();
        await requestStaticFrame(0);
    }
    
    async function switchToVideoPreviewMode() {
        isVideoPlaybackMode = true;
        previewImage.classList.add('hidden');
        previewVideo.classList.remove('hidden');
        interactiveOverlay.classList.add('hidden');
    }

    async function switchToStaticPreviewMode() {
        previewVideo.pause();
        if (isVideoPlaybackMode) { 
            previewTimestamp = currentPreviewSegment.start + previewVideo.currentTime;
        }
        isVideoPlaybackMode = false;
        playPauseButton.textContent = 'Play';
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
    }

    
    
    
    function renderAll() {
        renderTracks();
        renderTimelineClips();
        renderPropertiesPanel();
        renderMediaBin();
        renderInteractiveOverlay();
    }

    function renderTracks() {
        const trackElements = timelineContainer.querySelectorAll('.track');
        trackElements.forEach(t => t.remove());
        project.tracks.filter(t => t.type !== 'text').forEach((track, index) => {
            const trackEl = document.createElement('div');
            trackEl.id = track.id;
            trackEl.dataset.trackType = track.type;
            trackEl.className = 'track h-16 bg-gray-600 rounded relative mb-2';
            const trackLabel = document.createElement('span');
            trackLabel.className = 'absolute top-1 left-2 text-xs text-gray-400 font-semibold uppercase';
            trackLabel.textContent = `${track.type} Track ${index + 1}`;
            trackEl.appendChild(trackLabel);
            timelineContainer.appendChild(trackEl);
        });
    }

    function renderTimelineClips() {
        timelineContainer.querySelectorAll('.clip').forEach(el => el.remove());
        project.tracks.forEach(track => {
            const trackEl = document.getElementById(track.id);
            if (!trackEl) return;
            track.clips.forEach(clip => {
                const clipEl = document.createElement('div');
                clipEl.className = `clip ${clip.type}-clip ${selectedClipId === clip.id ? 'selected' : ''}`;
                clipEl.style.left = `${clip.timelineStart * PIXELS_PER_SECOND}px`;
                clipEl.style.width = `${clip.duration * PIXELS_PER_SECOND}px`;
                clipEl.dataset.id = clip.id;
                clipEl.textContent = clip.displayName || clip.src || clip.text;
                if (selectedClipId === clip.id) {
                    const leftHandle = document.createElement('div');
                    leftHandle.className = 'resize-handle left';
                    const rightHandle = document.createElement('div');
                    rightHandle.className = 'resize-handle right';
                    clipEl.appendChild(leftHandle);
                    clipEl.appendChild(rightHandle);
                }
                trackEl.appendChild(clipEl);
            });
        });
    }
    
    function renderPropertiesPanel() {
        if (!selectedClipId) {
            propertiesPanel.classList.add('hidden');
            return;
        }
        const { clip } = getClip(selectedClipId);
        if (!clip) return;
        let content = `<div class="font-bold text-sm mb-2">${clip.displayName}</div>`;
        content += `<fieldset class="border border-gray-600 p-2 rounded"><legend class="text-xs px-1">Timing</legend><div class="grid grid-cols-2 gap-2 text-sm">
                        <label>Start</label><input class="bg-gray-700 p-1 rounded w-full" type="number" step="0.1" data-prop="timelineStart" value="${clip.timelineStart.toFixed(2)}">
                        <label>Duration</label><input class="bg-gray-700 p-1 rounded w-full" type="number" step="0.1" data-prop="duration" value="${clip.duration.toFixed(2)}">
                    </div></fieldset>`;
        if (clip.type === 'video' || clip.type === 'text') {
            content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Transform</legend><div class="grid grid-cols-2 gap-2 text-sm">
                           <label>X</label><input class="bg-gray-700 p-1 rounded w-full" type="number" data-prop="transform.x" value="${Math.round(clip.transform.x)}">
                           <label>Y</label><input class="bg-gray-700 p-1 rounded w-full" type="number" data-prop="transform.y" value="${Math.round(clip.transform.y)}">
                        </div>`;
            if (clip.type === 'video') {
                content += `<div class="text-sm mt-2"><label>Scale</label><input class="w-full" type="range" min="0.1" max="2" step="0.01" data-prop="transform.scale" value="${clip.transform.scale.toFixed(2)}"></div>`;
            }
            content += `</fieldset>`;
        }
        if (clip.type === 'video') {
            content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Effects</legend>
                        <div class="text-sm"><label>Opacity</label><input class="w-full" type="range" min="0" max="1" step="0.01" data-prop="opacity" value="${clip.opacity.toFixed(2)}"></div>
                        <div class="grid grid-cols-3 gap-2 mt-2 text-sm">
                            <div><label>Grayscale</label><input class="ml-1" type="checkbox" data-prop="filters.grayscale" ${clip.filters.grayscale ? 'checked' : ''}></div>
                            <div><label>Sepia</label><input class="ml-1" type="checkbox" data-prop="filters.sepia" ${clip.filters.sepia ? 'checked' : ''}></div>
                            <div><label>Invert</label><input class="ml-1" type="checkbox" data-prop="filters.invert" ${clip.filters.invert ? 'checked' : ''}></div>
                        </div></fieldset>`;
        }
        if (clip.type === 'audio') {
             content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Audio</legend>
                         <div class="text-sm"><label>Volume</label><input class="w-full" type="range" min="0" max="2" step="0.01" data-prop="volume" value="${clip.volume.toFixed(2)}"></div></fieldset>`;
        }
        if (clip.type === 'text') {
            content += `<fieldset class="border border-gray-600 p-2 rounded mt-4"><legend class="text-xs px-1">Text</legend>
                        <div class="space-y-2 text-sm">
                           <div><label>Content</label><input class="bg-gray-700 p-1 rounded w-full" type="text" data-prop="text" value="${clip.text}"></div>
                           <div><label>Font Size</label><input class="bg-gray-700 p-1 rounded w-full" type="number" data-prop="fontSize" value="${clip.fontSize}"></div>
                           <div><label>Color</label><input class="bg-gray-700 p-1 rounded w-full" type="color" data-prop="fontColor" value="${clip.fontColor}"></div>
                        </div></fieldset>`;
        }
        propertiesContent.innerHTML = content;
        propertiesPanel.classList.remove('hidden');
    }
    
    function renderMediaBin() {
        mediaBin.innerHTML = '';
        mediaBinFiles.forEach(file => {
            const el = document.createElement('div');
            el.className = 'media-item p-2 rounded bg-gray-900 cursor-grab';
            el.textContent = file.originalName.length > 25 ? file.originalName.substring(0, 22) + '...' : file.originalName;
            el.draggable = true;
            el.dataset.src = file.filename;
            el.dataset.type = file.type;
            el.dataset.displayName = file.originalName;
            mediaBin.appendChild(el);
        });
    }

    function renderInteractiveOverlay() {
        if (!selectedClipId || isVideoPlaybackMode) {
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
        const scaleFactor = previewRect.width / RENDER_WIDTH;
        let width, height, x, y;
        if (clip.type === 'video') {
            width = (RENDER_WIDTH * clip.transform.scale) * scaleFactor;
            height = width * (9/16);
            x = clip.transform.x * scaleFactor;
            y = clip.transform.y * scaleFactor;
        } else {
            width = (clip.fontSize * clip.text.length * 0.55) * scaleFactor;
            height = (clip.fontSize * 1.2) * scaleFactor;
            x = clip.transform.x * scaleFactor;
            y = clip.transform.y * scaleFactor;
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
        return null;
    }

    function selectClip(clipId) {
        if (selectedClipId === clipId) return;
        invalidatePreview();
        selectedClipId = clipId;
        renderTimelineClips();
        renderPropertiesPanel();
        if (clipId) {
            const { clip } = getClip(clipId);
            requestStaticFrame(clip.timelineStart);
            renderInteractiveOverlay();
        } else {
            interactiveOverlay.classList.add('hidden');
        }
    }

    function updateClipProperty(propPath, value) {
        if (!selectedClipId) return;
        const { clip } = getClip(selectedClipId);
        const props = propPath.split('.');
        let current = clip;
        for (let i = 0; i < props.length - 1; i++) current = current[props[i]];
        current[props[props.length - 1]] = value;
        renderTimelineClips();
    }

    function deleteClip(clipId) {
        if (!clipId) return;
        project.tracks.forEach(track => {
            track.clips = track.clips.filter(c => c.id !== clipId);
        });
        selectClip(null);
    }
    
    
    
    
    playPauseButton.addEventListener('click', handlePlayPause);
    stopButton.addEventListener('click', stopPlayback);
    
    importButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        for (const file of fileInput.files) {
            const formData = new FormData();
            formData.append('media', file);
            const response = await fetch('/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if(result.success) {
                mediaBinFiles.push({ filename: result.filename, originalName: result.originalName, type: file.type.split('/')[0] });
            }
        }
        renderMediaBin();
    });

    addVideoTrackButton.addEventListener('click', () => { invalidatePreview(); project.tracks.push({ id: `video-${Date.now()}`, type: 'video', clips: [] }); renderTracks(); });
    addAudioTrackButton.addEventListener('click', () => { invalidatePreview(); project.tracks.push({ id: `audio-${Date.now()}`, type: 'audio', clips: [] }); renderTracks(); });
    addTextClipButton.addEventListener('click', () => {
        invalidatePreview();
        const newClip = {
            id: Date.now(), type: 'text', displayName: 'New Text', text: 'New Text', timelineStart: previewTimestamp, duration: 5,
            fontSize: 48, fontColor: '#FFFFFF', 
            transform: { x: (RENDER_WIDTH / 2) - 100, y: (720 / 2) - 50, scale: 1 }
        };
        project.tracks.find(t => t.type === 'text').clips.push(newClip);
        selectClip(newClip.id);
    });
    deleteClipButton.addEventListener('click', () => { invalidatePreview(); deleteClip(selectedClipId); });

    mediaBin.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('media-item')) {
            e.dataTransfer.setData('application/json', JSON.stringify({ 
                src: e.target.dataset.src, type: e.target.dataset.type, displayName: e.target.dataset.displayName
            }));
        }
    });

    timelineContainer.addEventListener('dragover', (e) => e.preventDefault());
    timelineContainer.addEventListener('drop', (e) => {
        invalidatePreview();
        e.preventDefault();
        const trackEl = e.target.closest('.track');
        if (!trackEl) return;
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const trackType = trackEl.dataset.trackType;
        if (data.type !== trackType) return alert(`Cannot place a ${data.type} clip on a ${trackType} track.`);
        const rect = trackEl.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineContainer.scrollLeft;
        const timelineStart = Math.max(0, x / PIXELS_PER_SECOND);
        const newClip = {
            id: Date.now(), src: data.src, displayName: data.displayName, type: data.type, timelineStart: parseFloat(timelineStart.toFixed(2)),
            start: 0, duration: 5, volume: 1, opacity: 1,
            transform: { x: 0, y: 0, scale: 1 },
            filters: { grayscale: false, sepia: false, invert: false }
        };
        project.tracks.find(t => t.id === trackEl.id).clips.push(newClip);
        selectClip(newClip.id);
    });

    timelineContainer.addEventListener('mousedown', (e) => {
        invalidatePreview();
        const clipEl = e.target.closest('.clip');
        if (clipEl) {
            const clipId = parseInt(clipEl.dataset.id);
            selectClip(clipId);
            e.preventDefault();
            const { clip } = getClip(clipId);
            const startX = e.clientX;
            const initialLeft = clip.timelineStart;
            const initialDuration = clip.duration;
            const handle = e.target.classList.contains('resize-handle') ? (e.target.classList.contains('left') ? 'left' : 'right') : null;
            function onMouseMove(moveEvent) {
                invalidatePreview();
                const dx = (moveEvent.clientX - startX) / PIXELS_PER_SECOND;
                if (handle === 'left') {
                    const newStart = Math.max(0, initialLeft + dx);
                    const newDuration = Math.max(0.5, initialDuration - (newStart - initialLeft));
                    clip.timelineStart = parseFloat(newStart.toFixed(2));
                    clip.duration = parseFloat(newDuration.toFixed(2));
                } else if (handle === 'right') {
                    clip.duration = Math.max(0.5, initialDuration + dx);
                } else {
                    clip.timelineStart = Math.max(0, initialLeft + dx);
                }
                renderTimelineClips();
                renderPropertiesPanel();
                requestStaticFrameThrottled(clip.timelineStart);
            }
            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        } else {
            if (!e.target.closest('#properties-panel')) selectClip(null);
            isScrubbing = true;
            const rect = timelineContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineContainer.scrollLeft;
            const time = Math.max(0, x / PIXELS_PER_SECOND);
            requestStaticFrameThrottled(time);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isScrubbing) {
            const rect = timelineContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineContainer.scrollLeft;
            const time = Math.max(0, x / PIXELS_PER_SECOND);
            requestStaticFrameThrottled(time);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isScrubbing) {
            isScrubbing = false;
            const rect = timelineContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineContainer.scrollLeft;
            const time = Math.max(0, x / PIXELS_PER_SECOND);
            requestStaticFrame(time);
        }
    });
    
    propertiesPanel.addEventListener('input', (e) => {
        const propPath = e.target.dataset.prop;
        if (!propPath) return;
        let value = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' || e.target.type === 'range') ? parseFloat(e.target.value) : e.target.value;
        invalidatePreview();
        updateClipProperty(propPath, value);
        renderInteractiveOverlay();
        requestStaticFrameThrottled(previewTimestamp);
    });

    interactiveOverlay.addEventListener('mousedown', (e) => {
        invalidatePreview();
        if (!selectedClipId) return;
        const { clip } = getClip(selectedClipId);
        if (!clip.transform) return;
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const initialClipX = clip.transform.x;
        const initialClipY = clip.transform.y;
        const initialScale = clip.transform.scale;
        const previewRect = previewWindow.getBoundingClientRect();
        const scaleFactor = previewRect.width / RENDER_WIDTH;
        const handle = e.target.classList.contains('selection-handle') ? e.target : null;
        function onMouseMove(moveEvent) {
            const dx = (moveEvent.clientX - startX) / scaleFactor;
            const dy = (moveEvent.clientY - startY) / scaleFactor;
            if (handle) {
                const newScale = Math.max(0.1, initialScale + (dx / RENDER_WIDTH));
                updateClipProperty('transform.scale', parseFloat(newScale.toFixed(3)));
            } else {
                updateClipProperty('transform.x', Math.round(initialClipX + dx));
                updateClipProperty('transform.y', Math.round(initialClipY + dy));
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

    previewVideo.addEventListener('timeupdate', () => {
        if (isVideoPlaybackMode) {
            previewTimestamp = currentPreviewSegment.start + previewVideo.currentTime;
            updatePlayheadAndTimeDisplay(previewTimestamp);
        }
    });

    previewVideo.addEventListener('ended', () => {
        if (isVideoPlaybackMode) {
            const nextSegmentStart = currentPreviewSegment.start + currentPreviewSegment.duration;
            requestVideoSegment(nextSegmentStart);
        }
    });

    previewVideo.addEventListener('canplay', () => {
        if (isVideoPlaybackMode) {
            previewVideo.play();
            playPauseButton.textContent = 'Pause';
            playPauseButton.disabled = false;
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
            const response = await fetch('/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project })
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

    connectWebSocket();
    renderAll();
    requestStaticFrame(0);
});