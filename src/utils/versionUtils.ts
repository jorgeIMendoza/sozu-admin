import { APP_VERSION } from '@/lib/config';
 
 const PRODUCTION_URL = 'https://sozu-admin.lovable.app';

/**
 * Fetch the server version from version.json (with cache busting)
 */
export async function fetchServerVersion(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.version;
  } catch {
    return null;
  }
}

/**
 * Clear all Service Workers and caches, then force a full page reload
 */
export async function clearCacheAndReload(): Promise<void> {
  // 1. Unregister all Service Workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }
  }
  
  // 2. Clear all caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      await caches.delete(name);
    }
  }
  
  // 3. Force full page reload
  window.location.reload();
}

/**
 * Check if there's a newer version available on the server
 */
export async function checkForUpdates(): Promise<boolean> {
  const serverVersion = await fetchServerVersion();
  if (!serverVersion) return false;
  return serverVersion !== APP_VERSION;
}
 
 /**
  * Fetch the production version from the live production server
  */
 export async function fetchProductionVersion(): Promise<{ version: string; buildTime: number } | null> {
   try {
     const response = await fetch(`${PRODUCTION_URL}/version.json?t=${Date.now()}`, {
       cache: 'no-store',
       headers: { 'Cache-Control': 'no-cache' }
     });
     if (!response.ok) return null;
     return await response.json();
   } catch {
     return null;
   }
 }
