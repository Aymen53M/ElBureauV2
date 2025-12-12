import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Logo from '@/components/Logo';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame } from '@/contexts/GameContext';

export default function JoinRoom() {
    const router = useRouter();
    const { t } = useLanguage();
    const { playerName, apiKey, setGameState, setCurrentPlayer } = useGame();

    const [roomCode, setRoomCode] = useState('');
    const [localPlayerName, setLocalPlayerName] = useState(playerName);
    const [isJoining, setIsJoining] = useState(false);

    const canJoin = roomCode.length >= 4 && localPlayerName.trim();

    const handleJoin = async () => {
        if (!canJoin) return;

        setIsJoining(true);

        // Simulate joining (in real app, would connect to server)
        setTimeout(() => {
            const joiningPlayer = {
                id: 'player-' + Date.now(),
                name: localPlayerName,
                score: 0,
                isHost: false,
                isReady: false,
                usedBets: [],
                hasApiKey: !!apiKey,
            };

            setGameState({
                roomCode: roomCode.toUpperCase(),
                phase: 'lobby',
                players: [
                    {
                        id: 'host-mock',
                        name: 'Host Player',
                        score: 0,
                        isHost: true,
                        isReady: true,
                        usedBets: [],
                        hasApiKey: true,
                    },
                    joiningPlayer,
                ],
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
                hostId: 'host-mock',
                hostApiKey: undefined,
                playerApiKeys: { [joiningPlayer.id]: apiKey || '' },
                answers: {},
            });

            setCurrentPlayer(joiningPlayer);

            setIsJoining(false);
            router.push('/lobby');
        }, 1000);
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-4 flex-1 justify-center max-w-md w-full self-center"
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View className="flex-row items-center gap-4 mb-8 pt-8">
                    <TouchableOpacity onPress={() => router.back()} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="#F5FFFF" />
                    </TouchableOpacity>
                    <Logo size="sm" animated={false} />
                    <Text className="text-2xl font-display font-bold text-foreground flex-1">
                        {t('joinRoom')}
                    </Text>
                </View>

                <View className="max-w-md mx-auto w-full">
                    <Card>
                        <CardHeader className="items-center">
                            <View className="w-20 h-20 rounded-full bg-secondary/20 items-center justify-center mb-4">
                                <Ionicons name="people" size={40} color="#F06543" />
                            </View>
                            <CardTitle>{t('joinRoom')}</CardTitle>
                            <CardDescription className="text-center">
                                Enter the room code shared by your host
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Player Name */}
                            <View className="space-y-2">
                                <Text className="text-sm font-medium text-foreground">{t('playerName')}</Text>
                                <Input
                                    value={localPlayerName}
                                    onChangeText={setLocalPlayerName}
                                    placeholder={t('playerNamePlaceholder')}
                                    maxLength={20}
                                />
                            </View>

                            {/* Room Code */}
                            <View className="space-y-2">
                                <Text className="text-sm font-medium text-foreground">{t('roomCode')}</Text>
                                <Input
                                    value={roomCode}
                                    onChangeText={(text) => setRoomCode(text.toUpperCase())}
                                    placeholder={t('enterRoomCode')}
                                    maxLength={6}
                                    autoCapitalize="characters"
                                    className="text-center text-2xl font-display tracking-widest"
                                />
                            </View>

                            {/* Join Button */}
                            <Button
                                variant="hero"
                                onPress={handleJoin}
                                disabled={!canJoin || isJoining}
                                className="w-full"
                            >
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-lg font-display font-bold text-primary-foreground">
                                        {isJoining ? t('loading') : t('joinRoom')}
                                    </Text>
                                    <Text className="text-lg">🚀</Text>
                                </View>
                            </Button>
                        </CardContent>
                    </Card>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
