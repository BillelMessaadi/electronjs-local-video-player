const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs').promises;
const { createReadStream } = require('node:fs');

// Register the custom protocol as privileged before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true, // Important for video/audio streaming
      bypassCSP: true
    }
  }
]);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();
}

// Video file extensions to check
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
const VIDEO_FOLDER = path.join(__dirname, 'video');

// IPC handler to get list of video files
ipcMain.handle('get-video-files', async () => {
  try {
    const files = await fs.readdir(VIDEO_FOLDER);
    const videoFiles = [];
    
    for (const file of files) {
      const filePath = path.join(VIDEO_FOLDER, file);
      const ext = path.extname(file).toLowerCase();
      
      // Check if file has video extension
      if (VIDEO_EXTENSIONS.includes(ext)) {
        try {
          const stats = await fs.stat(filePath);
          
          // Verify it's a file and has content
          if (stats.isFile() && stats.size > 0) {
            // Read first few bytes to verify it's likely a video file
            const isValid = await verifyVideoFile(filePath, ext);
            
            if (isValid) {
              videoFiles.push({
                name: file,
                size: stats.size,
                path: file, // relative path for the protocol
                url: `app://video/${encodeURIComponent(file)}`
              });
            }
          }
        } catch (err) {
          console.error(`Error checking file ${file}:`, err);
        }
      }
    }
    
    return videoFiles;
  } catch (err) {
    console.error('Error reading video folder:', err);
    return [];
  }
});

// Verify video file by checking magic bytes
async function verifyVideoFile(filePath, ext) {
  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { start: 0, end: 11 });
    const chunks = [];
    
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      
      // Check magic bytes for common video formats
      const hex = buffer.toString('hex');
      
      // MP4/M4V: starts with ftyp
      if (hex.includes('66747970')) {
        resolve(true);
        return;
      }
      
      // WebM: starts with 1a45dfa3
      if (hex.startsWith('1a45dfa3')) {
        resolve(true);
        return;
      }
      
      // AVI: starts with RIFF and contains AVI
      if (hex.startsWith('52494646') && hex.includes('415649')) {
        resolve(true);
        return;
      }
      
      // MOV: similar to MP4, contains ftyp
      if (hex.includes('66747970')) {
        resolve(true);
        return;
      }
      
      // MKV: starts with 1a45dfa3
      if (hex.startsWith('1a45dfa3')) {
        resolve(true);
        return;
      }
      
      // If we can't verify by magic bytes, trust the extension
      resolve(true);
    });
    
    stream.on('error', () => resolve(false));
  });
}

app.whenReady().then(() => {
  // Register the custom protocol handler
  protocol.handle('app', (req) => {
    const { host, pathname } = new URL(req.url);
    
    if (host === 'video') {
      // Decode the pathname and remove leading slash
      const fileName = decodeURIComponent(pathname.substring(1));
      const videoPath = path.join(VIDEO_FOLDER, fileName);
      
      // Security check: ensure the path doesn't escape the video directory
      const relativePath = path.relative(VIDEO_FOLDER, videoPath);
      const isSafe = relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
      
      if (!isSafe) {
        return new Response('Forbidden', {
          status: 403,
          headers: { 'content-type': 'text/plain' }
        });
      }
      
      // Use net.fetch with pathToFileURL to serve the video file
      return net.fetch(pathToFileURL(videoPath).toString());
    }
    
    return new Response('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain' }
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
