
import confetti from 'canvas-confetti';
import { useCallback } from 'react';

// A pleasant, short success chime
const SUCCESS_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3';

export const useCelebration = () => {
  const triggerCelebration = useCallback(() => {
    // 1. Trigger Confetti
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999, // Ensure on top of modals
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });

    // 2. Play Sound (if enabled)
    try {
      const settingsStr = localStorage.getItem('promanage_settings_v1');
      const settings = settingsStr ? JSON.parse(settingsStr) : { soundEnabled: true };
      
      if (settings.soundEnabled !== false) { // Default to true
        const audio = new Audio(SUCCESS_SOUND_URL);
        audio.volume = 0.4;
        audio.play().catch(e => {
            // Browsers might block autoplay if no interaction, usually drag/click is enough
            console.warn("Audio play prevented:", e);
        });
      }
    } catch (e) {
      console.error("Celebration error", e);
    }
  }, []);

  return { triggerCelebration };
};
