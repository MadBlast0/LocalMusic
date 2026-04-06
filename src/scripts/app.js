// Music Downloader App - Frontend Logic

// State
let tracks = [];
let playlists = [];
let currentType = null;
let maxConcurrency = parseInt(localStorage.getItem('maxConcurrency')) || 2;
let activeDownloads = 0;
let downloadQueue = [];
let previewAudio = null;
let currentPreviewIndex = -1;
let isDownloadingAll = false;
let cancelAllRequested = false;

// DOM Elements
const urlInput = document.getElementById('urlInput');
const fetchBtn = document.getElementById('fetchBtn');
const trackList = document.getElementById('trackList');
const emptyState = document.getElementById('emptyState');
const resultsSection = document.getElementById('resultsSection');
const resultsCount = document.getElementById('resultsCount');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const errorAlert = document.getElementById('errorAlert');
const errorText = document.getElementById('errorText');
const importFilesBtn = document.getElementById('importFilesBtn');
const fileInput = document.getElementById('fileInput');

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    const isAlreadyActive = btn.classList.contains('active');
    
    // Only switch if not already on this page
    if (!isAlreadyActive) {
      switchPage(page);
    }
  });
});

// Donate Button
const donateBtn = document.getElementById('donateBtn');
donateBtn.addEventListener('click', async () => {
  try {
    // Open the local donate.html file in the default browser
    await window.musicAPI.openDonateFile();
  } catch (error) {
    showError('Failed to open donation page');
    console.error('Failed to open donate page:', error);
  }
});

function switchPage(page) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  
  // Refresh page content when switching
  refreshPageContent(page);
}

function refreshPageContent(page) {
  switch(page) {
    case 'library':
      // Refresh library
      if (window.loadLibrary) {
        window.loadLibrary();
      }
      break;
      
    case 'downloader':
      // Downloader doesn't need refresh - it's already loaded
      break;
      
    case 'settings':
      // Refresh settings
      loadSettings();
      checkDependencies();
      loadCacheStats();
      break;
  }
}

// File Import
importFilesBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

