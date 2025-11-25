
export function register(config?: any) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Construct absolute URL based on current location to avoid origin mismatch
      let swUrl = 'service-worker.js';
      try {
        // Only attempt to construct URL if protocol is http or https to avoid "Invalid URL" errors
        if (window.location.protocol.startsWith('http')) {
            swUrl = new URL('service-worker.js', window.location.href).href;
        }
      } catch (e) {
        console.warn('Failed to construct absolute ServiceWorker URL, using relative path.');
      }

      registerValidSW(swUrl, config);
    });
  }
}

function registerValidSW(swUrl: string, config?: any) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log(
                'New content is available and will be used when all tabs for this page are closed.'
              );
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              console.log('Content is cached for offline use.');
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
