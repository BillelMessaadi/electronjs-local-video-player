const video = document.getElementById('videoPlayer');
const videoList = document.getElementById('videoList');
const currentVideoSource = document.getElementById('currentVideoSource');
const currentVideoSize = document.getElementById('currentVideoSize');
let currentVideoItem = null;

// Format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// Load a video
function loadVideo(videoFile, itemElement) {
  console.log('Loading video:', videoFile.name);
  
  // Update active state
  if (currentVideoItem) {
    currentVideoItem.classList.remove('active');
  }
  currentVideoItem = itemElement;
  itemElement.classList.add('active');
  
  // Update video source
  video.src = videoFile.url;
  video.load();
  video.play().catch(err => console.log('Autoplay prevented:', err));
  
  // Update info
  currentVideoSource.textContent = videoFile.name;
  currentVideoSize.textContent = formatFileSize(videoFile.size);
}

// Format duration
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Create thumbnail for video
function createThumbnail(videoFile) {
  const thumbnailContainer = document.createElement('div');
  thumbnailContainer.className = 'video-thumbnail';
  
  // Create a hidden video element to generate thumbnail
  const thumbVideo = document.createElement('video');
  thumbVideo.src = videoFile.url;
  thumbVideo.muted = true;
  thumbVideo.preload = 'metadata';
  
  // Placeholder while loading
  const placeholder = document.createElement('div');
  placeholder.className = 'video-thumbnail-placeholder';
  placeholder.textContent = '🎬';
  thumbnailContainer.appendChild(placeholder);
  
  // Duration overlay
  const durationOverlay = document.createElement('div');
  durationOverlay.className = 'video-duration';
  durationOverlay.textContent = '--:--';
  thumbnailContainer.appendChild(durationOverlay);
  
  // When metadata is loaded, seek to 1 second and capture frame
  thumbVideo.addEventListener('loadedmetadata', () => {
    durationOverlay.textContent = formatDuration(thumbVideo.duration);
    
    // Seek to 1 second or 10% of video duration for thumbnail
    const seekTime = Math.min(1, thumbVideo.duration * 0.1);
    thumbVideo.currentTime = seekTime;
  });
  
  thumbVideo.addEventListener('seeked', () => {
    // Replace placeholder with actual video thumbnail
    placeholder.remove();
    thumbnailContainer.insertBefore(thumbVideo, durationOverlay);
  });
  
  thumbVideo.addEventListener('error', () => {
    console.error('Error loading thumbnail for:', videoFile.name);
  });
  
  return thumbnailContainer;
}

// Load video files
async function loadVideoFiles() {
  try {
    const videoFiles = await window.electronAPI.getVideoFiles();
    console.log('Found video files:', videoFiles);
    
    if (videoFiles.length === 0) {
      videoList.innerHTML = '<p class="error">No video files found in the video folder.</p>';
      return;
    }
    
    // Clear loading message
    videoList.innerHTML = '';
    videoList.className = 'video-list';
    
    // Create video items
    videoFiles.forEach((videoFile, index) => {
      const item = document.createElement('div');
      item.className = 'video-item';
      
      // Create thumbnail
      const thumbnail = createThumbnail(videoFile);
      
      // Create details section
      const details = document.createElement('div');
      details.className = 'video-details';
      
      const name = document.createElement('div');
      name.className = 'video-item-name';
      name.textContent = videoFile.name;
      name.title = videoFile.name; // Show full name on hover
      
      const meta = document.createElement('div');
      meta.className = 'video-item-meta';
      
      const size = document.createElement('span');
      size.className = 'video-item-size';
      size.textContent = formatFileSize(videoFile.size);
      
      meta.appendChild(size);
      details.appendChild(name);
      details.appendChild(meta);
      
      item.appendChild(thumbnail);
      item.appendChild(details);
      
      item.addEventListener('click', () => loadVideo(videoFile, item));
      videoList.appendChild(item);
      
      // Auto-load first video
      if (index === 0) {
        loadVideo(videoFile, item);
      }
    });
  } catch (err) {
    console.error('Error loading video files:', err);
    videoList.innerHTML = '<p class="error">Error loading video files: ' + err.message + '</p>';
  }
}

// Video event listeners
video.addEventListener('loadedmetadata', () => {
  console.log('Video metadata loaded');
  console.log('Duration:', video.duration);
  console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
});

video.addEventListener('error', (e) => {
  console.error('Video error:', e);
  console.error('Error code:', video.error?.code);
  console.error('Error message:', video.error?.message);
});

video.addEventListener('canplay', () => {
  console.log('Video can play');
});

// Prevent default drag and drop behavior
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  return false;
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  return false;
});

// Load videos when page loads
loadVideoFiles();
