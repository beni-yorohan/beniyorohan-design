/* jshint esversion: 11 */
/* global frameCount */

// Canvas recorder using MediaRecorder. Records one loop (state.duration
// seconds) at target fps, then hands the blob off to the user as WebM or
// native MP4 (Safari / Chrome 107+). If the browser can't produce MP4
// directly, the download falls back to WebM with a note in the status bar.

let _chunks = [];
let _recorder = null;
let _stopFrame = 0;
let _recordingDotsTimer = null;
let _recordingMime = '';
let _targetExt = 'webm';
let _requestedFormat = 'webm';
let _activeBtn = null;

function pickMimeType(desiredFormat) {
    const mp4Candidates = [
        'video/mp4;codecs=avc1.42001E',
        'video/mp4;codecs=h264',
        'video/mp4'
    ];
    const webmCandidates = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    const ordered = desiredFormat === 'mp4'
        ? [...mp4Candidates, ...webmCandidates]
        : webmCandidates;
    return ordered.find(m => MediaRecorder.isTypeSupported(m)) || null;
}

function startMatosRecording(desiredFormat = 'mp4') {
    const canvas = document.querySelector('#canvas-container canvas');
    if (!canvas) {
        window.matosSetStatus('No canvas found.', true);
        return;
    }
    if (!('MediaRecorder' in window)) {
        window.matosSetStatus('MediaRecorder not supported in this browser.', true);
        return;
    }

    const state = window.matosState;
    const targetFps = 60;
    const durationSec = Math.max(1, state.duration);

    const selected = pickMimeType(desiredFormat);
    if (!selected) {
        window.matosSetStatus('Recording format not supported.', true);
        return;
    }
    _recordingMime = selected;
    _targetExt = selected.startsWith('video/mp4') ? 'mp4' : 'webm';
    _requestedFormat = desiredFormat;

    const stream = canvas.captureStream(targetFps);
    _chunks = [];

    _recorder = new MediaRecorder(stream, {
        mimeType: selected,
        videoBitsPerSecond: 50_000_000
    });
    _recorder.ondataavailable = e => { if (e.data.size) _chunks.push(e.data); };
    _recorder.onstop = onRecorderStop;
    _recorder.start();

    window._matosRecording = true;
    _stopFrame = frameCount + Math.round(durationSec * targetFps);

    _activeBtn = document.getElementById(desiredFormat === 'mp4' ? 'export-mp4' : 'export-webm');
    if (_activeBtn) {
        if (!_activeBtn.dataset.restoreLabel) _activeBtn.dataset.restoreLabel = _activeBtn.textContent;
        _activeBtn.classList.add('recording');
        let dots = 0;
        _recordingDotsTimer = setInterval(() => {
            dots = (dots + 1) % 4;
            _activeBtn.textContent = 'Stop • Rec' + '.'.repeat(dots);
        }, 400);
    }

    const fallbackNote = desiredFormat === 'mp4' && _targetExt === 'webm'
        ? ' — native MP4 unsupported; will save as WebM'
        : '';
    window.matosSetStatus(`Recording ${durationSec.toFixed(1)}s @ ${targetFps}fps (${_targetExt.toUpperCase()})${fallbackNote}…`);

    window._matosAutoStop = requestAnimationFrame(watchAutoStop);
}

function watchAutoStop() {
    if (!window._matosRecording) return;
    if (frameCount >= _stopFrame) {
        stopMatosRecording();
        return;
    }
    window._matosAutoStop = requestAnimationFrame(watchAutoStop);
}

function stopMatosRecording() {
    if (_recorder && _recorder.state === 'recording') _recorder.stop();
    window._matosRecording = false;
    if (_activeBtn) {
        _activeBtn.classList.remove('recording');
        if (_activeBtn.dataset.restoreLabel) {
            _activeBtn.textContent = _activeBtn.dataset.restoreLabel;
        }
    }
    if (_recordingDotsTimer) {
        clearInterval(_recordingDotsTimer);
        _recordingDotsTimer = null;
    }
}

function onRecorderStop() {
    const blob = new Blob(_chunks, { type: _recordingMime });
    const name = `matos_${window.matosTimestamp()}.${_targetExt}`;
    window.matosSaveBlob(blob, name);
    const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
    const fallback = _requestedFormat === 'mp4' && _targetExt === 'webm'
        ? ' (WebM — your browser does not support native MP4 recording)'
        : '';
    window.matosSetStatus(`Saved ${name} · ${sizeMB} MB${fallback}.`);
    _chunks = [];
    _recorder = null;
}

window.startMatosRecording = startMatosRecording;
window.stopMatosRecording = stopMatosRecording;
