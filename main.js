const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');

let mainWindow;

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const DEFAULT_DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads', 'Simple Music Downloader');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}
}

function getDownloadsDir() {
  const config = loadConfig();
  const dir = config.customDownloadDir || DEFAULT_DOWNLOAD_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f0f13',
    show: false
  });

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  if (!fs.existsSync(DEFAULT_DOWNLOAD_DIR)) {
    fs.mkdirSync(DEFAULT_DOWNLOAD_DIR, { recursive: true });
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 200);
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0',
      ...options.headers
    };
    const req = mod.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location, options).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      } 
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      }
      let data = '';
      res.on('data', d => data += d.toString());
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// ── Spotify ───────────────────────────────────────────────────────────────────

async function scrapeSpotifyTrack(url) {
  try {
    const trackId = url.match(/track\/([a-zA-Z0-9]+)/)?.[1];
    if (!trackId) throw new Error('Invalid Spotify track URL');
    
    console.log('Fetching Spotify track via oEmbed...');
    
    const data = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    
    if (data && data.title) {
      // Parse title to extract artist if possible (format: "Song - Artist" or just "Song")
      let name = data.title;
      let artist = '';
      
      // Try to split by common separators
      const separators = [' - ', ' – ', ' | '];
      for (const sep of separators) {
        if (name.includes(sep)) {
          const parts = name.split(sep);
          name = parts[0].trim();
          artist = parts[1]?.trim() || '';
          break;
        }
      }
      
      console.log(`✓ Track: "${name}"${artist ? ` by ${artist}` : ''}`);
      return [{ name, artist, duration: null, id: trackId }];
    }
    
    throw new Error('Could not parse track data');
  } catch (e) {
    console.error('Spotify track error:', e);
    throw new Error(`Spotify track error: ${e.message}`);
  }
}

async function scrapeSpotifyPlaylist(url) {
  throw new Error('Playlists from this source are not supported. Please import a CSV/TXT file with your song list.');
}

// ── YouTube Smart Matching (Strict Filtering) ────────────────────────────────

