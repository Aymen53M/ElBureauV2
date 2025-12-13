import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Logo from '@/components/Logo';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame } from '@/contexts/GameContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { joinRoom } from '@/services/roomService';

export default function JoinRoom() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const { playerName, apiKey, playerId, setGameState, setCurrentPlayer } = useGame();
    const { height: windowHeight } = useWindowDimensions();
    const isCompact = windowHeight < 760;

    const [roomCode, setRoomCode] = useState('');
    const [localPlayerName, setLocalPlayerName] = useState(playerName);
    const [isJoining, setIsJoining] = useState(false);

    const canJoin = roomCode.length >= 4 && localPlayerName.trim();

    const handleJoin = async () => {
        if (!canJoin) return;

        if (!isSupabaseConfigured) {
            Alert.alert('Supabase', 'Realtime is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
            return;
        }

        if (!playerId) {
            Alert.alert(t('loading'), t('loading'));
            return;
        }

        setIsJoining(true);

        const normalizedRoomCode = roomCode.toUpperCase();
        const joiningPlayer = {
            id: playerId,
            name: localPlayerName,
            score: 0,
            isHost: false,
            isReady: false,
            usedBets: [],
            hasApiKey: !!apiKey,
        };

        try {
            const { room, players } = await joinRoom({
                roomCode: normalizedRoomCode,
                player: joiningPlayer,
            });

            setGameState({
                roomCode: normalizedRoomCode,
                phase: 'lobby',
                players,
                currentQuestion: 0,
                questions: [],
                settings: room.settings,
                hostId: room.host_player_id,
                hostApiKey: undefined,
                playerApiKeys: apiKey ? { [joiningPlayer.id]: apiKey } : {},
                answers: {},
            });

            setCurrentPlayer(joiningPlayer);
            setIsJoining(false);
            router.push('/lobby');
        } catch (err) {
            setIsJoining(false);
            const code = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
            Alert.alert(
                t('joinRoom'),
                code === 'ROOM_NOT_FOUND'
                    ? t('enterHostCode')
                    : `Failed to join room (${code}).`
            );
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="default" />
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View className={`${isCompact ? 'p-4' : 'p-7'} flex-1 justify-center max-w-md w-full self-center ${isCompact ? 'space-y-6' : 'space-y-8'}`}>
                    {/* Header */}
                    <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-4 ${isCompact ? 'mb-4 pt-2' : 'mb-8 pt-8'}`}>
                        <TouchableOpacity onPress={() => router.back()} className="p-2">
                            <Ionicons name="arrow-back" size={24} color="#2B1F17" />
                        </TouchableOpacity>
                        <Logo size="sm" animated={false} />
                        <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold text-foreground flex-1`}>
                            {t('joinRoom')}
                        </Text>
                    </View>

                    <View className="max-w-md mx-auto w-full">
                        <Card className="rounded-3xl">
                            <CardHeader className={`items-center ${isCompact ? 'space-y-2 pt-1' : 'space-y-4 pt-2'}`}>
                                <View className={`${isCompact ? 'w-14 h-14' : 'w-20 h-20'} rounded-full bg-secondary/20 items-center justify-center ${isCompact ? 'mb-2' : 'mb-4'}`}>
                                    <Ionicons name="people" size={isCompact ? 28 : 40} color="#C83A32" />
                                </View>
                                <CardTitle>{t('joinRoom')}</CardTitle>
                                <CardDescription className="text-center">
                                    {t('enterHostCode')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className={isCompact ? 'space-y-5' : 'space-y-8'}>
                                {/* Player Name */}
                                <View className={isCompact ? 'space-y-2' : 'space-y-4'}>
                                    <Text className="text-sm font-medium text-foreground">{t('playerName')}</Text>
                                    <Input
                                        value={localPlayerName}
                                        onChangeText={setLocalPlayerName}
                                        placeholder={t('playerNamePlaceholder')}
                                        maxLength={20}
                                    />
                                </View>

                                {/* Room Code */}
                                <View className={isCompact ? 'space-y-2' : 'space-y-3'}>
                                    <Text className="text-sm font-medium text-foreground">{t('roomCode')}</Text>
                                    <Input
                                        value={roomCode}
                                        onChangeText={(text) => setRoomCode(text.toUpperCase())}
                                        placeholder={t('enterRoomCode')}
                                        maxLength={6}
                                        autoCapitalize="characters"
                                        className={`text-center ${isCompact ? 'text-xl' : 'text-2xl'} font-display tracking-widest`}
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
                                        <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-primary-foreground`}>
                                            {isJoining ? t('loading') : t('joinRoom')}
                                        </Text>
                                        <Text className={isCompact ? 'text-base' : 'text-lg'}>🚀</Text>
                                    </View>
                                </Button>
                            </CardContent>
                        </Card>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
