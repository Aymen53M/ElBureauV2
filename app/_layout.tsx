import React from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, Platform } from 'react-native';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { GameProvider, useGame } from '@/contexts/GameContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { fetchRoomState, joinRoom } from '@/services/roomService';
import '../global.css';

const queryClient = new QueryClient();

const LAST_ROOM_CODE_STORAGE_KEY = 'elbureau-last-room-code';

function isMobileWeb() {
    if (Platform.OS !== 'web') return false;
    try {
        return typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    } catch {
        return false;
    }
}

async function setLastRoomCode(value: string) {
    if (Platform.OS === 'web') {
        try {
            (globalThis as any)?.sessionStorage?.setItem?.(LAST_ROOM_CODE_STORAGE_KEY, value);
            return;
        } catch {
            // fallback
        }
    }
    await AsyncStorage.setItem(LAST_ROOM_CODE_STORAGE_KEY, value);
}

async function getLastRoomCode() {
    if (Platform.OS === 'web') {
        try {
            const v = (globalThis as any)?.sessionStorage?.getItem?.(LAST_ROOM_CODE_STORAGE_KEY);
            if (v) return v;
        } catch {
            // fallback
        }
    }
    return AsyncStorage.getItem(LAST_ROOM_CODE_STORAGE_KEY);
}

async function clearLastRoomCode() {
    if (Platform.OS === 'web') {
        try {
            (globalThis as any)?.sessionStorage?.removeItem?.(LAST_ROOM_CODE_STORAGE_KEY);
            return;
        } catch {
            // fallback
        }
    }
    await AsyncStorage.removeItem(LAST_ROOM_CODE_STORAGE_KEY);
}

function ResumeBootstrap() {
    const router = useRouter();
    const pathname = usePathname();
    const { gameState, setGameState, currentPlayer, setCurrentPlayer, playerId, playerName, apiKey } = useGame();
    const hydratedRef = React.useRef(false);
    const hadRoomRef = React.useRef(false);

    React.useEffect(() => {
        if (gameState?.roomCode) {
            hadRoomRef.current = true;
            setLastRoomCode(gameState.roomCode).catch(() => undefined);
        }
    }, [gameState?.roomCode]);

    React.useEffect(() => {
        if (gameState) return;
        if (!hadRoomRef.current) return;
        clearLastRoomCode().catch(() => undefined);
        hadRoomRef.current = false;
    }, [gameState]);

    React.useEffect(() => {
        if (hydratedRef.current) return;
        if (gameState || currentPlayer) return;
        if (!playerId) return;
        if (pathname !== '/') return;

        hydratedRef.current = true;

        const run = async () => {
            const lastRoomCode = (await getLastRoomCode())?.toUpperCase();
            if (!lastRoomCode) return;

            const resumeRoom = async () => {
                if (!isSupabaseConfigured) {
                    setGameState({
                        roomCode: lastRoomCode,
                        phase: 'lobby',
                        players: [],
                        currentQuestion: 0,
                        questions: [],
                        settings: {
                            theme: 'movies',
                            difficulty: 'medium',
                            numberOfQuestions: 10,
                            timePerQuestion: 30,
                            questionType: 'multiple-choice',
                            language: 'en',
                            hintsEnabled: true,
                        },
                        hostId: '',
                        hostApiKey: undefined,
                        playerApiKeys: apiKey ? { [playerId]: apiKey } : {},
                        answers: {},
                    });
                    setCurrentPlayer({
                        id: playerId,
                        name: playerName || 'Player',
                        score: 0,
                        isHost: false,
                        isReady: false,
                        usedBets: [],
                        hasApiKey: !!apiKey,
                    });
                    router.replace('/lobby');
                    return;
                }

                try {
                    let { room, players } = await fetchRoomState(lastRoomCode);
                    let me = players.find((p) => p.id === playerId);
                    if (!me) {
                        const joined = await joinRoom({
                            roomCode: lastRoomCode,
                            player: {
                                id: playerId,
                                name: playerName || 'Player',
                                score: 0,
                                isHost: false,
                                isReady: false,
                                usedBets: [],
                                hasApiKey: !!apiKey,
                            },
                        });
                        room = joined.room;
                        players = joined.players;
                        me = players.find((p) => p.id === playerId);
                    }

                    setGameState({
                        roomCode: room.room_code,
                        phase: (room.phase as any) || 'lobby',
                        players,
                        currentQuestion: 0,
                        questions: [],
                        settings: room.settings,
                        hostId: room.host_player_id,
                        hostApiKey: undefined,
                        playerApiKeys: apiKey ? { [playerId]: apiKey } : {},
                        answers: {},
                    });

                    if (me) {
                        setCurrentPlayer(me);
                    }

                    router.replace(((room.phase as any) || 'lobby') === 'lobby' ? '/lobby' : '/game');
                } catch {
                    await clearLastRoomCode();
                }
            };

            // Mobile web can keep stale storage for a long time (and feel like the app forces a random phase).
            // Ask before resuming.
            if (isMobileWeb()) {
                Alert.alert(
                    'Resume last room?',
                    `We found a previous room (${lastRoomCode}). Do you want to rejoin it?`,
                    [
                        {
                            text: 'No',
                            style: 'cancel',
                            onPress: () => {
                                clearLastRoomCode().catch(() => undefined);
                            },
                        },
                        {
                            text: 'Yes',
                            onPress: () => {
                                resumeRoom().catch(() => undefined);
                            },
                        },
                    ]
                );
                return;
            }

            await resumeRoom();
        };

        run().catch(() => undefined);
    }, [apiKey, currentPlayer, gameState, pathname, playerId, playerName, router, setCurrentPlayer, setGameState]);

    return null;
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <LanguageProvider>
                    <GameProvider>
                        <ResumeBootstrap />
                        <StatusBar style="dark" />
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                contentStyle: { backgroundColor: '#F7F1E6' },
                                animation: 'slide_from_right',
                            }}
                        />
                    </GameProvider>
                </LanguageProvider>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}