async function findBestYouTubeMatch(trackName, artistName, durationSeconds = null) {
  try {
    // Fetch top 5 results
    const searchQuery = `${trackName} ${artistName} official audio`;
    console.log(`Searching YouTube: "${searchQuery}"`);
    
    const output = await runYtDlp(['--dump-json', '--flat-playlist', `"ytsearch5:${searchQuery}"`]);
    const results = output.trim().split('\n').filter(Boolean).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (results.length === 0) {
      console.log('No YouTube results found, using fallback search');
      return null;
    }

    console.log(`Found ${results.length} YouTube results for "${trackName}" by ${artistName}`);
    console.log(`Spotify duration: ${durationSeconds}s`);

    // NEGATIVE KEYWORDS - Immediate rejection
    const badKeywords = ['remix', 'slowed', 'reverb', 'live', 'cover', 'extended', 'version', 'sped up', 'nightcore', 'instrumental', 'karaoke'];

    // STRICT FILTERING PHASE 1: Duration ±8 seconds + No bad keywords
    let validResults = results.filter(result => {
      const title = (result.title || '').toLowerCase();
      const videoDuration = result.duration || 0;

      // Check for bad keywords
      const hasBadKeyword = badKeywords.some(keyword => title.includes(keyword));
      if (hasBadKeyword) {
        console.log(`  ✗ REJECTED (bad keyword): ${result.title}`);
        return false;
      }

      // Check duration (strict: ±8 seconds)
      if (durationSeconds && videoDuration) {
        const diff = Math.abs(videoDuration - durationSeconds);
        if (diff > 8) {
          console.log(`  ✗ REJECTED (duration ${videoDuration}s, diff: ${diff}s): ${result.title}`);
          return false;
        }
      }

      console.log(`  ✓ ACCEPTED (duration ${videoDuration}s): ${result.title}`);
      return true;
    });

    // FALLBACK PHASE 2: If no results, relax duration to ±15 seconds
    if (validResults.length === 0 && durationSeconds) {
      console.log('No results with strict filter, relaxing duration to ±15 seconds...');
      
      validResults = results.filter(result => {
        const title = (result.title || '').toLowerCase();
        const videoDuration = result.duration || 0;

        // Still reject bad keywords
        const hasBadKeyword = badKeywords.some(keyword => title.includes(keyword));
        if (hasBadKeyword) {
          return false;
        }

        // Relaxed duration check
        const diff = Math.abs(videoDuration - durationSeconds);
        if (diff > 15) {
          console.log(`  ✗ REJECTED (relaxed, duration ${videoDuration}s, diff: ${diff}s): ${result.title}`);
          return false;
        }

        console.log(`  ✓ ACCEPTED (relaxed, duration ${videoDuration}s): ${result.title}`);
        return true;
      });
    }

    // FALLBACK PHASE 3: If still no results, pick best available (low confidence)
    if (validResults.length === 0) {
      console.warn('No results passed filters, using low confidence fallback');
      
      // Filter out bad keywords only
      validResults = results.filter(result => {
        const title = (result.title || '').toLowerCase();
        const hasBadKeyword = badKeywords.some(keyword => title.includes(keyword));
        return !hasBadKeyword;
      });

      if (validResults.length === 0) {
        console.error('All results have bad keywords, using first result anyway');
        validResults = [results[0]];
      }

      const bestMatch = validResults[0];
      return {
        url: `https://www.youtube.com/watch?v=${bestMatch.id}`,
        confidence: 'low',
        title: bestMatch.title,
        duration: bestMatch.duration
      };
    }

    // SELECT BEST RESULT: First valid result (YouTube ranks by relevance)
    const bestMatch = validResults[0];
    const confidence = validResults.length >= 3 ? 'high' : validResults.length >= 2 ? 'medium' : 'low';

    console.log(`✓ SELECTED: ${bestMatch.title} (confidence: ${confidence})`);

    return {
      url: `https://www.youtube.com/watch?v=${bestMatch.id}`,
      confidence,
      title: bestMatch.title,
      duration: bestMatch.duration
    };

  } catch (e) {
    console.error('Smart matching failed:', e.message);
    return null;
  }
}

// ── YouTube ───────────────────────────────────────────────────────────────────

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { shell: true });
    let output = '', errOutput = '';
    proc.stdout.on('data', d => output += d.toString());
    proc.stderr.on('data', d => errOutput += d.toString());
    proc.on('close', code => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(errOutput || `yt-dlp exited with code ${code}`));
      }
    });
    proc.on('error', err => reject(new Error(`yt-dlp not found: ${err.message}`)));
  });
}

async function fetchYoutubeVideo(url) {
  const output = await runYtDlp(['--dump-json', '--no-playlist', `"${url}"`]);
  const info = JSON.parse(output.trim());
  return [{ 
    name: info.title, 
    artist: info.uploader || info.channel || info.uploader_id || 'Unknown Artist', 
    duration: info.duration || null,
    youtubeUrl: url, 
    id: info.id 
  }];
}

async function fetchYoutubePlaylist(url) {
  console.log('Fetching YouTube playlist...');
  const output = await runYtDlp(['--dump-json', '--flat-playlist', `"${url}"`]);
  
  const tracks = output.trim().split('\n').filter(Boolean).map((line, index) => {
    try {
      const info = JSON.parse(line);
      
      // Log first item to see what fields are available
      if (index === 0) {
        console.log('Sample playlist item fields:', Object.keys(info));
        console.log('Sample data:', JSON.stringify(info, null, 2));
      }
      
      return { 
        name: info.title || 'Unknown Title', 
        artist: info.uploader || info.channel || info.channel_id || info.uploader_id || 'Unknown Artist', 
        duration: info.duration || null,
        youtubeUrl: `https://www.youtube.com/watch?v=${info.id}`, 
        id: info.id 
      };
    } catch (e) { 
      console.error('Failed to parse playlist item:', e);
      return null; 
    }
  }).filter(Boolean);
  
  console.log(`Fetched ${tracks.length} tracks from playlist`);
  if (tracks.length > 0) {
    console.log('First track:', tracks[0]);
  }
  
  return tracks;
}

