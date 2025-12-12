import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Logo from '@/components/Logo';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame } from '@/contexts/GameContext';

export default function Settings() {
    const router = useRouter();
    const { t } = useLanguage();
    const { apiKey, setApiKey, playerName, setPlayerName } = useGame();

    const [localApiKey, setLocalApiKey] = useState(apiKey);
    const [localPlayerName, setLocalPlayerName] = useState(playerName);
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await setApiKey(localApiKey);
        await setPlayerName(localPlayerName);
        setIsSaving(false);
        router.back();
    };

    const hasChanges = localApiKey !== apiKey || localPlayerName !== playerName;

    const openAIStudio = () => {
        Linking.openURL('https://aistudio.google.com/app/apikey');
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-4 max-w-4xl w-full self-center pb-10"
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View className="flex-row items-center gap-4 mb-8 pt-8">
                    <TouchableOpacity onPress={() => router.back()} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="#F5FFFF" />
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
                                <Ionicons name="person-outline" size={20} color="#00D4AA" />
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
                                <Ionicons name="key-outline" size={20} color="#FFCC00" />
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
                                        color="#8FA3B8"
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
                                <Ionicons name="open-outline" size={12} color="#00D4AA" />
                            </TouchableOpacity>
                        </CardContent>
                    </Card>

                    {/* Hosting rule */}
                    <Card className="border-accent/40 bg-accent/10">
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

                    {/* Language */}
                    <Card>
                        <CardHeader>
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="globe-outline" size={20} color="#F06543" />
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
