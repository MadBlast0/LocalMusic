const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('musicAPI', {
  // Tracks
  fetchTracks: (url) => ipcRenderer.invoke('fetch-tracks', url),
  downloadTrack: (data) => ipcRenderer.invoke('download-track', data),
  checkFileExists: (data) => ipcRenderer.invoke('check-file-exists', data),

  // Folder & Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  resetFolder: () => ipcRenderer.invoke('reset-folder'),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  getFolderStats: () => ipcRenderer.invoke('get-folder-stats'),

  // Dependencies
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),

  // Library Management
  getLibrary: () => ipcRenderer.invoke('get-library'),
  createFolder: (folderName) => ipcRenderer.invoke('create-folder', folderName),
  deleteSong: (songPath) => ipcRenderer.invoke('delete-song', songPath),
  renameSong: (data) => ipcRenderer.invoke('rename-song', data),
  moveSong: (data) => ipcRenderer.invoke('move-song', data),

  // Cache Management
  getCacheStats: () => ipcRenderer.invoke('get-cache-stats'),
  clearCache: () => ipcRenderer.invoke('clear-cache'),

  // External Links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openDonateFile: () => ipcRenderer.invoke('open-donate-file'),

  // Events
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  }
});
