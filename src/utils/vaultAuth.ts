import {
  fetchVaultSettingFromFirestore,
  saveVaultSettingToFirestore,
} from '../firebase';
import { VaultSettingDoc } from '../types';

/**
 * LinkPix Master Vault Passcode Gate & Cryptographic Verification
 * Walls the site behind a master passcode with SHA-256 hashing and anti-brute force cooldowns.
 * Synchronized globally across all devices and browsers via Firestore cloud settings.
 */

const STORAGE_HASH_KEY = 'linkpix_vault_hash';
const STORAGE_SALT_KEY = 'linkpix_vault_salt';
const STORAGE_CUSTOM_KEY = 'linkpix_vault_is_custom';
const SESSION_UNLOCKED_KEY = 'linkpix_vault_unlocked';
const LOCAL_REMEMBERED_KEY = 'linkpix_vault_remembered';
const UNLOCKED_HASH_KEY = 'linkpix_vault_unlocked_hash';
const FAILED_ATTEMPTS_KEY = 'linkpix_vault_failed_attempts';
const LOCKOUT_TIMESTAMP_KEY = 'linkpix_vault_lockout_until';

export const DEFAULT_SITE_PASSWORD = 'linkpix';
export const DEFAULT_VAULT_SALT = 'linkpix_default_vault_salt_v1';
const MAX_ATTEMPTS_BEFORE_COOLDOWN = 5;
const COOLDOWN_DURATION_MS = 30000; // 30 seconds

// Default precomputed SHA-256 hash for ('linkpix', 'linkpix_default_vault_salt_v1')
const DEFAULT_PRECOMPUTED_HASH =
  'fa08b3b2f45662ee9af0a50c2de8cd912460e0d915d59588cfc3b8ce880daec4';

let activeVaultSetting: VaultSettingDoc = {
  id: 'vault',
  hash: DEFAULT_PRECOMPUTED_HASH,
  salt: DEFAULT_VAULT_SALT,
  isCustom: false,
  updatedAt: '',
};

type VaultChangeListener = (setting: VaultSettingDoc) => void;
const vaultListeners: Set<VaultChangeListener> = new Set();

export function subscribeToVaultAuthChanges(listener: VaultChangeListener): () => void {
  vaultListeners.add(listener);
  return () => {
    vaultListeners.delete(listener);
  };
}

function notifyVaultListeners(setting: VaultSettingDoc): void {
  vaultListeners.forEach((fn) => {
    try {
      fn(setting);
    } catch (e) {
      console.warn('Error in vault change listener:', e);
    }
  });
}

/**
 * Pure JavaScript SHA-256 implementation.
 * Ensures cryptographic hashing NEVER fails, even on mobile WebViews, older iOS Safari,
 * or HTTP / local IP contexts where window.crypto.subtle is undefined.
 */
function sha256Pure(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];

  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = candidate * candidate; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < asciiBitLength; i += 8) {
    words[i >> 5] |= (ascii.charCodeAt(i / 8) & 0xff) << (24 - (i % 32));
  }

  for (j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash.slice(0);

    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15] || 0;
      const w2 = w[i - 2] || 0;

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i] || 0
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Generates a cryptographic SHA-256 hash for a given password and salt
 */
export async function computeHash(password: string, salt: string): Promise<string> {
  const peppered = `linkpix_pepper_${password}_salt_${salt}`;

  // Use Web Crypto API if available in secure context
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(peppered);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback to pure JS below
    }
  }

  // Fallback to pure JS implementation
  return sha256Pure(peppered);
}

/**
 * Generates a cryptographically secure random salt (32 hex characters)
 */
export function generateSalt(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      return Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // fallback
  }

  let s = '';
  for (let i = 0; i < 32; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}

/**
 * Returns currently active vault hash
 */
export function getActiveVaultHash(): string {
  return activeVaultSetting.hash;
}

/**
 * Updates in-memory state and local cache from a Firestore VaultSettingDoc
 */
export function applyCloudVaultSetting(cloudSetting: VaultSettingDoc | null): void {
  if (!cloudSetting || !cloudSetting.hash || !cloudSetting.salt) return;
  activeVaultSetting = { ...cloudSetting };
  try {
    localStorage.setItem(STORAGE_HASH_KEY, cloudSetting.hash);
    localStorage.setItem(STORAGE_SALT_KEY, cloudSetting.salt);
    localStorage.setItem(STORAGE_CUSTOM_KEY, cloudSetting.isCustom ? 'true' : 'false');
  } catch {
    // Ignore localStorage failures in private browsing mode
  }
  notifyVaultListeners(activeVaultSetting);
}