async function handleFiles(files) {
  const fileArray = Array.from(files);
  const validFiles = fileArray.filter(f => 
    f.name.endsWith('.csv') || 
    f.name.endsWith('.txt') || 
    f.name.endsWith('.json')
  );
  
  if (validFiles.length === 0) {
    showError('Please select CSV, TXT, or JSON files');
    return;
  }
  
  for (const file of validFiles) {
    try {
      const content = await readFile(file);
      const parsedTracks = parseFile(content, file.name);
      
      if (parsedTracks.length > 0) {
        playlists.push({
          name: file.name.replace(/\.(csv|txt|json)$/i, ''),
          tracks: parsedTracks
        });
        
        // Add tracks to main list
        tracks.push(...parsedTracks);
      }
    } catch (e) {
      showError(`Failed to parse ${file.name}: ${e.message}`);
    }
  }
  
  if (tracks.length > 0) {
    displayTracks();
    emptyState.style.display = 'none';
    resultsSection.style.display = 'flex';
    resultsCount.innerHTML = `<span style="color: var(--accent)">${tracks.length}</span> track${tracks.length !== 1 ? 's' : ''} from ${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`;
  }
  
  fileInput.value = '';
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function parseFile(content, filename) {
  const trimmedContent = content.trim();
  
  if (!trimmedContent) {
    throw new Error('File is empty');
  }
  
  let format = null;
  
  if (filename.endsWith('.json')) {
    format = 'json';
  } else if (filename.endsWith('.csv')) {
    format = 'csv';
  } else if (filename.endsWith('.txt')) {
    format = 'txt';
  } else {
    if (trimmedContent.startsWith('[') || trimmedContent.startsWith('{')) {
      format = 'json';
    } else if (trimmedContent.includes(',')) {
      format = 'csv';
    } else {
      format = 'txt';
    }
  }
  
  try {
    switch (format) {
      case 'json':
        return parseJSON(trimmedContent);
      case 'csv':
        return parseCSV(trimmedContent.split('\n').map(l => l.trim()).filter(Boolean));
      case 'txt':
        return parseTXT(trimmedContent.split('\n').map(l => l.trim()).filter(Boolean));
      default:
        throw new Error('Unknown file format');
    }
  } catch (e) {
    throw new Error(`Parse error: ${e.message}`);
  }
}

function parseJSON(content) {
  const data = JSON.parse(content);
  const tracks = [];
  
  if (Array.isArray(data)) {
    for (const item of data) {
      const track = normalizeTrack(item);
      if (track) tracks.push(track);
    }
  } else if (data.tracks && Array.isArray(data.tracks)) {
    for (const item of data.tracks) {
      const track = normalizeTrack(item);
      if (track) tracks.push(track);
    }
  } else if (data.name || data.title || data.track) {
    const track = normalizeTrack(data);
    if (track) tracks.push(track);
  }
  
  if (tracks.length === 0) {
    throw new Error('No valid tracks found in JSON');
  }
  
  return tracks;
}

function normalizeTrack(item) {
  if (!item || typeof item !== 'object') return null;
  
  const name = item.name || item.title || item.track || item.song || item.trackName || '';
  if (!name) return null;
  
  const artist = item.artist || item.artists || item.artistName || item.by || '';
  
  let duration = null;
  if (item.duration) {
    duration = parseInt(item.duration);
  } else if (item.duration_ms) {
    duration = Math.round(parseInt(item.duration_ms) / 1000);
  } else if (item.durationMs) {
    duration = Math.round(parseInt(item.durationMs) / 1000);
  } else if (item.length) {
    duration = parseInt(item.length);
  }
  
  return {
    name: String(name).trim(),
    artist: String(artist).trim(),
    duration: duration && !isNaN(duration) ? duration : null,
    id: String(Math.random())
  };
}

function parseCSV(lines) {
  const tracks = [];
  let hasHeader = false;
  
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes('track') || firstLine.includes('name') || firstLine.includes('song') || firstLine.includes('title')) {
    hasHeader = true;
    lines = lines.slice(1);
  }
  
  for (const line of lines) {
    if (!line) continue;
    
    const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
    
    if (parts.length >= 1 && parts[0]) {
      const track = {
        name: parts[0].trim(),
        artist: parts[1]?.trim() || '',
        duration: parts[2] ? parseInt(parts[2]) : null,
        id: String(Math.random())
      };
      
      if (track.duration && isNaN(track.duration)) {
        track.duration = null;
      }
      
      tracks.push(track);
    }
  }
  
  if (tracks.length === 0) {
    throw new Error('No valid tracks found in CSV');
  }
  
  return tracks;
}

function parseTXT(lines) {
  const tracks = [];
  
  for (const line of lines) {
    if (!line) continue;
    
    let name = line;
    let artist = '';
    
    const separators = [' - ', ' – ', ' | ', ' / ', ' : '];
    for (const sep of separators) {
      if (line.includes(sep)) {
        const parts = line.split(sep);
        if (parts.length >= 2) {
          artist = parts[0].trim();
          name = parts[1].trim();
          break;
        }
      }
    }
    
    if (name) {
      tracks.push({
        name,
        artist,
        duration: null,
        id: String(Math.random())
      });
    }
  }
  
  if (tracks.length === 0) {
    throw new Error('No valid tracks found in TXT');
  }
  
  return tracks;
}

// Fetch Tracks
fetchBtn.addEventListener('click', handleFetch);
urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleFetch();
});

