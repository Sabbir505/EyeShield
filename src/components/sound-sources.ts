import type { AmbientSound } from '../../shared/types';

import rainUrl from '../assets/sounds/rain.wav';
import wavesUrl from '../assets/sounds/waves.wav';
import whitenoiseUrl from '../assets/sounds/whitenoise.wav';

export const SOURCES: Record<Exclude<AmbientSound, 'none'>, string> = {
  rain: rainUrl,
  waves: wavesUrl,
  whitenoise: whitenoiseUrl,
};
