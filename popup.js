document.addEventListener('DOMContentLoaded', () => {
  const statusContainer = document.getElementById('statusContainer');
  const statusLabel = document.getElementById('statusLabel');
  const statusDesc = document.getElementById('statusDesc');
  const apiStatus = document.getElementById('apiStatus');
  const apiText = document.getElementById('apiText');
  const optionsBtn = document.getElementById('optionsBtn');

  // Check if on LeetCode problem page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const url = tab?.url || '';
    
    if (url.includes('leetcode.com/problems/')) {
      // Active on a problem page
      statusContainer.classList.add('active');
      statusLabel.textContent = 'Extension Active';
      statusDesc.textContent = 'Click "Show Videos" on the page';
    } else if (url.includes('leetcode.com')) {
      // On LeetCode but not a problem page
      statusLabel.textContent = 'Almost There!';
      statusDesc.textContent = 'Open a problem to see solutions';
    } else {
      // Not on LeetCode
      statusLabel.textContent = 'Extension Inactive';
      statusDesc.textContent = 'Visit a LeetCode problem to activate';
    }
  });

  // Check API key status
  chrome.storage.sync.get(['userApiKey'], (result) => {
    if (result.userApiKey) {
      apiStatus.classList.add('configured');
      apiStatus.classList.remove('not-configured');
      apiText.textContent = '✓ API key configured';
    } else {
      apiStatus.classList.add('not-configured');
      apiStatus.classList.remove('configured');
      apiText.textContent = '✗ API key not set - Click Settings';
    }
  });

  // Open options page
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Add ripple effect to buttons
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        background: rgba(255,255,255,0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
      `;
      
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
      
      this.style.position = 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });

  // Add ripple animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ripple {
      to { transform: scale(4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
});