/**
 * Ensures the password vault is initialized with authoritative credentials from Firestore.
 * Never silently overwrites cloud settings with defaults on initialization.
 */
export async function initializeVaultCredentials(): Promise<VaultSettingDoc> {
  // 1. First attempt to load authoritative settings from Firestore server
  try {
    const cloudSetting = await fetchVaultSettingFromFirestore();
    if (cloudSetting && cloudSetting.hash && cloudSetting.salt) {
      applyCloudVaultSetting(cloudSetting);
      return cloudSetting;
    }
  } catch (err) {
    console.warn('Could not sync vault from cloud during init:', err);
  }

  // 2. Fall back to local storage cache if available
  try {
    const cachedHash = localStorage.getItem(STORAGE_HASH_KEY);
    const cachedSalt = localStorage.getItem(STORAGE_SALT_KEY);
    const isCustomCached = localStorage.getItem(STORAGE_CUSTOM_KEY) === 'true';

    if (cachedHash && cachedSalt) {
      activeVaultSetting = {
        id: 'vault',
        hash: cachedHash,
        salt: cachedSalt,
        isCustom: isCustomCached,
        updatedAt: '',
      };
      return activeVaultSetting;
    }
  } catch {
    // ignore
  }

  // 3. Fall back to standard default credentials
  return activeVaultSetting;
}

/**
 * Checks if a custom (non-default) password has been configured by the owner
 */
export function hasCustomPassword(): boolean {
  if (activeVaultSetting.isCustom) return true;
  try {
    return localStorage.getItem(STORAGE_CUSTOM_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Checks whether the current session is authenticated and unlocked.
 * Automatically invalidates local sessions if the vault passcode was updated on another device.
 */
export function isSiteUnlocked(): boolean {
  try {
    const sessionUnlocked = sessionStorage.getItem(SESSION_UNLOCKED_KEY) === 'true';
    const deviceRemembered = localStorage.getItem(LOCAL_REMEMBERED_KEY) === 'true';

    if (!sessionUnlocked && !deviceRemembered) {
      return false;
    }

    // Verify session matches current vault hash
    const unlockedHash =
      sessionStorage.getItem(UNLOCKED_HASH_KEY) ||
      localStorage.getItem(UNLOCKED_HASH_KEY);

    // If a specific hash was recorded upon unlock, verify it still matches current active hash
    if (unlockedHash && activeVaultSetting.hash && unlockedHash !== activeVaultSetting.hash) {
      // Passcode was changed on another device! Invalidate session
      lockSite();
      return false;
    }

    if (deviceRemembered && !sessionUnlocked) {
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
      if (activeVaultSetting.hash) {
        sessionStorage.setItem(UNLOCKED_HASH_KEY, activeVaultSetting.hash);
      }
    }

    return true;
  } catch {
    // If storage access is restricted, default to locked
    return false;
  }
}

/**
 * Unlocks the site for the current session, with optional device remembrance
 */
export function unlockSite(rememberOnDevice = false): void {
  try {
    sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
    if (activeVaultSetting.hash) {
      sessionStorage.setItem(UNLOCKED_HASH_KEY, activeVaultSetting.hash);
    }

    if (rememberOnDevice) {
      localStorage.setItem(LOCAL_REMEMBERED_KEY, 'true');
      if (activeVaultSetting.hash) {
        localStorage.setItem(UNLOCKED_HASH_KEY, activeVaultSetting.hash);
      }
    } else {
      localStorage.removeItem(LOCAL_REMEMBERED_KEY);
      localStorage.removeItem(UNLOCKED_HASH_KEY);
    }

    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_TIMESTAMP_KEY);
  } catch {
    // ignore
  }
}

/**
 * Locks the site immediately, clearing all session & stored unlock tokens
 */
export function lockSite(): void {
  try {
    sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
    sessionStorage.removeItem(UNLOCKED_HASH_KEY);
    localStorage.removeItem(LOCAL_REMEMBERED_KEY);
    localStorage.removeItem(UNLOCKED_HASH_KEY);
  } catch {
    // ignore
  }
}

/**
 * Check if the site is currently in an anti-brute-force lockout state
 */
export function getRemainingLockoutSeconds(): number {
  try {
    const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_TIMESTAMP_KEY) || '0', 10);
    if (!lockoutUntil) return 0;
    const now = Date.now();
    if (now >= lockoutUntil) {
      localStorage.removeItem(LOCKOUT_TIMESTAMP_KEY);
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      return 0;
    }
    return Math.ceil((lockoutUntil - now) / 1000);
  } catch {
    return 0;
  }
}

