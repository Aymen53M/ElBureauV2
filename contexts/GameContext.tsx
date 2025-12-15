import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from './LanguageContext';

export type GamePhase =
    | 'lobby'
    | 'betting'
    | 'question'
    | 'answering'
    | 'preview'
    | 'reveal'
    | 'validation'
    | 'scoring'
    | 'final-wager'
    | 'final-question'
    | 'final-validation'
    | 'final-scoring'
    | 'results';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type QuestionType = 'multiple-choice' | 'open-ended' | 'true-false';

export interface Player {
    id: string;
    name: string;
    score: number;
    isHost: boolean;
    isReady: boolean;
    currentBet?: number;
    currentAnswer?: string;
    usedBets: number[];
    hasApiKey: boolean;
    language?: Language;
    avatar?: string;
}

export interface Question {
    id: string;
    text: string;
    type: QuestionType;
    options?: string[];
    correctAnswer: string;
    hint?: string;
    difficulty: Difficulty;
}

export interface GameSettings {
    theme: string;
    customTheme?: string;
    difficulty: Difficulty;
    numberOfQuestions: number;
    timePerQuestion: number;
    questionType: QuestionType;
    language: Language;
    hintsEnabled: boolean;
    soundEnabled: boolean;
    animationsEnabled: boolean;
}

export interface GameState {
    roomCode: string;
    phase: GamePhase;
    players: Player[];
    currentQuestion: number;
    questions: Question[];
    settings: GameSettings;
    hostId: string;
    hostApiKey?: string;
    playerApiKeys?: Record<string, string>;
    answers: Record<string, { playerId: string; answer: string; isCorrect?: boolean }>;
    difficultyVotes?: Record<string, Difficulty>;
}

interface GameContextType {
    gameState: GameState | null;
    setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
    currentPlayer: Player | null;
    setCurrentPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
    apiKey: string;
    setApiKey: (key: string) => Promise<void>;
    playerName: string;
    setPlayerName: (name: string) => Promise<void>;
    deviceId: string;
    playerId: string;
    // Settings actions
    setSoundEnabled: (enabled: boolean) => Promise<void>;
    setAnimationsEnabled: (enabled: boolean) => Promise<void>;
    soundEnabled: boolean;
    animationsEnabled: boolean;
}

const API_KEY_STORAGE_KEY = 'elbureau-api-key';
const PLAYER_NAME_STORAGE_KEY = 'elbureau-player-name';
const DEVICE_ID_STORAGE_KEY = 'elbureau-device-id';

const defaultSettings: GameSettings = {
    theme: 'movies',
    difficulty: 'medium',
    numberOfQuestions: 10,
    timePerQuestion: 30,
    questionType: 'multiple-choice',
    language: 'en',
    hintsEnabled: true,
    soundEnabled: true,
    animationsEnabled: true,
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
    const [apiKey, setApiKeyState] = useState('');
    const [playerName, setPlayerNameState] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [soundEnabled, setSoundEnabledState] = useState(defaultSettings.soundEnabled);
    const [animationsEnabled, setAnimationsEnabledState] = useState(defaultSettings.animationsEnabled);

    // Load saved data on mount
    useEffect(() => {
        const loadSavedData = async () => {
            try {
                // Load API key from secure storage
                const savedApiKey = await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
                if (savedApiKey) {
                    setApiKeyState(savedApiKey);
                }

                // Load player name from async storage
                const savedName = await AsyncStorage.getItem(PLAYER_NAME_STORAGE_KEY);
                if (savedName) {
                    setPlayerNameState(savedName);
                }

                const savedDeviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
                if (savedDeviceId) {
                    setDeviceId(savedDeviceId);
                } else {
                    const nextId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
                    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
                    setDeviceId(nextId);
                }

                // Load settings
                const savedSound = await AsyncStorage.getItem('elbureau-sound-enabled');
                if (savedSound !== null) {
                    setSoundEnabledState(savedSound === 'true');
                }
                const savedAnimations = await AsyncStorage.getItem('elbureau-animations-enabled');
                if (savedAnimations !== null) {
                    setAnimationsEnabledState(savedAnimations === 'true');
                }
            } catch (error) {
                console.error('Failed to load saved data:', error);
            }
        };
        loadSavedData();
    }, []);

    useEffect(() => {
        if (!apiKey || !currentPlayer?.id) return;
        setGameState((prev) => {
            if (!prev) return prev;
            const nextHostApiKey = currentPlayer.id === prev.hostId ? apiKey : prev.hostApiKey;
            const nextPlayerApiKeys = {
                ...prev.playerApiKeys,
                [currentPlayer.id]: apiKey,
            };

            const noChange =
                (prev.hostApiKey || '') === (nextHostApiKey || '') &&
                (prev.playerApiKeys?.[currentPlayer.id] || '') === apiKey;
            if (noChange) return prev;

            return {
                ...prev,
                hostApiKey: nextHostApiKey,
                playerApiKeys: nextPlayerApiKeys,
            };
        });
    }, [apiKey, currentPlayer?.id]);

    const playerId = deviceId;

    const setApiKey = async (key: string) => {
        try {
            await AsyncStorage.setItem(API_KEY_STORAGE_KEY, key);
            setApiKeyState(key);

            // Keep the game state's player key ledger in sync so hosts/personal rounds
            // always use the correct player's saved key.
            setGameState((prev) => {
                if (!prev || !currentPlayer?.id) return prev;
                return {
                    ...prev,
                    hostApiKey: currentPlayer.id === prev.hostId ? key : prev.hostApiKey,
                    playerApiKeys: {
                        ...prev.playerApiKeys,
                        [currentPlayer.id]: key,
                    },
                };
            });
        } catch (error) {
            console.error('Failed to save API key:', error);
        }
    };

    const setPlayerName = async (name: string) => {
        try {
            await AsyncStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
            setPlayerNameState(name);
        } catch (error) {
            console.error('Failed to save player name:', error);
        }
    };

    const setSoundEnabled = async (enabled: boolean) => {
        try {
            await AsyncStorage.setItem('elbureau-sound-enabled', String(enabled));
            setSoundEnabledState(enabled);
            // We'll update the global audio service listener in a useEffect if needed, 
            // or just let components read from context.
        } catch (error) {
            console.error('Failed to save sound setting:', error);
        }
    };

    const setAnimationsEnabled = async (enabled: boolean) => {
        try {
            await AsyncStorage.setItem('elbureau-animations-enabled', String(enabled));
            setAnimationsEnabledState(enabled);
        } catch (error) {
            console.error('Failed to save animations setting:', error);
        }
    };

    return (
        <GameContext.Provider value={{
            gameState,
            setGameState,
            currentPlayer,
            setCurrentPlayer,
            apiKey,
            setApiKey,
            playerName,
            setPlayerName,
            deviceId,
            playerId,
            // Expose settings via game state or directly? 
            // For now, let's patch them into gameState if it exists, or expose directly.
            // Actually, let's expose setters directly, and ensure gameState reflects them if we want to sync.
            // But for local prefs, direct access is better.
            // wait, the interface defined them on ContextType.
            setSoundEnabled,
            setAnimationsEnabled,
            soundEnabled,
            animationsEnabled,
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
