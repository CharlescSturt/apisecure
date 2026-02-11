// crypto.ts - Hardened AES-256-GCM encryption for browser
// Uses Web Crypto API - no server needed
// Format: SECDROP-P:base64(format_version + algo_version + salt + iv + ciphertext + authTag)
// AAD: "api-key-secure-send-v1" (binds ciphertext to context)

// Format version (wire format)
const FORMAT_VERSION = 0x02;

// Algorithm version (key derivation method)
// 0x01 = PBKDF2-SHA256 (100k rounds)
// 0x02 = Argon2id (reserved for future WASM implementation)
const ALGO_VERSION_PBKDF2 = 0x01;
const ALGO_VERSION_ARGON2 = 0x02;

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM recommended
const SALT_LENGTH = 16;

// AAD binds ciphertext to specific application context
// Prevents format confusion attacks (e.g., using this ciphertext in another app)
const AAD_CONTEXT = new TextEncoder().encode('api-key-secure-send-v1');

/**
 * Encrypt API key with passphrase
 * Returns SECDROP-P:base64 format with AAD binding
 * 
 * Security features:
 * - AES-256-GCM authenticated encryption
 * - PBKDF2 key derivation (100k rounds) - resistant to GPU cracking
 * - Unique salt and IV per encryption
 * - AAD binds ciphertext to "api-key-secure-send-v1" context
 * - Auth tag prevents tampering
 */
async function encryptSecureDrop(apiKey: string, passphrase: string): Promise<string> {
  // Generate random salt and IV using CSPRNG
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Derive AES-256 key from passphrase using PBKDF2
  // NOTE: Web Crypto API doesn't support Argon2id natively.
  // For future Argon2id support, we'd need WASM implementation.
  // PBKDF2 with 100k rounds provides adequate resistance for current threat model.
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH * 8 },
    false,
    ['encrypt']
  );
  
  // Encrypt with AAD binding
  // AAD is authenticated but not encrypted - prevents ciphertext misuse
  const plaintext = new TextEncoder().encode(apiKey);
  const ciphertext = await crypto.subtle.encrypt(
    { 
      name: 'AES-GCM', 
      iv: iv,
      additionalData: AAD_CONTEXT // Bind to application context
    },
    key,
    plaintext
  );
  
  // Extract auth tag (last 16 bytes of ciphertext in Web Crypto)
  const ciphertextBytes = new Uint8Array(ciphertext);
  const actualCiphertext = ciphertextBytes.slice(0, -16);
  const authTag = ciphertextBytes.slice(-16);
  
  // Pack binary format:
  // [0]: format version (0x02)
  // [1]: algorithm version (0x01 = PBKDF2)
  // [2-17]: salt (16 bytes)
  // [18-29]: IV (12 bytes)
  // [30..-17]: ciphertext
  // [-16..]: auth tag (16 bytes)
  const versionByte = new Uint8Array([FORMAT_VERSION]);
  const algoByte = new Uint8Array([ALGO_VERSION_PBKDF2]);
  
  const packed = new Uint8Array(
    1 + 1 + SALT_LENGTH + IV_LENGTH + actualCiphertext.length + 16
  );
  
  let offset = 0;
  packed.set(versionByte, offset); offset += 1;
  packed.set(algoByte, offset); offset += 1;
  packed.set(salt, offset); offset += SALT_LENGTH;
  packed.set(iv, offset); offset += IV_LENGTH;
  packed.set(actualCiphertext, offset); offset += actualCiphertext.length;
  packed.set(authTag, offset);
  
  // Encode as base64
  const base64 = btoa(String.fromCharCode(...packed));
  
  return 'SECDROP-P:' + base64;
}

/**
 * Generate a cryptographically secure random passphrase
 * Uses CSPRNG for character selection
 */
function generatePassphrase(length = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Parse encrypted payload to extract components
 * Useful for debugging and validation
 */
function parseSecureDropPayload(payload: string): {
  formatVersion: number;
  algoVersion: number;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertextLength: number;
} | null {
  if (!payload.startsWith('SECDROP-P:')) {
    return null;
  }
  
  try {
    const data = Uint8Array.from(
      atob(payload.slice(10)), 
      c => c.charCodeAt(0)
    );
    
    if (data.length < 2 + SALT_LENGTH + IV_LENGTH + 16) {
      return null;
    }
    
    return {
      formatVersion: data[0],
      algoVersion: data[1],
      salt: data.slice(2, 2 + SALT_LENGTH),
      iv: data.slice(2 + SALT_LENGTH, 2 + SALT_LENGTH + IV_LENGTH),
      ciphertextLength: data.length - (2 + SALT_LENGTH + IV_LENGTH + 16)
    };
  } catch {
    return null;
  }
}

export { encryptSecureDrop, generatePassphrase, parseSecureDropPayload };
export { FORMAT_VERSION, ALGO_VERSION_PBKDF2, ALGO_VERSION_ARGON2, AAD_CONTEXT };