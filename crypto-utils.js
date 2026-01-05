// crypto-utils.js - AES-GCM encryption utilities for secure API key storage

const CryptoUtils = {
  // In-memory cache for decrypted key (avoids repeated decryption)
  _cache: {
    key: null,
    timestamp: 0,
    TTL: 5 * 60 * 1000 // 5 minutes cache TTL
  },

  // Generate a new AES-GCM key
  async generateKey() {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  },

  // Export key to raw format for storage
  async exportKey(key) {
    const exported = await crypto.subtle.exportKey('raw', key);
    return this._arrayBufferToBase64(exported);
  },

  // Import key from raw format
  async importKey(keyData) {
    const raw = this._base64ToArrayBuffer(keyData);
    return await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  },

  // Encrypt plaintext using AES-GCM
  async encrypt(plaintext, key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // Generate random IV (12 bytes recommended for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    return {
      iv: this._arrayBufferToBase64(iv),
      data: this._arrayBufferToBase64(encrypted)
    };
  },

  // Decrypt ciphertext using AES-GCM
  async decrypt(encryptedObj, key) {
    const iv = this._base64ToArrayBuffer(encryptedObj.iv);
    const data = this._base64ToArrayBuffer(encryptedObj.data);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  },

  // Save encrypted API key to chrome.storage.local
  async saveApiKey(apiKey) {
    try {
      // Generate new key for each save (more secure)
      const cryptoKey = await this.generateKey();
      const exportedKey = await this.exportKey(cryptoKey);
      const encrypted = await this.encrypt(apiKey, cryptoKey);

      // Store IV, encrypted data, and exported key
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({
          encryptedApiKey: {
            iv: encrypted.iv,
            data: encrypted.data,
            key: exportedKey,
            version: 1 // For future migration support
          }
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            // Update cache
            this._cache.key = apiKey;
            this._cache.timestamp = Date.now();
            resolve();
          }
        });
      });
    } catch (e) {
      console.error('Failed to encrypt and save API key:', e);
      throw e;
    }
  },

  // Load and decrypt API key from chrome.storage.local
  async loadApiKey() {
    // Check cache first
    if (this._cache.key && (Date.now() - this._cache.timestamp) < this._cache.TTL) {
      return this._cache.key;
    }

    return new Promise((resolve) => {
      chrome.storage.local.get(['encryptedApiKey'], async (result) => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          resolve('');
          return;
        }

        const stored = result.encryptedApiKey;
        if (!stored || !stored.iv || !stored.data || !stored.key) {
          resolve('');
          return;
        }

        try {
          const cryptoKey = await this.importKey(stored.key);
          const decrypted = await this.decrypt(
            { iv: stored.iv, data: stored.data },
            cryptoKey
          );
          
          // Update cache
          this._cache.key = decrypted;
          this._cache.timestamp = Date.now();
          
          resolve(decrypted);
        } catch (e) {
          console.error('Failed to decrypt API key:', e);
          resolve('');
        }
      });
    });
  },

  // Remove encrypted API key from storage
  async removeApiKey() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['encryptedApiKey'], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          // Clear cache
          this._cache.key = null;
          this._cache.timestamp = 0;
          resolve();
        }
      });
    });
  },

  // Check if API key exists (without decrypting)
  async hasApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['encryptedApiKey'], (result) => {
        const stored = result.encryptedApiKey;
        resolve(!!(stored && stored.iv && stored.data && stored.key));
      });
    });
  },

  // Clear the in-memory cache
  clearCache() {
    this._cache.key = null;
    this._cache.timestamp = 0;
  },

  // Utility: ArrayBuffer to Base64
  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  // Utility: Base64 to ArrayBuffer
  _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
};

// Make available globally for use in other scripts
if (typeof window !== 'undefined') {
  window.CryptoUtils = CryptoUtils;
}
