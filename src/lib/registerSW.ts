/**
 * Service Worker Registration & PWA Install Hook
 * AzFIT Coaching — Phase 1: PWA Core
 */

import { useState, useEffect, useCallback } from 'react';

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  updateAvailable: boolean;
  installPrompt: (() => Promise<void>) | null;
  dismissUpdate: () => void;
}

let deferredPrompt: Event | null = null;

/**
 * Register the service worker.
 * Skips in development to avoid Vite HMR conflicts.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service workers not supported in this browser');
    return;
  }

  // Skip SW registration in dev mode (Vite handles HMR)
  if (import.meta.env.DEV) {
    console.log('[PWA] Skipping SW registration in development');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);

        // Phase 33A Fix 3: check for a new SW on every load, so open tabs
        // pick up deploys promptly instead of serving stale chunk maps.
        registration.update().catch(() => {});

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version available — refresh to update');
                window.dispatchEvent(new CustomEvent('sw-update-available'));
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });

    // Listen for controller changes (new SW activated): reload ONCE so the
    // tab picks up the new build's chunk map. The 10s window guard prevents
    // any reload loop while still allowing future updates in the same tab.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const last = Number(sessionStorage.getItem('sw-reload-at') || 0);
      if (Date.now() - last < 10000) {
        console.log('[PWA] New service worker activated (reload suppressed — already reloaded)');
        return;
      }
      console.log('[PWA] New service worker activated — reloading once');
      sessionStorage.setItem('sw-reload-at', String(Date.now()));
      window.location.reload();
    });
  });
}

/**
 * React hook for PWA state management.
 * Use in components to show install prompts or offline indicators.
 */
export function usePWA(): PWAState {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode) — schedule to avoid cascading render
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    
    const timer = setTimeout(() => {
      setIsInstalled(isStandalone);
    }, 0);

    // Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setIsInstallable(true);
    };

    // Handle appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPrompt = null;
    };

    // Handle online/offline
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // Handle SW update available
    const handleUpdateAvailable = () => setUpdateAvailable(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sw-update-available', handleUpdateAvailable);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const installPrompt = useCallback(async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt as unknown as {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setIsInstallable(false);
    deferredPrompt = null;
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return {
    isInstallable,
    isInstalled,
    isOffline,
    updateAvailable,
    installPrompt: isInstallable ? installPrompt : null,
    dismissUpdate,
  };
}