function detectUrlType(url) {
  const u = url.trim();
  if (/spotify\.com\/track\//.test(u))    return 'spotify_track';
  if (/spotify\.com\/playlist\//.test(u)) return 'spotify_playlist';
  if (/youtu\.be\//.test(u) || (/youtube\.com\/watch/.test(u) && !/list=/.test(u))) return 'youtube_video';
  if (/youtube\.com\/(watch\?.*list=|playlist\?list=)/.test(u)) return 'youtube_playlist';
  return null;
}

// ── IPC: Tracks ───────────────────────────────────────────────────────────────

ipcMain.handle('fetch-tracks', async (event, url) => {
  const type = detectUrlType(url);
  if (!type) throw new Error('Invalid URL. Please enter a valid URL from a supported source.');
  switch (type) {
    case 'spotify_track':    return { tracks: await scrapeSpotifyTrack(url),   type };
    case 'spotify_playlist': return { tracks: await scrapeSpotifyPlaylist(url), type };
    case 'youtube_video':    return { tracks: await fetchYoutubeVideo(url),     type };
    case 'youtube_playlist': return { tracks: await fetchYoutubePlaylist(url),  type };
  }
});

// ── IPC: Downloads ────────────────────────────────────────────────────────────

ipcMain.handle('check-file-exists', async (event, { track }) => {
  const downloadsDir = getDownloadsDir();
  const filename = sanitizeFilename(`${track.name}${track.artist ? ' - ' + track.artist : ''}`);
  const filePath = path.join(downloadsDir, `${filename}.mp3`);
  
  const exists = fs.existsSync(filePath);
  return { exists, path: exists ? filePath : null };
});

ipcMain.handle('download-track', async (event, { track, trackIndex }) => {
  const downloadsDir = getDownloadsDir();
  const filename = sanitizeFilename(`${track.name}${track.artist ? ' - ' + track.artist : ''}`);
  const outputPath = path.join(downloadsDir, `${filename}.mp3`);

  console.log(`\n=== DOWNLOAD START [Track ${trackIndex}] ===`);
  console.log(`Track: "${track.name}" by ${track.artist}`);
  console.log(`Duration: ${track.duration}s`);
  console.log(`Output: ${outputPath}`);

  let ytdlpArgs;
  let targetUrl = track.youtubeUrl;

  // If no direct YouTube URL, use strict matching
  if (!targetUrl) {
    console.log(`No direct URL, starting smart matching...`);
    
    const match = await findBestYouTubeMatch(track.name, track.artist, track.duration);
    
    if (match) {
      targetUrl = match.url;
      console.log(`✓ Match found: ${match.title}`);
      console.log(`  Confidence: ${match.confidence}`);
      console.log(`  Duration: ${match.duration}s`);
      
      // Send confidence to UI
      if (mainWindow) {
        mainWindow.webContents.send('match-confidence', { 
          trackIndex, 
          confidence: match.confidence,
          matchedTitle: match.title
        });
      }
    } else {
      // Fallback to simple search
      console.log('✗ Smart matching failed, using fallback search');
      const searchTerms = [track.name, track.artist, 'official audio'].filter(Boolean).join(' ');
      const searchQuery = `ytsearch1:${searchTerms}`;
      ytdlpArgs = ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '--no-playlist', '-o', `"${outputPath}"`, `"${searchQuery}"`];
    }
  }

  // If we have a target URL, download it directly
  if (targetUrl && !ytdlpArgs) {
    console.log(`Using direct URL: ${targetUrl}`);
    ytdlpArgs = ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '--no-playlist', '-o', `"${outputPath}"`, `"${targetUrl}"`];
  }

  console.log('yt-dlp command:', ytdlpArgs.join(' '));

  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', ytdlpArgs, { shell: true });
    
    let stdoutData = '';
    proc.stdout.on('data', data => {
      const str = data.toString();
      stdoutData += str;
      
      // Extract progress
      const m = str.match(/(\d+\.?\d*)%/);
      if (m && mainWindow) {
        mainWindow.webContents.send('download-progress', { trackIndex, progress: parseFloat(m[1]) });
      }
    });
    
    let errOutput = '';
    proc.stderr.on('data', d => {
      const str = d.toString();
      errOutput += str;
      // Log stderr in real-time for debugging
      if (str.includes('ERROR') || str.includes('WARNING')) {
        console.error(`[Track ${trackIndex}] ${str.trim()}`);
      }
    });
    
    proc.on('close', code => {
      if (code === 0) {
        console.log(`✓ Download completed [Track ${trackIndex}]`);
        console.log(`=== DOWNLOAD END ===\n`);
        resolve({ success: true, path: outputPath });
      } else {
        console.error(`✗ Download failed [Track ${trackIndex}] - Exit code: ${code}`);
        console.error(`Error output: ${errOutput}`);
        console.log(`=== DOWNLOAD END ===\n`);
        
        // Parse common errors for better user feedback
        let errorMessage = 'Download failed';
        if (errOutput.includes('Video unavailable')) {
          errorMessage = 'Video unavailable or private';
        } else if (errOutput.includes('Sign in to confirm')) {
          errorMessage = 'Age-restricted content';
        } else if (errOutput.includes('HTTP Error 429')) {
          errorMessage = 'Rate limited - too many requests';
        } else if (errOutput.includes('Unable to extract')) {
          errorMessage = 'Unable to extract video data';
        } else if (errOutput) {
          // Include first line of error
          const firstLine = errOutput.split('\n')[0];
          errorMessage = firstLine.substring(0, 100);
        }
        
        reject(new Error(errorMessage));
      }
    });
    
    proc.on('error', err => {
      console.error(`✗ Process error [Track ${trackIndex}]:`, err);
      console.log(`=== DOWNLOAD END ===\n`);
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
});

// ── IPC: Folder & Settings ────────────────────────────────────────────────────

ipcMain.handle('get-settings', () => {
  const config = loadConfig();
  const currentDir = config.customDownloadDir || DEFAULT_DOWNLOAD_DIR;
  return { currentDir, isCustom: !!config.customDownloadDir, defaultDir: DEFAULT_DOWNLOAD_DIR };
});

ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Download Folder',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Select Folder'
  });
  if (result.canceled || !result.filePaths.length) return null;
  const chosen = result.filePaths[0];
  const config = loadConfig();
  config.customDownloadDir = chosen;
  saveConfig(config);
  if (!fs.existsSync(chosen)) fs.mkdirSync(chosen, { recursive: true });
  return { currentDir: chosen, isCustom: true, defaultDir: DEFAULT_DOWNLOAD_DIR };
});

