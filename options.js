document.addEventListener('DOMContentLoaded', () => {
  const keyInput = document.getElementById('ytKey');
  const status = document.getElementById('status');
  const inputWrapper = document.querySelector('.input-wrapper');

  // Helper to update status with animation
  const showStatus = (message, type = 'success') => {
    status.className = ''; // Reset classes
    status.textContent = message;
    // Force reflow to restart animation
    void status.offsetWidth;
    status.classList.add(type);
  };

  // Test API key by making a small request
  const testApiKey = async (key) => {
    try {
      const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${key}`);
      if (resp.ok) return { valid: true };
      const data = await resp.json();
      const error = data?.error;
      if (error?.errors?.[0]?.reason === 'quotaExceeded') {
        return { valid: false, error: 'quota' };
      }
      if (error?.errors?.[0]?.reason === 'accessNotConfigured' || error?.code === 403) {
        return { valid: false, error: 'api_not_enabled' };
      }
      if (error?.code === 400) {
        return { valid: false, error: 'invalid_key' };
      }
      return { valid: false, error: 'unknown' };
    } catch (e) {
      return { valid: false, error: 'network' };
    }
  };

  // Load saved key on page load
  chrome.storage.sync.get(['userApiKey'], (res) => {
    if (res.userApiKey) {
      keyInput.value = res.userApiKey;
      showStatus('✅ Your API key is loaded and ready!', 'success');
    }
  });

  // Save button handler
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const k = keyInput.value.trim();
    if (!k) {
      showStatus('⚠️ Please paste your YouTube API key first.', 'warning');
      keyInput.classList.add('shake');
      setTimeout(() => keyInput.classList.remove('shake'), 500);
      keyInput.focus();
      return;
    }
    
    // Show testing status
    showStatus('🔄 Testing your API key...', 'warning');
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.classList.add('loading');
    
    const result = await testApiKey(k);
    saveBtn.classList.remove('loading');
    
    if (result.valid) {
      chrome.storage.sync.set({ userApiKey: k }, () => {
        showStatus('✅ Key saved! Your API key is working perfectly.', 'success');
      });
    } else if (result.error === 'quota') {
      // Still save the key, but warn about quota
      chrome.storage.sync.set({ userApiKey: k }, () => {
        showStatus('⚠️ Key saved, but your daily quota is exhausted. It resets at midnight Pacific Time.', 'warning');
      });
    } else if (result.error === 'api_not_enabled') {
      showStatus('❌ YouTube Data API v3 is not enabled. Please enable it in Google Cloud Console first.', 'error');
      keyInput.classList.add('shake');
      setTimeout(() => keyInput.classList.remove('shake'), 500);
    } else if (result.error === 'invalid_key') {
      showStatus('❌ This API key appears to be invalid. Please check and try again.', 'error');
      keyInput.classList.add('shake');
      setTimeout(() => keyInput.classList.remove('shake'), 500);
    } else {
      // Save anyway for other errors (might be temporary)
      chrome.storage.sync.set({ userApiKey: k }, () => {
        showStatus('✅ Key saved! If you face issues, check your Google Cloud Console.', 'success');
      });
    }
  });

  // Clear button handler
  document.getElementById('clearBtn').addEventListener('click', () => {
    chrome.storage.sync.remove(['userApiKey'], () => {
      keyInput.value = '';
      showStatus('🗑️ Key removed successfully.', 'warning');
      keyInput.focus();
    });
  });

  // Add keyboard shortcut (Enter to save)
  keyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('saveBtn').click();
    }
  });
});
