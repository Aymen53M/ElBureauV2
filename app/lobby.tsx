import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Logo from '@/components/Logo';
import ScreenBackground from '@/components/ui/ScreenBackground';
import PlayerAvatar from '@/components/PlayerAvatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame, Player } from '@/contexts/GameContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { fetchRoomState, subscribeToRoom, updatePlayerState, leaveRoom } from '@/services/roomService';
import { resetGameplayForRoom } from '@/services/gameService';

export default function Lobby() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const { gameState, setGameState, currentPlayer, setCurrentPlayer, apiKey } = useGame();
    const { height: windowHeight } = useWindowDimensions();
    const isCompact = windowHeight < 760;

    const subscriptionRef = React.useRef<{ unsubscribe: () => void } | null>(null);
    const hasNavigatedRef = React.useRef(false);
    const refreshInFlightRef = React.useRef(false);
    const lastSnapshotRef = React.useRef<string>('');
    const [realtimeStatus, setRealtimeStatus] = React.useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [realtimeError, setRealtimeError] = React.useState<string | null>(null);

    // Navigate away if no game state - using useEffect to avoid setState during render
    useEffect(() => {
        if (gameState) return;
        const timeout = setTimeout(() => {
            router.replace('/');
        }, 350);
        return () => clearTimeout(timeout);
    }, [gameState, router]);

    useEffect(() => {
        if (!isSupabaseConfigured || !gameState?.roomCode) return;

        setRealtimeStatus('connecting');
        setRealtimeError(null);

        let cancelled = false;
        let refreshQueued = false;
        let refreshTimer: ReturnType<typeof setTimeout> | null = null;
        const debounceMs = Platform.OS === 'web' ? 240 : 60;

        const scheduleRefresh = () => {
            refreshQueued = true;
            if (refreshTimer) return;
            refreshTimer = setTimeout(() => {
                refreshTimer = null;
                if (!refreshQueued) return;
                refreshQueued = false;
                refresh().catch(() => undefined);
            }, debounceMs);
        };

        const refresh = async () => {
            if (refreshInFlightRef.current) return;
            refreshInFlightRef.current = true;
            try {
                const { room, players } = await fetchRoomState(gameState.roomCode, { includeQuestions: false });
                if (cancelled) return;

                const playersSig = players
                    .map((p) => `${p.id}:${p.score}:${p.isReady ? 1 : 0}:${p.isHost ? 1 : 0}:${(p.usedBets || []).join(',')}:${p.hasApiKey ? 1 : 0}`)
                    .join('|');
                const nextSnapshot = `${room.room_code}|${room.host_player_id}|${room.phase}|${JSON.stringify(room.settings)}|${playersSig}`;
                if (nextSnapshot !== lastSnapshotRef.current) {
                    lastSnapshotRef.current = nextSnapshot;
                    setGameState((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            roomCode: room.room_code,
                            hostId: room.host_player_id,
                            phase: (room.phase as any) || prev.phase,
                            settings: room.settings,
                            players: players.length ? players : prev.players,
                        };
                    });
                }
                setRealtimeStatus('connected');

                if (room.phase && room.phase !== 'lobby' && !hasNavigatedRef.current) {
                    hasNavigatedRef.current = true;
                    router.replace('/game');
                }
            } catch (err) {
                if (cancelled) return;
                setRealtimeStatus('error');
                setRealtimeError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                refreshInFlightRef.current = false;
                if (refreshQueued) {
                    scheduleRefresh();
                }
            }
        };

        refresh();
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = subscribeToRoom({
            roomCode: gameState.roomCode,
            onRoomChange: scheduleRefresh,
        });

        const pollMs = Platform.OS === 'web' ? 15000 : 3000;
        const poll = setInterval(() => {
            scheduleRefresh();
        }, pollMs);

        return () => {
            cancelled = true;
            clearInterval(poll);
            if (refreshTimer) {
                clearTimeout(refreshTimer);
                refreshTimer = null;
            }
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
            setRealtimeStatus('idle');
            hasNavigatedRef.current = false;
        };
    }, [gameState?.roomCode, router, setGameState]);

    if (!gameState) {
        return (
            <SafeAreaView className="flex-1 bg-background">
                <ScreenBackground variant="default" />
                <View className="flex-1 items-center justify-center p-7">
                    <Text className="text-base font-display font-semibold text-foreground">
                        {t('loading')}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const isHost = !!currentPlayer?.id && currentPlayer.id === gameState.hostId;
    const allReady = gameState.players.every(p => p.isReady);

    const copyRoomCode = async () => {
        await Clipboard.setStringAsync(gameState.roomCode);
        Alert.alert(t('copied'), gameState.roomCode);
    };

    const exitLobby = async () => {
        if (isSupabaseConfigured && gameState?.roomCode && currentPlayer?.id) {
            try {
                await leaveRoom({ roomCode: gameState.roomCode, playerId: currentPlayer.id });
            } catch {
                // noop
            }
        }
        setCurrentPlayer(null);
        setGameState(null);
        router.replace('/');
    };

    const toggleReady = async () => {
        if (!currentPlayer?.id) return;

        const nextReady = !gameState.players.find((p) => p.id === currentPlayer.id)?.isReady;

        const nextPlayer: Player = {
            ...(gameState.players.find((p) => p.id === currentPlayer.id) || currentPlayer),
            isReady: !!nextReady,
        };

        setGameState(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                players: prev.players.map((p) =>
                    p.id === currentPlayer.id ? { ...p, isReady: !!nextReady } : p
                ),
            };
        });

        setCurrentPlayer(nextPlayer);

        try {
            await updatePlayerState({
                roomCode: gameState.roomCode,
                playerId: currentPlayer.id,
                patch: { is_ready: !!nextReady },
            });
        } catch (err) {
            Alert.alert('Supabase', err instanceof Error ? err.message : 'Failed to update player');
        }
    };

    const startGame = async () => {
        const hostKey = (gameState.hostApiKey || apiKey || '').trim();
        if (!hostKey) {
            Alert.alert(t('apiKey'), t('missingApiKeyHost'));
            router.push('/settings');
            return;
        }
        if (!allReady) {
            Alert.alert(t('notReadyTitle'), t('notReadyDesc'));
            return;
        }

        if (isSupabaseConfigured && gameState?.roomCode) {
            try {
                await resetGameplayForRoom({ roomCode: gameState.roomCode, keepQuestions: false });
            } catch (err) {
                Alert.alert('Supabase', err instanceof Error ? err.message : 'Failed to start game');
                return;
            }
        }

        setGameState((prev) => (prev ? { ...prev, phase: 'question', hostApiKey: prev.hostApiKey || hostKey } : prev));
        hasNavigatedRef.current = true;
        router.replace('/game');
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="default" />
            <View className={`${isCompact ? 'p-4' : 'p-7'} max-w-4xl w-full self-center flex-1 ${isCompact ? 'space-y-6' : 'space-y-10'}`}>
                {/* Header */}
                <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-4 ${isCompact ? 'mb-4 pt-2' : 'mb-8 pt-8'}`}>
                    <TouchableOpacity onPress={exitLobby} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="#2B1F17" />
                    </TouchableOpacity>
                    <Logo size="sm" animated={false} />
                    <View className="flex-1" />
                    {isHost && (
                        <TouchableOpacity onPress={() => router.push('/create')} className="p-2">
                            <Ionicons name="settings-outline" size={20} color="#2B1F17" />
                        </TouchableOpacity>
                    )}
                </View>

                <View className={`max-w-2xl mx-auto w-full flex-1 ${isCompact ? 'space-y-6' : 'space-y-10'}`}>
                    {!isSupabaseConfigured && (
                        <Card className="border-destructive/50 bg-destructive/10 rounded-3xl">
                            <CardContent className="p-5 space-y-2">
                                <Text className="font-display font-bold text-foreground">Realtime not configured</Text>
                                <Text className="text-sm text-muted-foreground">
                                    This deployment is missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and
                                    EXPO_PUBLIC_SUPABASE_ANON_KEY (or VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY) in Vercel,
                                    then redeploy.
                                </Text>
                            </CardContent>
                        </Card>
                    )}

                    {isSupabaseConfigured && realtimeStatus === 'error' && (
                        <Card className="border-destructive/50 bg-destructive/10 rounded-3xl">
                            <CardContent className="p-5 space-y-2">
                                <Text className="font-display font-bold text-foreground">Realtime connection error</Text>
                                <Text className="text-sm text-muted-foreground">
                                    {realtimeError || 'Unknown error'}
                                </Text>
                            </CardContent>
                        </Card>
                    )}

                    {/* Room Code */}
                    <Card className="border-primary/30 rounded-3xl" style={{
                        shadowColor: '#C97B4C',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 20,
                        elevation: 10,
                    }}>
                        <CardContent className={`${isCompact ? 'p-5' : 'p-7'} items-center space-y-2`}>
                            <Text className="text-sm text-muted-foreground mb-2">{t('roomCode')}</Text>
                            <View className="flex-row items-center gap-4">
                                <Text className={`${isCompact ? 'text-4xl' : 'text-5xl'} font-display font-bold tracking-widest text-primary`} style={{
                                    textShadowColor: '#C97B4C',
                                    textShadowOffset: { width: 0, height: 0 },
                                    textShadowRadius: 15,
                                }}>
                                    {gameState.roomCode}
                                </Text>
                                <TouchableOpacity onPress={copyRoomCode} className="p-2">
                                    <Ionicons name="copy-outline" size={20} color="#2B1F17" />
                                </TouchableOpacity>
                            </View>
                            <Text className={`${isCompact ? 'text-xs mt-2' : 'text-sm mt-4'} text-muted-foreground text-center`}>
                                {t('shareCodeMessage')}
                            </Text>
                        </CardContent>
                    </Card>

                    {/* Game Settings Preview */}
                    <Card className="rounded-3xl">
                        <CardContent className="p-6">
                            <View className="flex-row flex-wrap gap-3 justify-center">
                                <View className="px-3 py-1.5 rounded-full bg-muted">
                                    <Text className="text-sm font-medium text-foreground">
                                        🎯 {t(gameState.settings.theme)}
                                        {gameState.settings.customTheme && `: ${gameState.settings.customTheme}`}
                                    </Text>
                                </View>
                                <View className="px-3 py-1.5 rounded-full bg-muted">
                                    <Text className="text-sm font-medium text-foreground">
                                        ⚡ {t(gameState.settings.difficulty)}
                                    </Text>
                                </View>
                                <View className="px-3 py-1.5 rounded-full bg-muted">
                                    <Text className="text-sm font-medium text-foreground">
                                        ❓ {gameState.settings.numberOfQuestions} {t('question')}s
                                    </Text>
                                </View>
                                <View className="px-3 py-1.5 rounded-full bg-muted">
                                    <Text className="text-sm font-medium text-foreground">
                                        ⏱️ {gameState.settings.timePerQuestion}s
                                    </Text>
                                </View>
                            </View>
                        </CardContent>
                    </Card>

                    {/* Players */}
                    <View className={isCompact ? 'space-y-3' : 'space-y-5'}>
                        <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-center mb-4 text-foreground`}>
                            {t('players')} ({gameState.players.length})
                        </Text>

                        <View className={`flex-row flex-wrap justify-center ${isCompact ? 'gap-4 pt-1' : 'gap-7 pt-2'}`}>
                            {gameState.players.map((player) => (
                                <PlayerAvatar
                                    key={player.id}
                                    name={player.name}
                                    size={isCompact ? 'md' : 'lg'}
                                    isHost={player.isHost}
                                    isReady={player.isReady}
                                />
                            ))}

                            {/* Waiting for more players */}
                            {gameState.players.length < 8 && (
                                <View className={`${isCompact ? 'w-14 h-14' : 'w-20 h-20'} rounded-full border-2 border-dashed border-border items-center justify-center opacity-50`}>
                                    <Text className={`${isCompact ? 'text-2xl' : 'text-3xl'} text-muted-foreground`}>+</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Waiting Status */}
                    <Text className="text-center text-muted-foreground">
                        {t('waiting')}
                    </Text>

                    {/* Actions */}
                    <View className="space-y-3">
                        {!isHost && currentPlayer?.id && (
                            <Button
                                variant={gameState.players.find((p) => p.id === currentPlayer.id)?.isReady ? 'default' : 'outline'}
                                size="lg"
                                onPress={toggleReady}
                                className="w-full"
                            >
                                <Text className={`font-display font-bold ${gameState.players.find((p) => p.id === currentPlayer.id)?.isReady ? 'text-primary-foreground' : 'text-primary'
                                    }`}>
                                    {gameState.players.find((p) => p.id === currentPlayer.id)?.isReady ? t('ready') + ' ✅' : t('notReady')}
                                </Text>
                            </Button>
                        )}

                        {isHost && (
                            <Button
                                variant="hero"
                                onPress={startGame}
                                disabled={!allReady || gameState.players.length < 1}
                                className="w-full"
                            >
                                <View className="flex-row items-center gap-2">
                                    <Ionicons name="play" size={24} color="#FFF8EF" />
                                    <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-primary-foreground`}>
                                        {t('startGame')}
                                    </Text>
                                </View>
                            </Button>
                        )}
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