ipcMain.handle('reset-folder', () => {
  const config = loadConfig();
  delete config.customDownloadDir;
  saveConfig(config);
  if (!fs.existsSync(DEFAULT_DOWNLOAD_DIR)) fs.mkdirSync(DEFAULT_DOWNLOAD_DIR, { recursive: true });
  return { currentDir: DEFAULT_DOWNLOAD_DIR, isCustom: false, defaultDir: DEFAULT_DOWNLOAD_DIR };
});

ipcMain.handle('open-downloads-folder', () => {
  shell.openPath(getDownloadsDir());
});

ipcMain.handle('check-dependencies', async () => {
  const results = { ytdlp: false, ffmpeg: false };
  
  // Check yt-dlp
  await new Promise(resolve => {
    exec('yt-dlp --version', { shell: true }, (err, stdout) => {
      if (!err && stdout) {
        console.log('yt-dlp found:', stdout.trim());
        results.ytdlp = true;
      } else {
        console.log('yt-dlp not found:', err?.message || 'no output');
      }
      resolve();
    });
  });
  
  // Check ffmpeg
  await new Promise(resolve => {
    exec('ffmpeg -version', { shell: true }, (err, stdout) => {
      if (!err && stdout) {
        console.log('ffmpeg found:', stdout.trim().split('\n')[0]);
        results.ffmpeg = true;
      } else {
        console.log('ffmpeg not found:', err?.message || 'no output');
      }
      resolve();
    });
  });
  
  console.log('Dependency check results:', results);
  return results;
});

