import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
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
    setApiKey: (key: string) => void;
    playerName: string;
    setPlayerName: (name: string) => void;
}

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

    // Load saved data on mount
    useEffect(() => {
        const loadSavedData = async () => {
            try {
                // Load API key from secure storage
                const savedApiKey = await SecureStore.getItemAsync('elbureau-api-key');
                if (savedApiKey) {
                    setApiKeyState(savedApiKey);
                }

                // Load player name from async storage
                const savedName = await AsyncStorage.getItem('elbureau-player-name');
                if (savedName) {
                    setPlayerNameState(savedName);
                }
            } catch (error) {
                console.error('Failed to load saved data:', error);
            }
        };
        loadSavedData();
    }, []);

    const setApiKey = async (key: string) => {
        try {
            await SecureStore.setItemAsync('elbureau-api-key', key);
            setApiKeyState(key);
        } catch (error) {
            console.error('Failed to save API key:', error);
        }
    };

    const setPlayerName = async (name: string) => {
        try {
            await AsyncStorage.setItem('elbureau-player-name', name);
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
