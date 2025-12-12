import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Logo from '@/components/Logo';
import PlayerAvatar from '@/components/PlayerAvatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame } from '@/contexts/GameContext';

export default function Lobby() {
    const router = useRouter();
    const { t } = useLanguage();
    const { gameState, setGameState } = useGame();

    // Navigate away if no game state - using useEffect to avoid setState during render
    useEffect(() => {
        if (!gameState) {
            router.replace('/');
        }
    }, [gameState, router]);

    // Show nothing while redirecting
    if (!gameState) {
        return null;
    }

    const isHost = gameState.players[0]?.isHost;
    const allReady = gameState.players.every(p => p.isReady);

    const copyRoomCode = async () => {
        await Clipboard.setStringAsync(gameState.roomCode);
        Alert.alert(t('copied'), gameState.roomCode);
    };

    const toggleReady = () => {
        setGameState(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                players: prev.players.map((p, i) =>
                    i === (isHost ? 0 : 1) ? { ...p, isReady: !p.isReady } : p
                ),
            };
        });
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
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-7 max-w-4xl w-full self-center pb-16 space-y-12"
            >
                {/* Header */}
                <View className="flex-row items-center gap-4 mb-8 pt-8">
                    <TouchableOpacity onPress={() => router.replace('/')} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="#F5FFFF" />
                    </TouchableOpacity>
                    <Logo size="sm" animated={false} />
                    <View className="flex-1" />
                    {isHost && (
                        <TouchableOpacity onPress={() => router.push('/create')} className="p-2">
                            <Ionicons name="settings-outline" size={20} color="#F5FFFF" />
                        </TouchableOpacity>
                    )}
                </View>

                <View className="max-w-2xl mx-auto w-full space-y-12">
                    {/* Room Code */}
                    <Card className="border-primary/30 rounded-3xl" style={{
                        shadowColor: '#00D4AA',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 20,
                        elevation: 10,
                    }}>
                        <CardContent className="p-7 items-center space-y-2">
                            <Text className="text-sm text-muted-foreground mb-2">{t('roomCode')}</Text>
                            <View className="flex-row items-center gap-4">
                                <Text className="text-5xl font-display font-bold tracking-widest text-primary" style={{
                                    textShadowColor: '#00D4AA',
                                    textShadowOffset: { width: 0, height: 0 },
                                    textShadowRadius: 15,
                                }}>
                                    {gameState.roomCode}
                                </Text>
                                <TouchableOpacity onPress={copyRoomCode} className="p-2">
                                    <Ionicons name="copy-outline" size={20} color="#F5FFFF" />
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
                        {!isHost && (
                            <Button
                                variant={gameState.players[1]?.isReady ? 'default' : 'outline'}
                                size="lg"
                                onPress={toggleReady}
                                className="w-full"
                            >
                                <Text className={`font-display font-bold ${gameState.players[1]?.isReady ? 'text-primary-foreground' : 'text-primary'
                                    }`}>
                                    {gameState.players[1]?.isReady ? t('ready') + ' ✅' : t('notReady')}
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
                                    <Ionicons name="play" size={24} color="#0D1321" />
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
