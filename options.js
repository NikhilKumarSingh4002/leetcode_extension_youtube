document.addEventListener('DOMContentLoaded', () => {
  const keyInput = document.getElementById('ytKey');
  const status = document.getElementById('status');
  chrome.storage.sync.get(['userApiKey'], (res) => {
    if (res.userApiKey) keyInput.value = res.userApiKey;
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const k = keyInput.value.trim();
    if (!k) return alert('Please paste your YouTube API key first.');
    chrome.storage.sync.set({ userApiKey: k }, () => {
      status.textContent = '✅ Key saved locally. You are good to go.';
    });
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    chrome.storage.sync.remove(['userApiKey'], () => {
      keyInput.value='';
      status.textContent = 'Key removed.';
    });
  });
});