/**
 * Verifies an entered password against the authoritative SHA-256 hash.
 * Pulls the latest cloud setting from Firestore before checking to ensure real-time accuracy across devices.
 */
export async function verifyPassword(passwordInput: string): Promise<{
  success: boolean;
  error?: string;
  remainingSeconds?: number;
}> {
  // Check lockout
  const remainingLockout = getRemainingLockoutSeconds();
  if (remainingLockout > 0) {
    return {
      success: false,
      error: `Too many incorrect attempts. Please wait ${remainingLockout} seconds.`,
      remainingSeconds: remainingLockout,
    };
  }

  // Always attempt to fetch the latest settings directly from Firestore before verifying
  try {
    const cloudSetting = await fetchVaultSettingFromFirestore();
    if (cloudSetting && cloudSetting.hash && cloudSetting.salt) {
      applyCloudVaultSetting(cloudSetting);
    }
  } catch {
    // use local/in-memory cache if network is temporarily unreachable
  }

  const saltToUse =
    activeVaultSetting.salt ||
    localStorage.getItem(STORAGE_SALT_KEY) ||
    DEFAULT_VAULT_SALT;

  const targetHash =
    activeVaultSetting.hash ||
    localStorage.getItem(STORAGE_HASH_KEY) ||
    DEFAULT_PRECOMPUTED_HASH;

  const candidateHash = await computeHash(passwordInput.trim(), saltToUse);

  if (candidateHash === targetHash) {
    try {
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_TIMESTAMP_KEY);
    } catch {
      // ignore
    }
    return { success: true };
  }

  // Handle failure & rate-limiting
  let failedCount = 1;
  try {
    failedCount = parseInt(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '0', 10) + 1;
    localStorage.setItem(FAILED_ATTEMPTS_KEY, failedCount.toString());
  } catch {
    // ignore
  }

  if (failedCount >= MAX_ATTEMPTS_BEFORE_COOLDOWN) {
    const lockoutUntil = Date.now() + COOLDOWN_DURATION_MS;
    try {
      localStorage.setItem(LOCKOUT_TIMESTAMP_KEY, lockoutUntil.toString());
    } catch {
      // ignore
    }
    const seconds = Math.ceil(COOLDOWN_DURATION_MS / 1000);
    return {
      success: false,
      error: `Too many incorrect attempts. Locked for ${seconds} seconds.`,
      remainingSeconds: seconds,
    };
  }

  const attemptsLeft = MAX_ATTEMPTS_BEFORE_COOLDOWN - failedCount;
  return {
    success: false,
    error: `Incorrect passcode. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before temporary cooldown.`,
  };
}

/**
 * Changes the vault password after validating the current password.
 * Saves to Firestore first to guarantee persistence across all other phones and devices,
 * then updates local caches and unlocks current session with new hash.
 */
export async function changeVaultPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.trim().length < 4) {
    return { success: false, error: 'New passcode must be at least 4 characters.' };
  }

  const verify = await verifyPassword(currentPassword);
  if (!verify.success) {
    return { success: false, error: verify.error || 'Current passcode is incorrect.' };
  }

  // Generate a cryptographically secure random salt (32 hex characters)
  const newSalt = generateSalt();
  const newHash = await computeHash(newPassword.trim(), newSalt);

  const newSettingDoc: VaultSettingDoc = {
    id: 'vault',
    hash: newHash,
    salt: newSalt,
    isCustom: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'master_owner',
  };

  // 1. Persist to Firestore cloud database FIRST
  try {
    await saveVaultSettingToFirestore(newSettingDoc);
  } catch (err: unknown) {
    console.error('CRITICAL: Failed to sync new passcode to Firestore:', err);
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Could not save passcode to cloud database: ${message}. Check internet connection and retry.`,
    };
  }

  // 2. Update local state and memory cache
  applyCloudVaultSetting(newSettingDoc);

  // 3. Keep current session unlocked with the new hash
  unlockSite(true);

  return { success: true };
}

/**
 * Resets the password back to default on Firestore AND local storage
 */
export async function resetToDefaultPassword(): Promise<void> {
  const defaultDoc: VaultSettingDoc = {
    id: 'vault',
    hash: DEFAULT_PRECOMPUTED_HASH,
    salt: DEFAULT_VAULT_SALT,
    isCustom: false,
    updatedAt: new Date().toISOString(),
    updatedBy: 'reset_default',
  };

  await saveVaultSettingToFirestore(defaultDoc);
  applyCloudVaultSetting(defaultDoc);
  unlockSite(true);

  try {
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_TIMESTAMP_KEY);
  } catch {
    // ignore
  }
}
