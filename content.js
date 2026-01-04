// content.js - LeetCode YouTube Solutions (user-provided API key)
// Horizontal carousel + inline player. Calls YouTube Data API directly using user's key saved in chrome.storage.sync

(function () {
  const PANEL_ID = "lc-youtube-panel-userkey";
  const TOGGLE_BTN_ID = "lc-youtube-toggle-btn";
  let isVideosVisible = false; // Track visibility state (hidden by default)

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
      const txt = await resp.text();
      console.error('YouTube API error', resp.status, txt);
      return [];
    }
    const data = await resp.json();
    if (!data.items) return [];
    return data.items.map(it => ({
      videoId: it.id.videoId,
      title: it.snippet.title,
      channelTitle: it.snippet.channelTitle,
      thumbnail: (it.snippet.thumbnails && (it.snippet.thumbnails.medium || it.snippet.thumbnails.default) && (it.snippet.thumbnails.medium || it.snippet.thumbnails.default).url) || ''
    }));
  }

  async function fetchVideos(query) {
    const key = await loadUserKey();
    if (!key) return { error: 'no_key', items: [] };
    try {
      const items = await callYouTubeSearch(query, key);
      return { items };
    } catch (e) {
      console.error('fetchVideos failed', e);
      return { error: 'fetch_error', items: [] };
    }
  }

  function deriveThemeColors() {
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--color-bg-1') || cs.getPropertyValue('--color-background') || '';
    const panelBg = cs.getPropertyValue('--color-bg-2') || cs.getPropertyValue('--color-surface') || '';
    const text = cs.getPropertyValue('--color-text-main') || cs.getPropertyValue('--color-text') || '';
    const subtext = cs.getPropertyValue('--color-text-secondary') || '';
    const accent = cs.getPropertyValue('--color-primary') || '';
    if (!bg.trim()) {
      const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (dark) {
        return { background: '#0b1220', panel: '#0f1724', text: '#e6eef8', subtext: '#9fb3d1', accent: '#3b82f6' };
      } else {
        return { background: '#ffffff', panel: '#f8fafc', text: '#0f172a', subtext: '#475569', accent: '#409eff' };
      }
    }
    return {
      background: bg.trim() || '#fff',
      panel: panelBg.trim() || '#f8fafc',
      text: text.trim() || '#0f172a',
      subtext: subtext.trim() || '#475569',
      accent: accent.trim() || '#409eff'
    };
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

  function renderCarousel(panel, items, colors) {
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
    toggleBtn.addEventListener('click', () => {
      isVideosVisible = !isVideosVisible;
      contentWrapper.style.display = isVideosVisible ? 'block' : 'none';
      toggleBtn.textContent = isVideosVisible ? '🎬 Hide Videos' : '🎬 Show Videos';
    });
    
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
      panel.appendChild(empty);
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
      card.style.background = colors.panel;
      card.style.border = `1px solid ${hexAlpha(colors.subtext || '#000', 0.08)}`;
      card.style.cursor = 'pointer';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';

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

      card.addEventListener('click', () => openPlayer(panel, vid, items, idx, colors));
    });

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '8px';
    controls.style.marginTop = '6px';
    controls.style.alignItems = 'center';
    const left = document.createElement('button');
    left.textContent = '◀'; left.title = 'Scroll left'; left.className = 'lc-yt-scroll-btn'; left.style.cursor='pointer';
    left.addEventListener('click', ()=> carousel.scrollBy({left:-300, behavior:'smooth'}));
    const right = document.createElement('button');
    right.textContent = '▶'; right.title='Scroll right'; right.className='lc-yt-scroll-btn'; right.style.cursor='pointer';
    right.addEventListener('click', ()=> carousel.scrollBy({left:300, behavior:'smooth'}));
    controls.appendChild(left); controls.appendChild(right);
    panel.appendChild(controls);

    let playerArea = panel.querySelector('.lc-yt-player-area');
    if (!playerArea) {
      playerArea = document.createElement('div');
      playerArea.className = 'lc-yt-player-area';
      playerArea.style.marginTop = '8px';
      panel.appendChild(playerArea);
    }
  }

  function openPlayer(panel, videoId, items, idx, colors) {
    const playerArea = panel.querySelector('.lc-yt-player-area');
    if (!playerArea) return;
    playerArea.innerHTML = `
      <div class="lc-yt-player-wrapper" style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div class="lc-yt-player-inner" style="width:100%;max-width:1100px;position:relative;padding-top:56.25%;background:#000;border-radius:8px;overflow:hidden">
          <iframe class="lc-yt-iframe" src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;left:0;top:0;width:100%;height:100%;border:0"></iframe>
        </div>
        <div style="width:100%;max-width:1100px;display:flex;gap:10px;align-items:center;">
          <button class="lc-yt-button" style="padding:6px 10px;border-radius:6px;border:0;background:${colors.accent};color:#fff;cursor:pointer">⬅ Back</button>
          <a class="lc-yt-link" href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener" style="color:${colors.subtext};text-decoration:none">Open on YouTube</a>
        </div>
      </div>
    `;
    const back = playerArea.querySelector('.lc-yt-button');
    if (back) back.addEventListener('click', ()=> playerArea.innerHTML = '');
    playerArea.scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  async function init() {
    const slug = getSlug();
    if (!slug) return;
    const panel = createPanelElement();
    const colors = deriveThemeColors();
    panel.style.background = colors.background;
    panel.style.color = colors.text;
    panel.style.border = `1px solid ${hexAlpha(colors.subtext || '#000', 0.12)}`;
    panel.innerHTML = `<div style="color:${colors.subtext}">Loading YouTube solutions...</div>`;
    const title = getTitle() || slug;
    const query = `${title} LeetCode solution`;
    const data = await fetchVideos(query);
    if (data.error === 'no_key') {
      panel.innerHTML = `<div style="color:${colors.subtext}">No YouTube API key configured. Open extension options to add yours.</div>`;
      return;
    }
    renderCarousel(panel, data.items, colors);
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
  }

  startObserving();
})();