async function handleFetch() {
  const url = urlInput.value.trim();
  if (!url) return;

  hideError();
  setLoading(true);

  try {
    const result = await window.musicAPI.fetchTracks(url);
    tracks = result.tracks;
    currentType = result.type;
    
    displayTracks();
    emptyState.style.display = 'none';
    resultsSection.style.display = 'flex';
    resultsCount.innerHTML = `<span style="color: var(--accent)">${tracks.length}</span> track${tracks.length !== 1 ? 's' : ''} found`;
    
  } catch (error) {
    showError(error.message || 'Failed to fetch tracks');
  } finally {
    setLoading(false);
  }
}

async function displayTracks() {
  trackList.innerHTML = '';
  
  // Check all files in parallel
  const fileChecks = await Promise.all(
    tracks.map(track => window.musicAPI.checkFileExists({ track }))
  );
  
  tracks.forEach((track, index) => {
    const item = document.createElement('div');
    item.className = 'track-item';
    item.dataset.index = index;
    
    const durationText = track.duration ? formatDuration(track.duration) : '--:--';
    const fileExists = fileChecks[index];
    
    // Determine initial state
    let itemClass = 'track-item';
    let buttonClass = 'status-badge status-pending';
    let buttonTitle = 'Download';
    let buttonIcon = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;
    
    if (fileExists.exists) {
      // File already downloaded
      itemClass += ' completed';
      buttonClass = 'status-badge status-completed';
      buttonTitle = 'Click to delete downloaded file';
      buttonIcon = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      `;
      item.dataset.filePath = fileExists.path;
    }
    
    item.className = itemClass;
    item.innerHTML = `
      <div class="track-number">${index + 1}</div>
      <div class="track-info">
        <div class="track-name">${escapeHtml(track.name)}</div>
      </div>
      <div class="track-artist">${escapeHtml(track.artist || 'Unknown Artist')}</div>
      <div class="track-duration">${durationText}</div>
      <div class="track-status">
        <button class="${buttonClass}" title="${buttonTitle}">
          ${buttonIcon}
        </button>
      </div>
    `;
    
    trackList.appendChild(item);
    
    // Add event listener to the button
    const button = item.querySelector('.status-badge');
    if (fileExists.exists) {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        window.deleteDownloadedFile(index, fileExists.path);
      });
    } else {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        queueDownload(index);
      });
    }
  });
}

// Preview System
window.togglePreview = async function(index) {
  const track = tracks[index];
  const btn = document.querySelector(`[data-index="${index}"] .btn-preview`);
  
  if (currentPreviewIndex === index && previewAudio && !previewAudio.paused) {
    // Stop current preview
    previewAudio.pause();
    previewAudio.currentTime = 0;
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    `;
    btn.classList.remove('playing');
    currentPreviewIndex = -1;
    return;
  }
  
  // Stop any existing preview
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
    if (currentPreviewIndex >= 0) {
      const oldBtn = document.querySelector(`[data-index="${currentPreviewIndex}"] .btn-preview`);
      if (oldBtn) {
        oldBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        `;
        oldBtn.classList.remove('playing');
      }
    }
  }
  
  // Start new preview
  try {
    const previewUrl = await window.musicAPI.getPreviewUrl(track);
    if (!previewUrl) {
      showError('No preview available for this track');
      return;
    }
    
    if (!previewAudio) {
      previewAudio = new Audio();
    }
    
    previewAudio.src = previewUrl;
    previewAudio.currentTime = 0;
    
    // Update UI during playback
    previewAudio.addEventListener('timeupdate', () => {
      if (currentPreviewIndex === index) {
        const progress = Math.min((previewAudio.currentTime / 30) * 100, 100);
        const fill = document.getElementById(`preview-fill-${index}`);
        if (fill) fill.style.width = `${progress}%`;
        
        // Stop at 30 seconds
        if (previewAudio.currentTime >= 30) {
          previewAudio.pause();
          previewAudio.currentTime = 0;
          btn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          `;
          btn.classList.remove('playing');
          currentPreviewIndex = -1;
        }
      }
    });
    
    previewAudio.addEventListener('ended', () => {
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      `;
      btn.classList.remove('playing');
      currentPreviewIndex = -1;
    });
    
    await previewAudio.play();
    currentPreviewIndex = index;
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
    `;
    btn.classList.add('playing');
    
  } catch (error) {
    showError('Failed to play preview');
  }
};

window.seekPreview = function(event, index) {
  if (currentPreviewIndex !== index || !previewAudio) return;
  
  const seekBar = event.currentTarget;
  const rect = seekBar.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  previewAudio.currentTime = percent * 30;
};

// Download Queue System
window.queueDownload = function(index) {
  const item = document.querySelector(`[data-index="${index}"]`);
  
  // Prevent queueing if already downloading, completed, or in queue
  if (!item) {
    console.warn(`Track item ${index} not found`);
    return;
  }
  
  if (item.classList.contains('downloading')) {
    console.log(`Track ${index} is already downloading`);
    return;
  }
  
  if (item.classList.contains('completed')) {
    console.log(`Track ${index} is already completed`);
    return;
  }
  
  if (downloadQueue.includes(index)) {
    console.log(`Track ${index} is already in queue`);
    return;
  }
  
  console.log(`Queueing track ${index} for download`);
  downloadQueue.push(index);
  updateTrackStatus(index, 'queued');
  processQueue();
};

async function processQueue() {
  while (downloadQueue.length > 0 && activeDownloads < maxConcurrency && !cancelAllRequested) {
    const index = downloadQueue.shift();
    // Don't await - let downloads run concurrently
    downloadTrack(index);
  }
  
  // If cancel was requested, clear remaining queue
  if (cancelAllRequested) {
    downloadQueue.length = 0;
  }
}

async function downloadTrack(index) {
  const track = tracks[index];
  const item = document.querySelector(`[data-index="${index}"]`);
  const badge = item.querySelector('.status-badge');
  
  activeDownloads++;
  
  badge.className = 'status-badge status-downloading';
  badge.title = 'Downloading';
  badge.onclick = null;
  badge.innerHTML = `
    <svg class="circular-progress" width="24" height="24" viewBox="0 0 20 20">
      <circle class="circular-progress-bg" cx="10" cy="10" r="9"/>
      <circle class="circular-progress-fill" cx="10" cy="10" r="9" id="progress-circle-${index}"/>
    </svg>
  `;
  item.classList.add('downloading');
  
  try {
    const result = await window.musicAPI.downloadTrack({ track, trackIndex: index });
    
    console.log(`Download completed for track ${index}:`, result.path);
    
    // Change to delete button after successful download
    badge.className = 'status-badge status-completed';
    badge.title = 'Click to delete downloaded file';
    badge.onclick = (e) => {
      e.stopPropagation();
      console.log('Delete button clicked for track', index);
      deleteDownloadedFile(index, result.path);
    };
    badge.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    `;
    item.classList.remove('downloading');
    item.classList.add('completed');
    item.dataset.filePath = result.path;
    
    console.log('Track item classes:', item.className);
  } catch (error) {
    console.error(`Download failed for track ${index}:`, error);
    badge.className = 'status-badge status-failed';
    badge.title = 'Failed - Click to retry';
    badge.onclick = () => queueDownload(index);
    badge.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    `;
    item.classList.remove('downloading');
    item.classList.add('failed');
    showError(`Failed to download "${track.name}": ${error.message}`);
  } finally {
    activeDownloads--;
    processQueue();
  }
}

// Custom Confirmation Dialog
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.style.display = 'flex';
    
    const handleOk = () => {
      modal.style.display = 'none';
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      resolve(true);
    };
    
    const handleCancel = () => {
      modal.style.display = 'none';
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      resolve(false);
    };
    
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    });
  });
}

