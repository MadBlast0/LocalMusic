// Music Library Management

let currentFolder = '';
let allSongs = [];
let filteredSongs = [];
let currentSongIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0: off, 1: all, 2: one

// Audio player
const audioPlayer = document.getElementById('audioPlayer');

// Player elements
const playerTitle = document.getElementById('playerTitle');
const playerArtist = document.getElementById('playerArtist');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const progressTrack = document.getElementById('progressTrack');
const progressFill = document.getElementById('progressFill');
const progressHandle = document.getElementById('progressHandle');
const currentTime = document.getElementById('currentTime');
const totalTime = document.getElementById('totalTime');
const volumeBtn = document.getElementById('volumeBtn');
const volumeSlider = document.getElementById('volumeSlider');

// Library elements
const folderTree = document.getElementById('folderTree');
const songList = document.getElementById('songList');
const currentFolderName = document.getElementById('currentFolderName');
const songCount = document.getElementById('songCount');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const refreshLibraryBtn = document.getElementById('refreshLibraryBtn');
const createFolderBtn = document.getElementById('createFolderBtn');

// Initialize
loadLibrary();

// Load library
async function loadLibrary() {
  try {
    const library = await window.musicAPI.getLibrary();
    allSongs = library.songs;
    updateFolderTree(library.folders);
    filterAndDisplaySongs();
  } catch (e) {
    console.error('Failed to load library:', e);
  }
}

// Update folder tree
function updateFolderTree(folders) {
  const allMusicItem = folderTree.querySelector('[data-folder=""]');
  allMusicItem.querySelector('.folder-count').textContent = allSongs.length;
  
  // Remove existing folder items (except "All Music")
  const existingFolders = folderTree.querySelectorAll('.folder-item:not([data-folder=""])');
  existingFolders.forEach(item => item.remove());
  
  // Add folder items
  folders.forEach(folder => {
    const count = allSongs.filter(s => s.folder === folder).length;
    const item = document.createElement('div');
    item.className = 'folder-item';
    item.dataset.folder = folder;
    item.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span>${folder}</span>
      <span class="folder-count">${count}</span>
    `;
    item.addEventListener('click', () => selectFolder(folder));
    folderTree.appendChild(item);
  });
}

// Select folder
function selectFolder(folder) {
  currentFolder = folder;
  
  // Update active state
  folderTree.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset.folder === folder);
  });
  
  // Update header
  currentFolderName.textContent = folder || 'All Music';
  
  // Filter and display
  filterAndDisplaySongs();
}

// Filter and display songs
function filterAndDisplaySongs() {
  // Filter by folder
  let songs = currentFolder ? allSongs.filter(s => s.folder === currentFolder) : allSongs;
  
  // Filter by search
  const query = searchInput.value.toLowerCase();
  if (query) {
    songs = songs.filter(s => 
      s.name.toLowerCase().includes(query) || 
      s.artist.toLowerCase().includes(query)
    );
  }
  
  // Sort
  const sortBy = sortSelect.value;
  songs.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
    if (sortBy === 'date') return b.dateAdded - a.dateAdded;
    return 0;
  });
  
  filteredSongs = songs;
  displaySongs(songs);
  songCount.textContent = `${songs.length} song${songs.length !== 1 ? 's' : ''}`;
}

// Display songs
function displaySongs(songs) {
  if (songs.length === 0) {
    songList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <h3 class="empty-title">No songs found</h3>
        <p class="empty-text">${searchInput.value ? 'Try a different search' : 'Download some music to get started'}</p>
      </div>
    `;
    return;
  }
  
  songList.innerHTML = songs.map((song, index) => `
    <div class="song-row ${currentSongIndex === index && isPlaying ? 'playing' : ''}" data-index="${index}">
      <div class="song-number">${index + 1}</div>
      <div class="song-info-cell">
        <div class="song-title">${escapeHtml(song.name)}</div>
        <div class="song-artist">${escapeHtml(song.artist || 'Unknown Artist')}</div>
      </div>
      <div class="song-folder">${escapeHtml(song.folder || 'All Music')}</div>
      <div class="song-duration" data-song-index="${index}">--:--</div>
      <div class="song-actions">
        <button class="btn-action" onclick="deleteSong(${index})" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
  
  // Add click listeners
  songList.querySelectorAll('.song-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.btn-action')) {
        const index = parseInt(row.dataset.index);
        playSong(index);
      }
    });
  });
  
  // Load durations asynchronously
  loadSongDurations(songs);
}

// Load song durations
function loadSongDurations(songs) {
  songs.forEach((song, index) => {
    if (!song.duration) {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        const durationEl = songList.querySelector(`[data-song-index="${index}"]`);
        if (durationEl && audio.duration) {
          durationEl.textContent = formatTime(audio.duration);
          // Cache the duration
          filteredSongs[index].duration = audio.duration;
        }
      });
      audio.src = `file://${song.path}`;
    }
  });
}

