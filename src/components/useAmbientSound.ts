import { useEffect, useRef } from 'react';
import type { AmbientSound } from '../../shared/types';
import { SOURCES } from './sound-sources';

/**
 * Plays an ambient loop while the overlay is mounted. Stops + unloads on
 * unmount (i.e., when the break ends). `soundOn` gates playback entirely;
 * `ambientSound` selects the loop. 'none' is silent.
 */
export function useAmbientSound(soundOn: boolean, ambientSound: AmbientSound) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!soundOn || ambientSound === 'none') return;

    const audio = new Audio(SOURCES[ambientSound]);
    audio.loop = true;
    audio.volume = 0.6;
    audioRef.current = audio;

    // Some browsers throw if play() is called without user gesture.
    // Electron renderer generally allows it; ignore the rejection silently.
    audio.play().catch(() => {});

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [soundOn, ambientSound]);
}