ipcMain.handle('get-folder-stats', async () => {
  const dir = getDownloadsDir();
  try {
    if (!fs.existsSync(dir)) return { fileCount: 0, totalSize: 0 };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3'));
    let totalSize = 0;
    for (const file of files) {
      try { totalSize += fs.statSync(path.join(dir, file)).size; } catch {}
    }
    return { fileCount: files.length, totalSize };
  } catch { return { fileCount: 0, totalSize: 0 }; }
});

// ── IPC: Library Management ──────────────────────────────────────────────────

ipcMain.handle('get-library', async () => {
  const dir = getDownloadsDir();
  const songs = [];
  const folders = new Set();
  
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return { songs: [], folders: [] };
    }
    
    // Scan directory recursively
    function scanDirectory(currentPath, relativePath = '') {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          const folderName = relativePath ? `${relativePath}/${item}` : item;
          folders.add(folderName);
          scanDirectory(fullPath, folderName);
        } else if (item.endsWith('.mp3')) {
          // Parse filename to extract metadata
          const nameWithoutExt = item.replace('.mp3', '');
          let name = nameWithoutExt;
          let artist = '';
          
          // Try to parse "Song - Artist" or "Artist - Song" format
          if (nameWithoutExt.includes(' - ')) {
            const parts = nameWithoutExt.split(' - ');
            if (parts.length >= 2) {
              // Assume format is "Song - Artist" (as saved by downloader)
              name = parts[0].trim();
              artist = parts[1].trim();
            }
          }
          
          songs.push({
            name,
            artist,
            path: fullPath,
            folder: relativePath,
            dateAdded: stats.mtimeMs,
            duration: null // Duration will be loaded by frontend audio player
          });
        }
      }
    }
    
    scanDirectory(dir);
    
    return {
      songs: songs.sort((a, b) => b.dateAdded - a.dateAdded),
      folders: Array.from(folders).sort()
    };
  } catch (e) {
    console.error('Failed to scan library:', e);
    return { songs: [], folders: [] };
  }
});

ipcMain.handle('create-folder', async (event, folderName) => {
  const dir = getDownloadsDir();
  const folderPath = path.join(dir, folderName);
  
  try {
    if (fs.existsSync(folderPath)) {
      throw new Error('Folder already exists');
    }
    fs.mkdirSync(folderPath, { recursive: true });
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to create folder: ${e.message}`);
  }
});

ipcMain.handle('delete-song', async (event, songPath) => {
  try {
    if (fs.existsSync(songPath)) {
      fs.unlinkSync(songPath);
    }
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to delete song: ${e.message}`);
  }
});

ipcMain.handle('rename-song', async (event, { oldPath, newName }) => {
  try {
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    const newPath = path.join(dir, newName + ext);
    
    if (fs.existsSync(newPath)) {
      throw new Error('A file with that name already exists');
    }
    
    fs.renameSync(oldPath, newPath);
    return { success: true, newPath };
  } catch (e) {
    throw new Error(`Failed to rename song: ${e.message}`);
  }
});