// Play song
function playSong(index) {
  if (index < 0 || index >= filteredSongs.length) return;
  
  currentSongIndex = index;
  const song = filteredSongs[index];
  
  audioPlayer.src = `file://${song.path}`;
  audioPlayer.play();
  isPlaying = true;
  
  updatePlayerUI(song);
  updatePlayPauseButton();
  updateSongRows();
}

// Update player UI
function updatePlayerUI(song) {
  playerTitle.textContent = song.name;
  playerArtist.textContent = song.artist || 'Unknown Artist';
}

// Update play/pause button
function updatePlayPauseButton() {
  playPauseBtn.innerHTML = isPlaying ? `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
  ` : `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  `;
}

// Update song rows
function updateSongRows() {
  songList.querySelectorAll('.song-row').forEach((row, index) => {
    row.classList.toggle('playing', index === currentSongIndex && isPlaying);
  });
}

// Player controls
playPauseBtn.addEventListener('click', () => {
  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
  } else {
    if (currentSongIndex === -1 && filteredSongs.length > 0) {
      playSong(0);
    } else {
      audioPlayer.play();
      isPlaying = true;
    }
  }
  updatePlayPauseButton();
  updateSongRows();
});

prevBtn.addEventListener('click', () => {
  if (currentSongIndex > 0) {
    playSong(currentSongIndex - 1);
  }
});

nextBtn.addEventListener('click', () => {
  playNext();
});

function playNext() {
  if (repeatMode === 2) {
    // Repeat one
    audioPlayer.currentTime = 0;
    audioPlayer.play();
  } else if (isShuffle) {
    // Shuffle
    const randomIndex = Math.floor(Math.random() * filteredSongs.length);
    playSong(randomIndex);
  } else if (currentSongIndex < filteredSongs.length - 1) {
    // Next
    playSong(currentSongIndex + 1);
  } else if (repeatMode === 1) {
    // Repeat all
    playSong(0);
  }
}

shuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
});

repeatBtn.addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3;
  repeatBtn.classList.toggle('active', repeatMode > 0);
  if (repeatMode === 2) {
    repeatBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="17 1 21 5 17 9"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <polyline points="7 23 3 19 7 15"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
      </svg>
    `;
  } else {
    repeatBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="17 1 21 5 17 9"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <polyline points="7 23 3 19 7 15"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      </svg>
    `;
  }
});

// Audio events
audioPlayer.addEventListener('timeupdate', () => {
  if (audioPlayer.duration) {
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressFill.style.width = `${percent}%`;
    progressHandle.style.left = `${percent}%`;
    currentTime.textContent = formatTime(audioPlayer.currentTime);
  }
});

audioPlayer.addEventListener('loadedmetadata', () => {
  totalTime.textContent = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener('ended', () => {
  playNext();
});

// Progress bar
progressTrack.addEventListener('click', (e) => {
  const rect = progressTrack.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audioPlayer.currentTime = percent * audioPlayer.duration;
});

// Volume
volumeSlider.addEventListener('input', (e) => {
  audioPlayer.volume = e.target.value / 100;
});

volumeBtn.addEventListener('click', () => {
  audioPlayer.muted = !audioPlayer.muted;
  volumeBtn.innerHTML = audioPlayer.muted ? `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/>
      <line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  ` : `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  `;
});

// Search and sort
searchInput.addEventListener('input', filterAndDisplaySongs);
sortSelect.addEventListener('change', filterAndDisplaySongs);

// Refresh library
refreshLibraryBtn.addEventListener('click', loadLibrary);

// Create folder
createFolderBtn.addEventListener('click', async () => {
  const folderName = prompt('Enter folder name:');
  if (folderName) {
    try {
      await window.musicAPI.createFolder(folderName);
      loadLibrary();
    } catch (e) {
      alert('Failed to create folder: ' + e.message);
    }
  }
});

// Delete song
window.deleteSong = async function(index) {
  const song = filteredSongs[index];
  if (confirm(`Delete "${song.name}"?`)) {
    try {
      await window.musicAPI.deleteSong(song.path);
      loadLibrary();
    } catch (e) {
      alert('Failed to delete song: ' + e.message);
    }
  }
};

// Helpers
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds) {
  if (!seconds) return '--:--';
  return formatTime(seconds);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
