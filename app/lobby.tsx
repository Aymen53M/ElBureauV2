import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
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
import { supabase, isSupabaseConfigured, resolvedSupabaseUrl } from '@/integrations/supabase/client';

export default function Lobby() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const { gameState, setGameState, currentPlayer, setCurrentPlayer } = useGame();

    const channelRef = React.useRef<any>(null);
    const [realtimeStatus, setRealtimeStatus] = React.useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [realtimeError, setRealtimeError] = React.useState<string | null>(null);
    const [realtimeRetryToken, setRealtimeRetryToken] = React.useState(0);

    // Navigate away if no game state - using useEffect to avoid setState during render
    useEffect(() => {
        if (gameState) return;
        const timeout = setTimeout(() => {
            router.replace('/');
        }, 350);
        return () => clearTimeout(timeout);
    }, [gameState, router]);

    useEffect(() => {
        if (!supabase || !gameState?.roomCode || !currentPlayer?.id) return;

        const supabaseClient = supabase;
        setRealtimeStatus('connecting');
        setRealtimeError(null);

        const channel = supabaseClient.channel(`room:${gameState.roomCode}`, {
            config: {
                presence: { key: currentPlayer.id },
            },
        });

        channelRef.current = channel;

        const syncPlayers = () => {
            const state = channel.presenceState();
            const presences: any[] = Object.values(state).flat();

            const players = presences
                .map((p) => p?.player as Player | undefined)
                .filter((p): p is Player => !!p && typeof p.id === 'string');

            const byId = new Map<string, Player>();
            players.forEach((p) => byId.set(p.id, p));
            const nextPlayers = Array.from(byId.values()).sort((a, b) => {
                if (a.isHost === b.isHost) return 0;
                return a.isHost ? -1 : 1;
            });

            const host = nextPlayers.find((p) => p.isHost);

            setGameState((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    hostId: host?.id || prev.hostId,
                    players: nextPlayers.length ? nextPlayers : prev.players,
                };
            });
        };

        channel.on('presence', { event: 'sync' }, syncPlayers);
        channel.on('presence', { event: 'join' }, syncPlayers);
        channel.on('presence', { event: 'leave' }, syncPlayers);

        channel.subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
                setRealtimeStatus('connected');
                await channel.track({
                    player: currentPlayer,
                    room: currentPlayer.isHost ? { settings: gameState.settings } : undefined,
                });
                syncPlayers();
                return;
            }

            if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                setRealtimeStatus('error');
                setRealtimeError(status);
            }
        });

        return () => {
            supabaseClient.removeChannel(channel);
            channelRef.current = null;
            setRealtimeStatus('idle');
        };
    }, [currentPlayer?.id, gameState?.roomCode, realtimeRetryToken]);

    const retryRealtime = () => {
        setRealtimeStatus('connecting');
        setRealtimeError(null);
        setRealtimeRetryToken((v) => v + 1);
    };

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

    const toggleReady = () => {
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
        channelRef.current?.track?.({ player: nextPlayer });
    };

    const startGame = () => {
        if (!gameState.hostApiKey) {
            Alert.alert(t('apiKey'), t('missingApiKeyHost'));
            router.push('/settings');
            return;
        }
        if (!allReady) {
            Alert.alert(t('notReadyTitle'), t('notReadyDesc'));
            return;
        }
        router.push('/game');
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="default" />
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-7 max-w-4xl w-full self-center pb-16 space-y-12"
            >
                {/* Header */}
                <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-4 mb-8 pt-8`}>
                    <TouchableOpacity onPress={() => router.replace('/')} className="p-2">
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

                <View className="max-w-2xl mx-auto w-full space-y-12">
                    {!isSupabaseConfigured && (
                        <Card className="border-destructive/50 bg-destructive/10 rounded-3xl">
                            <CardContent className="p-5 space-y-2">
                                <Text className="font-display font-bold text-foreground">Realtime not configured</Text>
                                <Text className="text-sm text-muted-foreground">
                                    This deployment is missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and
                                    EXPO_PUBLIC_SUPABASE_ANON_KEY (or VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY) in Vercel,
                                    then redeploy.
                                </Text>
                                {!!resolvedSupabaseUrl && (
                                    <Text className="text-xs text-muted-foreground">URL: {resolvedSupabaseUrl}</Text>
                                )}
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
                                {!!resolvedSupabaseUrl && (
                                    <Text className="text-xs text-muted-foreground">URL: {resolvedSupabaseUrl}</Text>
                                )}
                                <Button size="sm" variant="outline" onPress={retryRealtime}>
                                    <Text className="text-primary font-display">Retry</Text>
                                </Button>
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
                        <CardContent className="p-7 items-center space-y-2">
                            <Text className="text-sm text-muted-foreground mb-2">{t('roomCode')}</Text>
                            <View className="flex-row items-center gap-4">
                                <Text className="text-5xl font-display font-bold tracking-widest text-primary" style={{
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
                            <Text className="text-sm text-muted-foreground mt-4 text-center">
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
                    <View className="space-y-5">
                        <Text className="text-lg font-display font-bold text-center mb-4 text-foreground">
                            {t('players')} ({gameState.players.length})
                        </Text>

                        <View className="flex-row flex-wrap justify-center gap-7 pt-2">
                            {gameState.players.map((player) => (
                                <PlayerAvatar
                                    key={player.id}
                                    name={player.name}
                                    size="lg"
                                    isHost={player.isHost}
                                    isReady={player.isReady}
                                />
                            ))}

                            {/* Waiting for more players */}
                            {gameState.players.length < 8 && (
                                <View className="w-20 h-20 rounded-full border-2 border-dashed border-border items-center justify-center opacity-50">
                                    <Text className="text-3xl text-muted-foreground">+</Text>
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
                                    <Text className="text-lg font-display font-bold text-primary-foreground">
                                        {t('startGame')}
                                    </Text>
                                </View>
                            </Button>
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