ipcMain.handle('move-song', async (event, { songPath, targetFolder }) => {
  try {
    const dir = getDownloadsDir();
    const fileName = path.basename(songPath);
    const targetPath = path.join(dir, targetFolder, fileName);
    
    // Ensure target folder exists
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    if (fs.existsSync(targetPath)) {
      throw new Error('A file with that name already exists in the target folder');
    }
    
    fs.renameSync(songPath, targetPath);
    return { success: true, newPath: targetPath };
  } catch (e) {
    throw new Error(`Failed to move song: ${e.message}`);
  }
});

// ── IPC: Cache Management ─────────────────────────────────────────────────────

ipcMain.handle('get-cache-stats', async () => {
  try {
    const session = mainWindow.webContents.session;
    const cacheSize = await session.getCacheSize();
    const memoryInfo = process.memoryUsage();
    const systemMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedSystemMemory = systemMemory - freeMemory;
    
    return {
      cacheSize: cacheSize,
      cacheSizeMB: (cacheSize / 1024 / 1024).toFixed(2),
      heapUsed: memoryInfo.heapUsed,
      heapUsedMB: (memoryInfo.heapUsed / 1024 / 1024).toFixed(2),
      heapTotal: memoryInfo.heapTotal,
      heapTotalMB: (memoryInfo.heapTotal / 1024 / 1024).toFixed(2),
      systemMemoryGB: (systemMemory / 1024 / 1024 / 1024).toFixed(2),
      usedSystemMemoryGB: (usedSystemMemory / 1024 / 1024 / 1024).toFixed(2),
      freeSystemMemoryGB: (freeMemory / 1024 / 1024 / 1024).toFixed(2)
    };
  } catch (e) {
    console.error('Failed to get cache stats:', e);
    return {
      cacheSize: 0,
      cacheSizeMB: '0.00',
      heapUsed: 0,
      heapUsedMB: '0.00',
      heapTotal: 0,
      heapTotalMB: '0.00',
      systemMemoryGB: '0.00',
      usedSystemMemoryGB: '0.00',
      freeSystemMemoryGB: '0.00'
    };
  }
});

ipcMain.handle('clear-cache', async () => {
  try {
    const session = mainWindow.webContents.session;
    
    // Get initial stats
    const initialCacheSize = await session.getCacheSize();
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Clear cache
    await session.clearCache();
    
    // Clear storage data (cookies, local storage, etc.)
    await session.clearStorageData({
      storages: ['appcache', 'cookies', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
    });
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Get final stats
    const finalCacheSize = await session.getCacheSize();
    const finalMemory = process.memoryUsage().heapUsed;
    
    const freedCache = initialCacheSize - finalCacheSize;
    const freedMemory = initialMemory - finalMemory;
    
    console.log(`Cache cleared: ${(freedCache / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Memory freed: ${(freedMemory / 1024 / 1024).toFixed(2)} MB`);
    
    return {
      success: true,
      freedCacheMB: (freedCache / 1024 / 1024).toFixed(2),
      freedMemoryMB: (freedMemory / 1024 / 1024).toFixed(2),
      newCacheSize: finalCacheSize,
      newCacheSizeMB: (finalCacheSize / 1024 / 1024).toFixed(2)
    };
  } catch (e) {
    console.error('Failed to clear cache:', e);
    throw new Error(`Failed to clear cache: ${e.message}`);
  }
});

// ── IPC: External Links ───────────────────────────────────────────────────────

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (e) {
    console.error('Failed to open external URL:', e);
    throw new Error(`Failed to open URL: ${e.message}`);
  }
});

ipcMain.handle('open-donate-file', async () => {
  try {
    const donatePath = path.join(__dirname, 'donate.html');
    
    // Convert to file:// URL for cross-platform compatibility
    const fileUrl = `file://${donatePath.replace(/\\/g, '/')}`;
    
    await shell.openExternal(fileUrl);
    return { success: true };
  } catch (e) {
    console.error('Failed to open donate file:', e);
    throw new Error(`Failed to open donate page: ${e.message}`);
  }
});
