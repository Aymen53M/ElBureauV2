import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchRoomState } from '../services/roomService';
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
    clearRoomSession: () => Promise<void>;
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
const ROOM_CODE_STORAGE_KEY = 'elbureau-room-code';
const PLAYER_ID_STORAGE_KEY = 'elbureau-player-id';
const LAST_ROOM_CODE_STORAGE_KEY = 'elbureau-last-room-code';

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

                // Attempt to restore session
                const savedRoomCode = await AsyncStorage.getItem(ROOM_CODE_STORAGE_KEY);
                const savedPlayerId = await AsyncStorage.getItem(PLAYER_ID_STORAGE_KEY);

                if (savedRoomCode && savedPlayerId) {
                    console.log('Restoring session for room:', savedRoomCode);
                    try {
                        const roomState = await fetchRoomState(savedRoomCode);
                        const player = roomState.players.find((p) => p.id === savedPlayerId);

                        if (player) {
                            setGameState({
                                roomCode: roomState.room.room_code,
                                phase: roomState.room.phase as any,
                                players: roomState.players,
                                currentQuestion: roomState.room.current_question_index ?? 0,
                                questions: (roomState.room.questions as any) || [],
                                settings: roomState.room.settings,
                                hostId: roomState.room.host_player_id,
                                hostApiKey: undefined,
                                playerApiKeys: {}, // Will be populated by next useEffect if apiKey exists
                                answers: {}, // Answers/validations will be fetched by game components
                            });
                            setCurrentPlayer(player);
                        }
                    } catch (e) {
                        console.log("Failed to restore session", e);
                    }
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

    // Persist Room Code & Player ID
    useEffect(() => {
        if (gameState?.roomCode) {
            AsyncStorage.setItem(ROOM_CODE_STORAGE_KEY, gameState.roomCode).catch(e => console.error(e));
        } else {
            AsyncStorage.removeItem(ROOM_CODE_STORAGE_KEY).catch(e => console.error(e));
        }

        if (currentPlayer?.id) {
            AsyncStorage.setItem(PLAYER_ID_STORAGE_KEY, currentPlayer.id).catch(e => console.error(e));
        } else {
            AsyncStorage.removeItem(PLAYER_ID_STORAGE_KEY).catch(e => console.error(e));
        }
    }, [gameState?.roomCode, currentPlayer?.id]);

    const clearRoomSession = async () => {
        try {
            if ((globalThis as any)?.localStorage?.removeItem) {
                try {
                    (globalThis as any).localStorage.removeItem(LAST_ROOM_CODE_STORAGE_KEY);
                } catch {
                    // noop
                }
            }
            await AsyncStorage.multiRemove([ROOM_CODE_STORAGE_KEY, PLAYER_ID_STORAGE_KEY, LAST_ROOM_CODE_STORAGE_KEY]);
        } catch (error) {
            console.error('Failed to clear room session:', error);
        } finally {
            setCurrentPlayer(null);
            setGameState(null);
        }
    };

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
            clearRoomSession,
            apiKey,
            setApiKey,
            playerName,
            setPlayerName,
            deviceId,
            playerId,
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
