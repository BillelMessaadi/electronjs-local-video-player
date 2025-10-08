// Preload script for security context isolation
// This script runs before the renderer process loads

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getVideoFiles: () => ipcRenderer.invoke('get-video-files')
});

window.addEventListener('DOMContentLoaded', (event) => {
  console.log('Preload script loaded');
  console.log('Electron version:', process.versions.electron);
  console.log('Chrome version:', process.versions.chrome);
  console.log('Node version:', process.versions.node);
});
