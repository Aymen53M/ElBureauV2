

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeArea';
import { useRouter } from '@/lib/router';
import { copyToClipboard } from '@/lib/clipboard';
import { Ionicons } from '@/components/ui/Ionicons';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Logo from '@/components/Logo';
import ScreenBackground from '@/components/ui/ScreenBackground';
import PlayerAvatar from '@/components/PlayerAvatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame, Player } from '@/contexts/GameContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { fetchRoomState, subscribeToRoom, leaveRoom } from '@/services/roomService';
import { resetGameplayForRoom } from '@/services/gameService';

export default function Lobby() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const { gameState, setGameState, currentPlayer, setCurrentPlayer, apiKey } = useGame();
    const { height: windowHeight } = useWindowDimensions();
    const compactHeight = Platform.OS === 'web' ? 900 : 900;
    const isCompact = windowHeight < compactHeight;

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
        await copyToClipboard(gameState.roomCode);
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

    const startGame = async () => {
        const hostKey = (gameState.hostApiKey || apiKey || '').trim();
        if (!hostKey) {
            Alert.alert(t('apiKey'), t('missingApiKeyHost'));
            router.push('/settings');
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
            <View className={`${isCompact ? 'p-3' : 'p-6'} max-w-4xl w-full self-center flex-1 ${isCompact ? 'space-y-4' : 'space-y-8'}`}>
                {/* Header */}
                <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-4 ${isCompact ? 'mb-3 pt-1' : 'mb-6 pt-5'}`}>
                    <TouchableOpacity onPress={exitLobby} className="p-2 bg-white rounded-lg border-2 border-foreground">
                        <Ionicons name="arrow-back" size={24} color="#2B1F17" />
                    </TouchableOpacity>
                    <Logo size="sm" animated={false} />
                    <View className="flex-1" />
                    {isHost && (
                        <TouchableOpacity onPress={() => router.push('/create')} className="p-2 bg-white rounded-lg border-2 border-foreground">
                            <Ionicons name="settings-outline" size={20} color="#2B1F17" />
                        </TouchableOpacity>
                    )}
                </View>

                <View className={`max-w-2xl mx-auto w-full flex-1 ${isCompact ? 'space-y-6' : 'space-y-10'}`}>
                    {!isSupabaseConfigured && (
                        <Card className="border-destructive bg-destructive/10 rounded-lg border-2">
                            <CardContent className="p-5 space-y-2">
                                <Text className="font-display font-bold text-foreground">Realtime not configured</Text>
                                <Text className="text-sm text-foreground/70 font-sans">
                                    This deployment is missing Supabase environment variables. Set VITE_SUPABASE_URL and
                                    VITE_SUPABASE_ANON_KEY in Vercel,
                                    then redeploy.
                                </Text>
                            </CardContent>
                        </Card>
                    )}

                    {isSupabaseConfigured && realtimeStatus === 'error' && (
                        <Card className="border-destructive bg-destructive/10 rounded-lg border-2">
                            <CardContent className="p-5 space-y-2">
                                <Text className="font-display font-bold text-foreground">Realtime connection error</Text>
                                <Text className="text-sm text-foreground/70 font-sans">
                                    {realtimeError || 'Unknown error'}
                                </Text>
                            </CardContent>
                        </Card>
                    )}

                    {/* Room Code */}
                    <Card className="border-2 border-foreground bg-white rounded-lg overflow-hidden transform rotate-1">
                        <CardContent className={`${isCompact ? 'p-4' : 'p-6'} items-center space-y-2`}>
                            <Text className="text-sm text-muted-foreground mb-2 font-bold uppercase tracking-wider font-sans">{t('roomCode')}</Text>
                            <View className={`flex-row items-center gap-4 bg-muted/20 ${isCompact ? 'p-2 px-4' : 'p-3 px-6'} rounded-lg border-2 border-dashed border-foreground/30`}>
                                <Text className={`${isCompact ? 'text-3xl' : 'text-4xl'} font-display font-bold tracking-widest text-primary`}>
                                    {gameState.roomCode}
                                </Text>
                                <View className="h-8 w-[2px] bg-foreground/20" />
                                <TouchableOpacity onPress={copyRoomCode} className="p-2 bg-primary/10 rounded-lg active:bg-primary/20">
                                    <Ionicons name="copy-outline" size={24} color="#C17F59" />
                                </TouchableOpacity>
                            </View>
                            <Text className={`${isCompact ? 'text-xs mt-2' : 'text-sm mt-4'} text-muted-foreground text-center font-sans`}>
                                {t('shareCodeMessage')}
                            </Text>
                        </CardContent>
                    </Card>

                    {/* Game Settings Preview */}
                    <Card className="rounded-lg border-2 border-foreground bg-white transform -rotate-1">
                        <CardContent className={isCompact ? 'p-3' : 'p-4'}>
                            <View className="flex-row flex-wrap gap-2 justify-center">
                                <View className="px-3 py-1.5 rounded-lg bg-secondary/10 border-2 border-secondary/30 flex-row items-center gap-1.5">
                                    <Text className="text-sm">🎯</Text>
                                    <Text className="text-sm font-bold text-foreground font-sans">
                                        {t(gameState.settings.theme)}
                                        {gameState.settings.customTheme && `: ${gameState.settings.customTheme}`}
                                    </Text>
                                </View>
                                <View className="px-3 py-1.5 rounded-lg bg-accent/10 border-2 border-accent/30 flex-row items-center gap-1.5">
                                    <Text className="text-sm">⚡</Text>
                                    <Text className="text-sm font-bold text-foreground font-sans">
                                        {t(gameState.settings.difficulty)}
                                    </Text>
                                </View>
                                <View className="px-3 py-1.5 rounded-lg bg-primary/10 border-2 border-primary/30 flex-row items-center gap-1.5">
                                    <Text className="text-sm">❓</Text>
                                    <Text className="text-sm font-bold text-foreground font-sans">
                                        {gameState.settings.numberOfQuestions} {t('question')}s
                                    </Text>
                                </View>
                                <View className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border-2 border-emerald-500/30 flex-row items-center gap-1.5">
                                    <Text className="text-sm">⏱️</Text>
                                    <Text className="text-sm font-bold text-foreground font-sans">
                                        {gameState.settings.timePerQuestion}s
                                    </Text>
                                </View>
                            </View>
                        </CardContent>
                    </Card>

                    {/* Players */}
                    <View className={isCompact ? 'space-y-2' : 'space-y-4'}>
                        <View className={`flex-row items-center justify-center gap-2 ${isCompact ? 'mb-1' : 'mb-2'}`}>
                            <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-center text-foreground`}>
                                {t('players')}
                            </Text>
                            <View className="bg-primary/20 px-2 py-0.5 rounded-full border border-primary/30">
                                <Text className="text-primary font-bold text-xs font-sans">{gameState.players.length}</Text>
                            </View>
                        </View>

                        <View className={`flex-row flex-wrap justify-center ${isCompact ? 'gap-3 pt-0' : 'gap-6 pt-1'}`}>
                            {gameState.players.map((player) => (
                                <PlayerAvatar
                                    key={player.id}
                                    name={player.name}
                                    size={isCompact ? 'sm' : 'lg'}
                                    isHost={player.isHost}
                                    isReady={player.isReady}
                                />
                            ))}

                            {/* Waiting for more players */}
                            {gameState.players.length < 8 && (
                                <View className={`${isCompact ? 'w-12 h-12' : 'w-20 h-20'} rounded-full border-2 border-dashed border-foreground/30 bg-white items-center justify-center transform rotate-3`}>
                                    <Text className={`${isCompact ? 'text-xl' : 'text-3xl'} text-foreground/40 pl-0.5 pt-0.5 font-display`}>+</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Waiting Status */}
                    <View className={`items-center ${isCompact ? 'py-1' : 'py-2'}`}>
                        <Text className="text-center text-muted-foreground font-medium font-sans">
                            {t('waiting')}
                        </Text>
                    </View>

                    {/* Actions */}
                    <View className={isCompact ? 'space-y-2 pb-2' : 'space-y-3 pb-4'}>
                        {isHost && (
                            <Button
                                variant="hero"
                                onPress={startGame}
                                disabled={gameState.players.length < 1}
                                className="w-full shadow-none transform -rotate-1"
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
