import { Platform } from 'react-native';

type SoundType = 'click' | 'success' | 'error' | 'timer' | 'game-start';

const SOUND_URLS: Record<SoundType, string> = {
    // Using placeholder sounds or data URIs for now. 
    // In a real app these would be local assets or hosted files.
    'click': 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', // Placeholder silent/short click (to stop error), will need real base64 or valid URL
    'success': 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/bonus.wav', // Positive ping
    'error': 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/player_shoot.wav', // Placeholder flat sound
    'timer': 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/pause.wav', // Short blip (reused for ticking)
    'game-start': 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/theme_01.mp3', // Longer intro
};

class AudioService {
    private enabled: boolean = true;
    private sounds: Partial<Record<SoundType, HTMLAudioElement>> = {};

    constructor() {
        if (Platform.OS === 'web') {
            // Preload sounds
            Object.entries(SOUND_URLS).forEach(([key, url]) => {
                const audio = new Audio(url);
                this.sounds[key as SoundType] = audio;
            });
        }
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    async play(type: SoundType) {
        if (!this.enabled || Platform.OS !== 'web') return;

        try {
            const sound = this.sounds[type];
            if (sound) {
                sound.currentTime = 0;
                await sound.play();
            } else {
                // Fallback direct play
                const audio = new Audio(SOUND_URLS[type]);
                await audio.play();
            }
        } catch (error) {
            console.warn(`Failed to play sound ${type}:`, error);
        }
    }
}

export const audioService = new AudioService();
