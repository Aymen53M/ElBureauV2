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
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
    const [apiKey, setApiKeyState] = useState('');
    const [playerName, setPlayerNameState] = useState('');
    const [deviceId, setDeviceId] = useState('');

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