// Delete downloaded file
window.deleteDownloadedFile = async function(index, filePath) {
  const track = tracks[index];
  
  const confirmed = await showConfirmDialog(
    'Delete Downloaded File',
    `Are you sure you want to delete "${track.name}" from your computer? This action cannot be undone.`
  );
  
  if (!confirmed) {
    return;
  }
  
  try {
    await window.musicAPI.deleteSong(filePath);
    
    // Reset to download button
    const item = document.querySelector(`[data-index="${index}"]`);
    const badge = item.querySelector('.status-badge');
    
    badge.className = 'status-badge status-pending';
    badge.title = 'Download';
    badge.onclick = null;
    
    // Re-attach event listener
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      queueDownload(index);
    });
    
    badge.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;
    item.classList.remove('completed');
    delete item.dataset.filePath;
  } catch (error) {
    showError(`Failed to delete file: ${error.message}`);
  }
};

function updateTrackStatus(index, status) {
  const item = document.querySelector(`[data-index="${index}"]`);
  const badge = item.querySelector('.status-badge');
  
  if (status === 'queued') {
    badge.className = 'status-badge status-downloading';
    badge.title = 'Queued';
    badge.onclick = null;
    badge.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    `;
  }
}

// Delete Track
window.deleteTrack = function(index) {
  if (confirm('Remove this track from the list?')) {
    tracks.splice(index, 1);
    displayTracks();
    resultsCount.innerHTML = `<span style="color: var(--accent)">${tracks.length}</span> track${tracks.length !== 1 ? 's' : ''} found`;
    
    if (tracks.length === 0) {
      emptyState.style.display = 'flex';
      resultsSection.style.display = 'none';
    }
  }
};

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Download All / Cancel All
downloadAllBtn.addEventListener('click', async () => {
  if (isDownloadingAll) {
    // Cancel all downloads
    cancelAllRequested = true;
    isDownloadingAll = false;
    
    // Reset all queued tracks back to pending state
    const queuedTracks = [...downloadQueue];
    downloadQueue.length = 0;
    
    queuedTracks.forEach(index => {
      const item = document.querySelector(`[data-index="${index}"]`);
      if (item && !item.classList.contains('downloading') && !item.classList.contains('completed')) {
        const badge = item.querySelector('.status-badge');
        
        badge.className = 'status-badge status-pending';
        badge.title = 'Download';
        badge.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        `;
        
        // Re-attach event listener
        badge.onclick = null;
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          queueDownload(index);
        });
      }
    });
    
    // Update button
    downloadAllBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download All
    `;
    downloadAllBtn.classList.remove('btn-danger');
    downloadAllBtn.classList.add('btn-primary');
    
    console.log(`Cancel all requested - cleared ${queuedTracks.length} queued tracks`);
  } else {
    // Start downloading all
    isDownloadingAll = true;
    cancelAllRequested = false;
    
    // Update button to Cancel All
    downloadAllBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      Cancel All
    `;
    downloadAllBtn.classList.remove('btn-primary');
    downloadAllBtn.classList.add('btn-danger');
    
    // Queue all non-completed tracks (skip already downloaded files)
    for (let i = 0; i < tracks.length; i++) {
      const item = document.querySelector(`[data-index="${i}"]`);
      // Only queue if not completed, not downloading, and not already in queue
      if (item && !item.classList.contains('completed') && !item.classList.contains('downloading') && !downloadQueue.includes(i)) {
        queueDownload(i);
      }
    }
    
    // Monitor when all downloads finish
    const checkComplete = setInterval(() => {
      if (activeDownloads === 0 && downloadQueue.length === 0) {
        clearInterval(checkComplete);
        isDownloadingAll = false;
        cancelAllRequested = false;
        
        // Reset button
        downloadAllBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download All
        `;
        downloadAllBtn.classList.remove('btn-danger');
        downloadAllBtn.classList.add('btn-primary');
      }
    }, 500);
  }
});

// Progress Updates
window.musicAPI.onDownloadProgress((data) => {
  const item = document.querySelector(`[data-index="${data.trackIndex}"]`);
  if (item) {
    item.style.setProperty('--progress', `${data.progress}%`);
    
    // Update circular progress
    const circle = document.getElementById(`progress-circle-${data.trackIndex}`);
    if (circle) {
      const circumference = 56.5487; // 2 * PI * 9
      const offset = circumference - (data.progress / 100) * circumference;
      circle.style.strokeDashoffset = offset;
    }
  }
});

// UI Helpers
function setLoading(loading) {
  fetchBtn.disabled = loading;
  if (loading) {
    fetchBtn.innerHTML = '<div class="spinner"></div> Fetching...';
  } else {
    fetchBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      Fetch
    `;
  }
}

function showError(message) {
  errorText.textContent = message;
  errorAlert.style.display = 'flex';
  setTimeout(() => hideError(), 5000);
}

function hideError() {
  errorAlert.style.display = 'none';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDuration(seconds) {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Settings Page
const chooseFolderBtn = document.getElementById('chooseFolderBtn');
const openFolderBtn = document.getElementById('openFolderBtn');
const recheckDepsBtn = document.getElementById('recheckDepsBtn');
const folderPath = document.getElementById('folderPath');
const concurrencySlider = document.getElementById('concurrencySlider');
const concurrencyValue = document.getElementById('concurrencyValue');
const concurrencyStatus = document.getElementById('concurrencyStatus');
const concurrencyWarning = document.getElementById('concurrencyWarning');

// Load settings on page load
loadSettings();
checkDependencies();

async function loadSettings() {
  try {
    const settings = await window.musicAPI.getSettings();
    folderPath.textContent = settings.currentDir;
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

chooseFolderBtn.addEventListener('click', async () => {
  try {
    const result = await window.musicAPI.chooseFolder();
    if (result) {
      folderPath.textContent = result.currentDir;
    }
  } catch (error) {
    showError('Failed to change folder');
  }
});

openFolderBtn.addEventListener('click', () => {
  window.musicAPI.openDownloadsFolder();
});

recheckDepsBtn.addEventListener('click', checkDependencies);

async function checkDependencies() {
  try {
    const deps = await window.musicAPI.checkDependencies();
    
    updateDepStatus('ytdlp', deps.ytdlp);
    updateDepStatus('ffmpeg', deps.ffmpeg);
  } catch (error) {
    console.error('Failed to check dependencies:', error);
  }
}

function updateDepStatus(dep, installed) {
  const container = document.getElementById(`${dep}Status`);
  const dot = container.querySelector('.status-dot');
  const text = container.querySelector('.dep-status');
  
  if (installed) {
    dot.style.background = 'var(--success)';
    dot.style.boxShadow = '0 0 8px var(--success)';
    text.textContent = 'Installed';
    text.style.color = 'var(--success)';
  } else {
    dot.style.background = 'var(--error)';
    dot.style.boxShadow = '0 0 8px var(--error)';
    text.textContent = 'Not Found';
    text.style.color = 'var(--error)';
  }
}

// Concurrency Control
// Set initial value from saved setting
concurrencySlider.value = maxConcurrency;
concurrencyValue.textContent = maxConcurrency;

// Update status display based on initial value
const initialStatusMap = {
  1: { text: 'Very Stable', color: 'var(--success)' },
  2: { text: 'Recommended', color: 'var(--success)' },
  3: { text: 'Balanced', color: 'var(--warning)' },
  4: { text: 'Risky', color: 'var(--error)' },
  5: { text: 'May cause failures', color: 'var(--error)' }
};
const initialStatus = initialStatusMap[maxConcurrency];
concurrencyStatus.textContent = initialStatus.text;
concurrencyStatus.style.color = initialStatus.color;
if (maxConcurrency >= 4) {
  concurrencyWarning.style.display = 'flex';
}

concurrencySlider.addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  maxConcurrency = value;
  concurrencyValue.textContent = value;
  
  // Save to localStorage
  localStorage.setItem('maxConcurrency', value);
  
  const statusMap = {
    1: { text: 'Very Stable', color: 'var(--success)' },
    2: { text: 'Recommended', color: 'var(--success)' },
    3: { text: 'Balanced', color: 'var(--warning)' },
    4: { text: 'Risky', color: 'var(--error)' },
    5: { text: 'May cause failures', color: 'var(--error)' }
  };
  
  const status = statusMap[value];
  concurrencyStatus.textContent = status.text;
  concurrencyStatus.style.color = status.color;
  
  if (value >= 4) {
    concurrencyWarning.style.display = 'flex';
  } else {
    concurrencyWarning.style.display = 'none';
  }
});

// Cache Management
const clearCacheBtn = document.getElementById('clearCacheBtn');
const cacheSize = document.getElementById('cacheSize');
const memoryUsage = document.getElementById('memoryUsage');
const cacheSuccessAlert = document.getElementById('cacheSuccessAlert');
const cacheSuccessText = document.getElementById('cacheSuccessText');

let cacheClearCooldown = false;
let cooldownTimer = null;

// Load cache stats on settings page load
async function loadCacheStats() {
  try {
    const stats = await window.musicAPI.getCacheStats();
    cacheSize.textContent = `${stats.cacheSizeMB} MB`;
    memoryUsage.textContent = `${stats.heapUsedMB} MB / ${stats.heapTotalMB} MB`;
    
    const systemMemoryEl = document.getElementById('systemMemory');
    if (systemMemoryEl) {
      systemMemoryEl.textContent = `${stats.usedSystemMemoryGB} GB / ${stats.systemMemoryGB} GB (${stats.freeSystemMemoryGB} GB free)`;
    }
  } catch (error) {
    console.error('Failed to load cache stats:', error);
    cacheSize.textContent = 'Unknown';
    memoryUsage.textContent = 'Unknown';
    const systemMemoryEl = document.getElementById('systemMemory');
    if (systemMemoryEl) {
      systemMemoryEl.textContent = 'Unknown';
    }
  }
}

function startCooldown() {
  cacheClearCooldown = true;
  let secondsLeft = 15;
  
  clearCacheBtn.disabled = true;
  clearCacheBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
    Wait ${secondsLeft}s
  `;
  
  cooldownTimer = setInterval(() => {
    secondsLeft--;
    
    if (secondsLeft <= 0) {
      clearInterval(cooldownTimer);
      cacheClearCooldown = false;
      clearCacheBtn.disabled = false;
      clearCacheBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 .49-3.08"/>
        </svg>
        Clear Cache & Free Memory
      `;
    } else {
      clearCacheBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        Wait ${secondsLeft}s
      `;
    }
  }, 1000);
}

clearCacheBtn.addEventListener('click', async () => {
  if (cacheClearCooldown) {
    return;
  }
  
  try {
    clearCacheBtn.disabled = true;
    clearCacheBtn.innerHTML = '<div class="spinner"></div> Clearing...';
    
    const result = await window.musicAPI.clearCache();
    
    // Update stats
    await loadCacheStats();
    
    // Show success message
    cacheSuccessText.textContent = `Cleared ${result.freedCacheMB} MB of cache. Memory freed: ${result.freedMemoryMB} MB`;
    cacheSuccessAlert.style.display = 'flex';
    
    setTimeout(() => {
      cacheSuccessAlert.style.display = 'none';
    }, 5000);
    
    // Start cooldown
    startCooldown();
    
  } catch (error) {
    showError(`Failed to clear cache: ${error.message}`);
    clearCacheBtn.disabled = false;
    clearCacheBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="1 4 1 10 7 10"/>
        <path d="M3.51 15a9 9 0 1 0 .49-3.08"/>
      </svg>
      Clear Cache & Free Memory
    `;
  }
});

// Load cache stats on initial page load if on settings page
if (document.getElementById('page-settings').classList.contains('active')) {
  loadCacheStats();
}
