import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeArea';
import { useRouter } from '@/lib/router';
import { Ionicons } from '@/components/ui/Ionicons';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Slider from '@/components/ui/Slider';
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
    const { apiKey, setApiKey, playerName, setPlayerName, gameState, currentPlayer, setGameState, setCurrentPlayer, soundEnabled, setSoundEnabled, animationsEnabled, setAnimationsEnabled, aiTemperature, setAiTemperature } = useGame();

    const { height: windowHeight } = useWindowDimensions();
    const compactHeight = Platform.OS === 'web' ? 900 : 760;
    const isCompact = windowHeight < compactHeight;

    const initialLanguageRef = React.useRef(language);
    const initialAiTemperatureRef = React.useRef(aiTemperature);

    const [localApiKey, setLocalApiKey] = useState(apiKey);
    const [localPlayerName, setLocalPlayerName] = useState(playerName);
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [step, setStep] = useState(0);
    const maxStep = 2;

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

    const hasChanges =
        localApiKey !== apiKey ||
        localPlayerName !== playerName ||
        language !== initialLanguageRef.current ||
        aiTemperature !== initialAiTemperatureRef.current;

    const openAIStudio = () => {
        Linking.openURL('https://aistudio.google.com/app/apikey');
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="default" />

            <View className={`${isCompact ? 'p-4' : 'p-7'} max-w-4xl w-full self-center flex-1 ${isCompact ? 'space-y-4' : 'space-y-6'}`}>
                {/* Header */}
                <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-4 ${isCompact ? 'pt-2' : 'pt-8'}`}>
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white rounded-lg border-2 border-foreground">
                        <Ionicons name="arrow-back" size={24} color="#2B1F17" />
                    </TouchableOpacity>
                    <Logo size="sm" animated={false} />
                    <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold text-foreground flex-1`}>
                        {t('settings')}
                    </Text>
                    <View className="px-3 py-1 rounded-full bg-white border-2 border-foreground">
                        <Text className="font-display font-bold text-foreground">{step + 1}/{maxStep + 1}</Text>
                    </View>
                </View>

                <View className="flex-1 justify-center">
                    <View className={`max-w-lg mx-auto w-full ${isCompact ? 'space-y-4' : 'space-y-6'}`}>
                        {step === 0 && (
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
                        )}

                        {step === 1 && (
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
                                <CardContent className={isCompact ? 'space-y-2' : 'space-y-3'}>
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
                        )}

                        {step === 2 && (
                            <>
                                <Card className="border-2 border-accent bg-accent/10">
                                    <CardContent className={isCompact ? 'p-3 space-y-1.5' : 'p-4 space-y-2'}>
                                        <View className="flex-row items-center gap-2">
                                            <Text className={isCompact ? 'text-lg' : 'text-xl'}>🎙️</Text>
                                            <Text className="font-display font-semibold text-foreground">{t('hostingRuleTitle')}</Text>
                                        </View>
                                        <Text className={isCompact ? 'text-xs text-foreground' : 'text-sm text-foreground'}>
                                            {t('hostingRuleDesc')}
                                        </Text>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <View className="flex-row items-center gap-2">
                                            <Ionicons name="options-outline" size={20} color="#4A7A68" />
                                            <CardTitle>{t('settings')}</CardTitle>
                                        </View>
                                    </CardHeader>
                                    <CardContent className={isCompact ? 'space-y-3' : 'space-y-4'}>
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center gap-2">
                                                <Text className={isCompact ? 'text-lg' : 'text-xl'}>🔊</Text>
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
                                                <Text className={isCompact ? 'text-lg' : 'text-xl'}>✨</Text>
                                                <Text className="font-display font-semibold text-foreground">{t('animations')}</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => setAnimationsEnabled(!animationsEnabled)}
                                                className={`w-12 h-7 rounded-full items-center flex-row px-1 border-2 border-foreground ${animationsEnabled ? 'bg-success justify-end' : 'bg-muted justify-start'}`}
                                            >
                                                <View className="w-4 h-4 rounded-full bg-white border border-foreground" />
                                            </TouchableOpacity>
                                        </View>

                                        <View className={isCompact ? 'space-y-1.5' : 'space-y-2'}>
                                            <View className="flex-row items-center justify-between">
                                                <View className="flex-row items-center gap-2">
                                                    <Text className={isCompact ? 'text-lg' : 'text-xl'}>🤖</Text>
                                                    <Text className="font-display font-semibold text-foreground">{t('aiTemperature')}</Text>
                                                </View>
                                                <Text className="font-display font-semibold text-foreground">{aiTemperature.toFixed(2)}</Text>
                                            </View>
                                            <Slider
                                                value={aiTemperature}
                                                onValueChange={(val: number) => setAiTemperature(Math.round(val * 20) / 20)}
                                                minimumValue={0}
                                                maximumValue={1}
                                                step={0.05}
                                                minimumTrackTintColor="#2B1F17"
                                                maximumTrackTintColor="#E2CFBC"
                                                thumbTintColor="#2B1F17"
                                            />
                                            <View className="flex-row justify-between mt-1">
                                                <Text className="text-xs text-muted-foreground font-sans">0</Text>
                                                <Text className="text-xs text-muted-foreground font-sans">1</Text>
                                            </View>
                                            <Text className="text-xs text-muted-foreground font-sans">{t('aiTemperatureDesc')}</Text>
                                        </View>
                                    </CardContent>
                                </Card>

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
                            </>
                        )}
                    </View>
                </View>

                <View className="flex-row gap-3">
                    <Button
                        variant="outline"
                        onPress={() => {
                            if (step > 0) setStep((s) => Math.max(0, s - 1));
                            else router.back();
                        }}
                        className="flex-1 border-2 border-foreground bg-white"
                    >
                        <Text className="font-display font-bold text-foreground">{t('back')}</Text>
                    </Button>
                    <Button
                        variant="hero"
                        onPress={() => {
                            if (step < maxStep) setStep((s) => Math.min(maxStep, s + 1));
                            else handleSave();
                        }}
                        disabled={step >= maxStep ? (!hasChanges || isSaving) : false}
                        className="flex-1"
                    >
                        <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-primary-foreground`}>
                            {step < maxStep ? t('next') : (isSaving ? t('loading') : t('save'))}
                        </Text>
                    </Button>
                </View>
            </View>
        </SafeAreaView>
    );
}
