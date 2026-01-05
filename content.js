// content.js - LeetCode YouTube Solutions (user-provided API key)
// Horizontal carousel + inline player. Calls YouTube Data API directly using user's key saved in chrome.storage.sync

(function () {
  const PANEL_ID = "lc-youtube-panel-userkey";
  const TOGGLE_BTN_ID = "lc-youtube-toggle-btn";
  let isVideosVisible = false; // Track visibility state (hidden by default)
  let videosLoaded = false; // Track if API has been called for current page
  let cachedVideos = []; // Cache videos for current page
  let currentQuery = ''; // Store current search query for re-rendering on theme change

  async function loadUserKey() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ userApiKey: "" }, (items) => resolve(items.userApiKey || ""));
    });
  }

  function getSlug() {
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('problems');
    if (idx >= 0 && parts.length > idx + 1) return parts[idx + 1];
    return null;
  }

  function getTitle() {
    const el = document.querySelector('div[data-cy="question-title"] h1') || document.querySelector('h1');
    return el ? el.innerText.trim() : null;
  }

  async function callYouTubeSearch(query, key) {
    const endpoint = 'https://www.googleapis.com/youtube/v3/search';
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: '12',
      key: key
    });
    const url = endpoint + '?' + params.toString();
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
      try {
        const errorData = await resp.json();
        const error = errorData?.error;
        const reason = error?.errors?.[0]?.reason;
        
        if (reason === 'quotaExceeded') {
          return { error: 'quota_exceeded', items: [] };
        } else if (reason === 'accessNotConfigured' || reason === 'forbidden') {
          return { error: 'api_not_enabled', items: [] };
        } else if (resp.status === 400) {
          return { error: 'invalid_key', items: [] };
        }
        console.error('YouTube API error', resp.status, errorData);
        return { error: 'api_error', items: [] };
      } catch (e) {
        console.error('YouTube API error', resp.status);
        return { error: 'api_error', items: [] };
      }
    }
    const data = await resp.json();
    if (!data.items) return { items: [] };
    return {
      items: data.items.map(it => ({
        videoId: it.id.videoId,
        title: it.snippet.title,
        channelTitle: it.snippet.channelTitle,
        thumbnail: (it.snippet.thumbnails && (it.snippet.thumbnails.medium || it.snippet.thumbnails.default) && (it.snippet.thumbnails.medium || it.snippet.thumbnails.default).url) || ''
      }))
    };
  }

  async function fetchVideos(query) {
    const key = await loadUserKey();
    if (!key) return { error: 'no_key', items: [] };
    try {
      const result = await callYouTubeSearch(query, key);
      // Pass through any errors from the API call
      if (result.error) {
        return result;
      }
      return { items: result.items || [] };
    } catch (e) {
      console.error('fetchVideos failed', e);
      return { error: 'fetch_error', items: [] };
    }
  }

  function deriveThemeColors() {
    // Detect LeetCode theme more reliably
    const html = document.documentElement;
    const body = document.body;
    
    // Check for LeetCode's dark theme indicators
    const isDark = html.classList.contains('dark') || 
                   body.classList.contains('dark') ||
                   html.getAttribute('data-theme') === 'dark' ||
                   body.getAttribute('data-theme') === 'dark' ||
                   document.querySelector('[class*="dark"]') !== null && 
                   (getComputedStyle(body).backgroundColor.includes('rgb(26') || 
                    getComputedStyle(body).backgroundColor.includes('rgb(10') ||
                    getComputedStyle(body).backgroundColor.includes('rgb(15') ||
                    getComputedStyle(body).backgroundColor.includes('rgb(0'));
    
    // Also check computed background color of body
    const bodyBg = getComputedStyle(body).backgroundColor;
    const match = bodyBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    let isLightByColor = true;
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      // If luminance is low, it's dark theme
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
      isLightByColor = luminance > 128;
    }
    
    const isLightTheme = isLightByColor && !isDark;
    
    if (isLightTheme) {
      return { 
        background: '#ffffff', 
        panel: '#f8fafc', 
        text: '#1a1a1a', 
        subtext: '#4b5563', 
        accent: '#2563eb',
        cardBg: '#ffffff',
        cardBorder: '#e5e7eb'
      };
    } else {
      return { 
        background: '#1a1a2e', 
        panel: '#16213e', 
        text: '#e6eef8', 
        subtext: '#9fb3d1', 
        accent: '#3b82f6',
        cardBg: '#1e293b',
        cardBorder: '#334155'
      };
    }
  }

  function createPanelElement() {
    let existing = document.getElementById(PANEL_ID);
    if (existing) return existing;
    const container = document.querySelector('.question-content__JfgR') || document.querySelector('.content__2YbY') || document.querySelector('.question-view__panel') || document.body;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'lc-yt-panel-userkey';
    panel.style.boxSizing = 'border-box';
    panel.style.width = '100%';
    panel.style.margin = '8px 0 12px 0';
    panel.style.padding = '6px';
    panel.style.display = 'block';
    panel.style.zIndex = 9999;
    container.prepend(panel);
    return panel;
  }

  function hexAlpha(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    hex = hex.trim();
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    const m = hex.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!m) return `rgba(0,0,0,${alpha})`;
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function renderCarousel(panel, items, colors, query) {
    panel.innerHTML = '';
    
    // Create toggle button container
    const toggleContainer = document.createElement('div');
    toggleContainer.style.display = 'flex';
    toggleContainer.style.justifyContent = 'flex-start';
    toggleContainer.style.marginBottom = '8px';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.id = TOGGLE_BTN_ID;
    toggleBtn.textContent = isVideosVisible ? '🎬 Hide Videos' : '🎬 Show Videos';
    toggleBtn.style.padding = '6px 12px';
    toggleBtn.style.borderRadius = '6px';
    toggleBtn.style.border = `1px solid ${hexAlpha(colors.subtext || '#000', 0.2)}`;
    toggleBtn.style.background = colors.panel;
    toggleBtn.style.color = colors.text;
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.fontWeight = '600';
    toggleBtn.style.fontSize = '0.9rem';
    toggleContainer.appendChild(toggleBtn);
    panel.appendChild(toggleContainer);
    
    // Create content wrapper for collapsible content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'lc-yt-content-wrapper';
    contentWrapper.style.display = isVideosVisible ? 'block' : 'none';
    panel.appendChild(contentWrapper);
    
    // Toggle button click handler
    toggleBtn.addEventListener('click', async () => {
      isVideosVisible = !isVideosVisible;
      toggleBtn.textContent = isVideosVisible ? '🎬 Hide Videos' : '🎬 Show Videos';
      
      if (isVideosVisible) {
        // Only fetch videos if not already loaded
        if (!videosLoaded) {
          contentWrapper.innerHTML = `<div style="color:${colors.subtext};padding:12px 0;">⏳ Loading YouTube solutions...</div>`;
          contentWrapper.style.display = 'block';
          const data = await fetchVideos(query);
          
          // Handle different error types with friendly messages
          if (data.error) {
            let errorMessage = '';
            let errorStyle = `
              background: ${hexAlpha(colors.accent || '#ef4444', 0.1)};
              border: 1px solid ${hexAlpha(colors.accent || '#ef4444', 0.2)};
              border-radius: 12px;
              padding: 16px 20px;
              margin: 8px 0;
            `;
            
            switch (data.error) {
              case 'no_key':
                errorMessage = `
                  <div style="${errorStyle}">
                    <div style="font-weight:600;margin-bottom:8px;color:${colors.text}">🔑 API Key Required</div>
                    <div style="color:${colors.subtext};font-size:0.9rem;line-height:1.5;">
                      To use this feature, please add your YouTube Data API key in the extension options.
                      <br><br>
                      <strong>Right-click the extension icon → Options</strong> to get started.
                    </div>
                  </div>
                `;
                break;
              
              case 'quota_exceeded':
                errorMessage = `
                  <div style="${errorStyle}">
                    <div style="font-weight:600;margin-bottom:8px;color:${colors.text}">📊 Daily Quota Reached</div>
                    <div style="color:${colors.subtext};font-size:0.9rem;line-height:1.5;">
                      Oops! Your YouTube API quota for today has been used up. Don't worry, this is normal!
                      <br><br>
                      <strong>What you can do:</strong>
                      <ul style="margin:8px 0 0 16px;">
                        <li>Wait until <strong>midnight Pacific Time</strong> when your quota resets</li>
                        <li>Search for solutions directly on <a href="https://youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" style="color:${colors.accent};text-decoration:underline;">YouTube</a></li>
                      </ul>
                    </div>
                  </div>
                `;
                break;
              
              case 'api_not_enabled':
                errorMessage = `
                  <div style="${errorStyle}">
                    <div style="font-weight:600;margin-bottom:8px;color:${colors.text}">⚙️ API Not Enabled</div>
                    <div style="color:${colors.subtext};font-size:0.9rem;line-height:1.5;">
                      The YouTube Data API v3 isn't enabled for your project yet.
                      <br><br>
                      Please <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" style="color:${colors.accent};text-decoration:underline;">enable it here</a> and try again.
                    </div>
                  </div>
                `;
                break;
              
              case 'invalid_key':
                errorMessage = `
                  <div style="${errorStyle}">
                    <div style="font-weight:600;margin-bottom:8px;color:${colors.text}">🔒 Invalid API Key</div>
                    <div style="color:${colors.subtext};font-size:0.9rem;line-height:1.5;">
                      The API key doesn't seem to be valid. Please check your key in the extension options.
                      <br><br>
                      <strong>Right-click the extension icon → Options</strong> to update your key.
                    </div>
                  </div>
                `;
                break;
              
              default:
                errorMessage = `
                  <div style="${errorStyle}">
                    <div style="font-weight:600;margin-bottom:8px;color:${colors.text}">😕 Something Went Wrong</div>
                    <div style="color:${colors.subtext};font-size:0.9rem;line-height:1.5;">
                      We couldn't fetch videos right now. This might be a temporary issue.
                      <br><br>
                      Try again in a moment, or search directly on <a href="https://youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" style="color:${colors.accent};text-decoration:underline;">YouTube</a>.
                    </div>
                  </div>
                `;
            }
            
            contentWrapper.innerHTML = errorMessage;
            return;
          }
          
          cachedVideos = data.items || [];
          videosLoaded = true;
          renderVideoContent(contentWrapper, cachedVideos, colors, panel);
        }
        contentWrapper.style.display = 'block';
      } else {
        contentWrapper.style.display = 'none';
      }
    });
    
    // If videos are already visible and loaded, render them
    if (isVideosVisible && videosLoaded) {
      renderVideoContent(contentWrapper, cachedVideos, colors, panel);
    }
  }

  function renderVideoContent(contentWrapper, items, colors, panel) {
    contentWrapper.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'lc-yt-carousel-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '6px';
    header.innerHTML = `<div style="font-weight:700;color:${colors.text}">YouTube solutions</div><div style="font-size:0.85rem;color:${colors.subtext}">Swipe/scroll →</div>`;
    contentWrapper.appendChild(header);

    const carousel = document.createElement('div');
    carousel.className = 'lc-yt-carousel';
    carousel.setAttribute('role', 'list');
    carousel.style.display = 'flex';
    carousel.style.overflowX = 'auto';
    carousel.style.gap = '10px';
    carousel.style.paddingBottom = '6px';
    carousel.style.alignItems = 'flex-start';
    carousel.style.scrollBehavior = 'smooth';
    contentWrapper.appendChild(carousel);

    if (!items || items.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No YouTube solutions found (paste your API key in extension options).';
      empty.style.color = colors.subtext;
      contentWrapper.appendChild(empty);
      return;
    }

    items.forEach((it, idx) => {
      const vid = it.videoId || '';
      const thumb = it.thumbnail || '';
      const title = it.title || '';
      const channel = it.channelTitle || '';
      const card = document.createElement('div');
      card.className = 'lc-yt-card-horizontal';
      card.setAttribute('data-video', vid);
      card.setAttribute('role', 'listitem');
      card.style.minWidth = '220px';
      card.style.maxWidth = '320px';
      card.style.flex = '0 0 auto';
      card.style.borderRadius = '8px';
      card.style.overflow = 'hidden';
      card.style.background = colors.cardBg || colors.panel;
      card.style.border = `1px solid ${colors.cardBorder || hexAlpha(colors.subtext || '#000', 0.15)}`;
      card.style.cursor = 'pointer';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

      const thumbWrap = document.createElement('div');
      thumbWrap.style.width = '100%';
      thumbWrap.style.height = '120px';
      thumbWrap.style.background = '#000';
      const img = document.createElement('img');
      img.src = thumb;
      img.alt = title;
      img.loading = 'lazy';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      thumbWrap.appendChild(img);

      const meta = document.createElement('div');
      meta.style.padding = '8px';
      meta.style.display = 'flex';
      meta.style.flexDirection = 'column';
      const tdiv = document.createElement('div');
      tdiv.textContent = title;
      tdiv.style.fontWeight = '600';
      tdiv.style.fontSize = '0.9rem';
      tdiv.style.color = colors.text;
      tdiv.style.whiteSpace = 'nowrap';
      tdiv.style.overflow = 'hidden';
      tdiv.style.textOverflow = 'ellipsis';
      const cdiv = document.createElement('div');
      cdiv.textContent = channel;
      cdiv.style.fontSize = '0.82rem';
      cdiv.style.color = colors.subtext;
      cdiv.style.marginTop = '6px';
      meta.appendChild(tdiv);
      meta.appendChild(cdiv);

      card.appendChild(thumbWrap);
      card.appendChild(meta);

      carousel.appendChild(card);

      card.addEventListener('click', () => openPlayer(contentWrapper, vid, items, idx, colors));
    });

    let playerArea = contentWrapper.querySelector('.lc-yt-player-area');
    if (!playerArea) {
      playerArea = document.createElement('div');
      playerArea.className = 'lc-yt-player-area';
      playerArea.style.marginTop = '8px';
      contentWrapper.appendChild(playerArea);
    }
  }

  function openPlayer(panel, videoId, items, idx, colors) {
    // Remove any existing overlay
    const existingOverlay = document.getElementById('lc-yt-video-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    // Create overlay modal
    const overlay = document.createElement('div');
    overlay.id = 'lc-yt-video-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.padding = '20px';
    overlay.style.boxSizing = 'border-box';
    
    // Create player container
    const playerContainer = document.createElement('div');
    playerContainer.style.width = '100%';
    playerContainer.style.maxWidth = '1000px';
    playerContainer.style.position = 'relative';
    playerContainer.style.paddingTop = '56.25%'; // 16:9 aspect ratio
    playerContainer.style.backgroundColor = '#000';
    playerContainer.style.borderRadius = '12px';
    playerContainer.style.overflow = 'hidden';
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    
    playerContainer.appendChild(iframe);
    
    // Create controls bar
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '12px';
    controls.style.marginTop = '12px';
    controls.style.alignItems = 'center';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    closeBtn.style.padding = '8px 16px';
    closeBtn.style.borderRadius = '6px';
    closeBtn.style.border = '0';
    closeBtn.style.background = colors.accent || '#3b82f6';
    closeBtn.style.color = '#fff';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = '600';
    closeBtn.style.fontSize = '0.95rem';
    
    const youtubeLink = document.createElement('a');
    youtubeLink.href = `https://www.youtube.com/watch?v=${videoId}`;
    youtubeLink.target = '_blank';
    youtubeLink.rel = 'noopener';
    youtubeLink.textContent = 'Open on YouTube ↗';
    youtubeLink.style.color = '#fff';
    youtubeLink.style.textDecoration = 'none';
    youtubeLink.style.fontSize = '0.9rem';
    youtubeLink.style.opacity = '0.8';
    
    controls.appendChild(closeBtn);
    controls.appendChild(youtubeLink);
    
    overlay.appendChild(playerContainer);
    overlay.appendChild(controls);
    document.body.appendChild(overlay);
    
    // Close when clicking overlay background (outside player)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
    // Close button click
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });
    
    // Close on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  async function init() {
    // Reset state for new page - videos hidden by default, no API call yet
    isVideosVisible = false;
    videosLoaded = false;
    cachedVideos = [];
    
    const slug = getSlug();
    if (!slug) return;
    const panel = createPanelElement();
    const colors = deriveThemeColors();
    panel.style.background = colors.background;
    panel.style.color = colors.text;
    panel.style.border = `1px solid ${colors.cardBorder || hexAlpha(colors.subtext || '#000', 0.12)}`;
    
    const title = getTitle() || slug;
    currentQuery = `${title} LeetCode solution`;
    
    // Just render the toggle button, don't fetch videos yet
    renderCarousel(panel, [], colors, currentQuery);
  }

  function startObserving() {
    setTimeout(init, 500);
    let lastPath = location.pathname + location.search + location.hash;
    setInterval(()=>{
      const now = location.pathname + location.search + location.hash;
      if (now !== lastPath) { lastPath = now; setTimeout(init, 600); }
    },600);
    const mo = new MutationObserver(()=>{
      if (!document.getElementById(PANEL_ID) && location.pathname.includes('/problems/')) setTimeout(init,400);
    });
    mo.observe(document.body, {childList:true, subtree:true});
    
    // Watch for theme changes on html element
    const themeObserver = new MutationObserver(() => {
      const panel = document.getElementById(PANEL_ID);
      if (panel && currentQuery) {
        const colors = deriveThemeColors();
        panel.style.background = colors.background;
        panel.style.color = colors.text;
        panel.style.border = `1px solid ${colors.cardBorder || hexAlpha(colors.subtext || '#000', 0.12)}`;
        // Re-render with current state
        renderCarousel(panel, [], colors, currentQuery);
        // If videos were visible and loaded, show them again
        if (isVideosVisible && videosLoaded && cachedVideos.length > 0) {
          const contentWrapper = panel.querySelector('.lc-yt-content-wrapper');
          if (contentWrapper) {
            contentWrapper.style.display = 'block';
            renderVideoContent(contentWrapper, cachedVideos, colors, panel);
          }
        }
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
  }

  startObserving();
})();
