import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeArea';
import { useRouter } from '@/lib/router';
import { Ionicons } from '@/components/ui/Ionicons';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Logo from '@/components/Logo';
import ScreenBackground from '@/components/ui/ScreenBackground';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame } from '@/contexts/GameContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { updatePlayerState } from '@/services/roomService';

export default function Settings() {
    const router = useRouter();
    const { t, isRTL, language } = useLanguage();
    const { apiKey, setApiKey, playerName, setPlayerName, gameState, currentPlayer, setGameState, setCurrentPlayer, soundEnabled, setSoundEnabled, animationsEnabled, setAnimationsEnabled } = useGame();

    const initialLanguageRef = React.useRef(language);

    const [localApiKey, setLocalApiKey] = useState(apiKey);
    const [localPlayerName, setLocalPlayerName] = useState(playerName);
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await setApiKey(localApiKey);
        await setPlayerName(localPlayerName);

        if (isSupabaseConfigured && gameState?.roomCode && currentPlayer?.id) {
            const hasKey = !!localApiKey?.trim();
            try {
                await updatePlayerState({
                    roomCode: gameState.roomCode,
                    playerId: currentPlayer.id,
                    patch: {
                        has_api_key: hasKey,
                        name: localPlayerName,
                        language,
                    },
                });

                setCurrentPlayer((prev) => (prev ? { ...prev, hasApiKey: hasKey, name: localPlayerName, language } : prev));
                setGameState((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        players: prev.players.map((p) =>
                            p.id === currentPlayer.id ? { ...p, hasApiKey: hasKey, name: localPlayerName, language } : p
                        ),
                    };
                });
            } catch {
                // noop
            }
        }

        setIsSaving(false);
        router.back();
    };

    const hasChanges = localApiKey !== apiKey || localPlayerName !== playerName || language !== initialLanguageRef.current;

    const openAIStudio = () => {
        Linking.openURL('https://aistudio.google.com/app/apikey');
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="default" />
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-4 max-w-4xl w-full self-center pb-10"
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-4 mb-8 pt-8`}>
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white rounded-lg border-2 border-foreground">
                        <Ionicons name="arrow-back" size={24} color="#2B1F17" />
                    </TouchableOpacity>
                    <Logo size="sm" animated={false} />
                    <Text className="text-2xl font-display font-bold text-foreground flex-1">
                        {t('settings')}
                    </Text>
                </View>

                <View className="max-w-lg mx-auto w-full space-y-6">
                    {/* Player Name */}
                    <Card>
                        <CardHeader>
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="person-outline" size={20} color="#6B3F23" />
                                <CardTitle>{t('playerName')}</CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent>
                            <Input
                                value={localPlayerName}
                                onChangeText={setLocalPlayerName}
                                placeholder={t('playerNamePlaceholder')}
                                maxLength={20}
                            />
                        </CardContent>
                    </Card>

                    {/* API Key */}
                    <Card>
                        <CardHeader>
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="key-outline" size={20} color="#D4A72C" />
                                <CardTitle>{t('apiKey')}</CardTitle>
                            </View>
                            <CardDescription>
                                {t('apiKeyDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <View className="relative">
                                <Input
                                    secureTextEntry={!showApiKey}
                                    value={localApiKey}
                                    onChangeText={setLocalApiKey}
                                    placeholder={t('apiKeyPlaceholder')}
                                />
                                <TouchableOpacity
                                    className="absolute right-3 top-3"
                                    onPress={() => setShowApiKey(!showApiKey)}
                                >
                                    <Ionicons
                                        name={showApiKey ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color="#7B6657"
                                    />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                onPress={openAIStudio}
                                className="flex-row items-center gap-1"
                            >
                                <Text className="text-sm text-primary">
                                    {t('apiKeyCta')}
                                </Text>
                                <Ionicons name="open-outline" size={12} color="#6B3F23" />
                            </TouchableOpacity>
                        </CardContent>
                    </Card>

                    {/* Hosting rule */}
                    <Card className="border-2 border-accent bg-accent/10">
                        <CardContent className="p-4 space-y-2">
                            <View className="flex-row items-center gap-2">
                                <Text className="text-xl">🎙️</Text>
                                <Text className="font-display font-semibold text-foreground">{t('hostingRuleTitle')}</Text>
                            </View>
                            <Text className="text-sm text-foreground">
                                {t('hostingRuleDesc')}
                            </Text>
                        </CardContent>
                    </Card>

                    {/* Audio & Visuals */}
                    <Card>
                        <CardHeader>
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="options-outline" size={20} color="#4A7A68" />
                                <CardTitle>{t('settings')}</CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-xl">🔊</Text>
                                    <Text className="font-display font-semibold text-foreground">{t('soundEffects')}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setSoundEnabled(!soundEnabled)}
                                    className={`w-12 h-7 rounded-full items-center flex-row px-1 border-2 border-foreground ${soundEnabled ? 'bg-success justify-end' : 'bg-muted justify-start'}`}
                                >
                                    <View className="w-4 h-4 rounded-full bg-white border border-foreground" />
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-xl">✨</Text>
                                    <Text className="font-display font-semibold text-foreground">{t('animations')}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setAnimationsEnabled(!animationsEnabled)}
                                    className={`w-12 h-7 rounded-full items-center flex-row px-1 border-2 border-foreground ${animationsEnabled ? 'bg-success justify-end' : 'bg-muted justify-start'}`}
                                >
                                    <View className="w-4 h-4 rounded-full bg-white border border-foreground" />
                                </TouchableOpacity>
                            </View>
                        </CardContent>
                    </Card>

                    {/* Language */}
                    <Card>
                        <CardHeader>
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="globe-outline" size={20} color="#C83A32" />
                                <CardTitle>{t('language')}</CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent>
                            <LanguageSelector />
                        </CardContent>
                    </Card>

                    {/* Save Button */}
                    <Button
                        variant="hero"
                        onPress={handleSave}
                        disabled={!hasChanges || isSaving}
                        className="w-full"
                    >
                        <Text className="text-lg font-display font-bold text-primary-foreground">
                            {isSaving ? t('loading') : t('save')}
                        </Text>
                    </Button>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
