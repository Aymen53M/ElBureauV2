

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeArea';
import { useRouter } from '@/lib/router';
import { Ionicons } from '@/components/ui/Ionicons';
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
    const { t, isRTL, language } = useLanguage();
    const { playerName, apiKey, playerId, setGameState, setCurrentPlayer } = useGame();
    const { height: windowHeight } = useWindowDimensions();
    const isCompact = windowHeight < 760;

    const [roomCode, setRoomCode] = useState('');
    const [localPlayerName, setLocalPlayerName] = useState(playerName);
    const [isJoining, setIsJoining] = useState(false);

    const canJoin = roomCode.length === 6 && localPlayerName.trim();

    const handleJoin = async () => {
        if (!canJoin) return;

        if (!isSupabaseConfigured) {
            Alert.alert('Supabase', 'Realtime is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
            return;
        }

        if (!playerId) {
            Alert.alert(t('loading'), t('loading'));
            return;
        }

        setIsJoining(true);

        const normalizedRoomCode = roomCode;
        const joiningPlayer = {
            id: playerId,
            name: localPlayerName,
            score: 0,
            isHost: false,
            isReady: true,
            usedBets: [],
            hasApiKey: !!apiKey,
            language,
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
                        <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white rounded-lg border-2 border-foreground">
                            <Ionicons name="arrow-back" size={24} color="#2B1F17" />
                        </TouchableOpacity>
                        <View className="flex-1 items-center">
                            <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold text-foreground`}>
                                {t('joinRoom')}
                            </Text>
                        </View>
                        <View className="w-10" />
                    </View>

                    <View className="max-w-md mx-auto w-full">
                        <Card className="rounded-lg border-2 border-foreground bg-white transform rotate-1">
                            <CardHeader className={`items-center ${isCompact ? 'space-y-2 pt-1' : 'space-y-4 pt-2'}`}>
                                <View className={`${isCompact ? 'w-14 h-14' : 'w-20 h-20'} rounded-full bg-secondary/20 items-center justify-center border-2 border-foreground/10 ${isCompact ? 'mb-2' : 'mb-4'}`}>
                                    <Ionicons name="people" size={isCompact ? 28 : 40} color="#E3C8A8" />
                                </View>
                                <CardTitle className="text-foreground">{t('joinRoom')}</CardTitle>
                                <CardDescription className="text-center text-muted-foreground font-sans">
                                    {t('enterHostCode')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className={isCompact ? 'space-y-5' : 'space-y-8'}>
                                {/* Player Name */}
                                <View className={isCompact ? 'space-y-2' : 'space-y-4'}>
                                    <Text className="text-sm font-medium text-foreground font-sans">{t('playerName')}</Text>
                                    <Input
                                        value={localPlayerName}
                                        onChangeText={setLocalPlayerName}
                                        placeholder={t('playerNamePlaceholder')}
                                        maxLength={20}
                                        className="bg-white text-foreground"
                                    />
                                </View>

                                {/* Room Code */}
                                <View className={isCompact ? 'space-y-2' : 'space-y-3'}>
                                    <Text className="text-sm font-medium text-foreground font-sans">{t('roomCode')}</Text>
                                    <Input
                                        value={roomCode}
                                        onChangeText={(text) => setRoomCode((text || '').replace(/\D+/g, '').slice(0, 6))}
                                        placeholder={t('enterRoomCode')}
                                        maxLength={6}
                                        keyboardType="number-pad"
                                        className={`text-center ${isCompact ? 'text-xl' : 'text-2xl'} font-display tracking-widest bg-white border-2 border-foreground text-foreground font-bold`}
                                    />
                                </View>

                                {/* Join Button */}
                                <Button
                                    variant="hero"
                                    onPress={handleJoin}
                                    disabled={!canJoin || isJoining}
                                    className="w-full shadow-none"
                                >
                                    <View className="flex-row items-center gap-2">
                                        <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-white`}>
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
