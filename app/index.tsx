import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Logo from '@/components/Logo';
import Button from '@/components/ui/Button';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Index() {
    const { t } = useLanguage();

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="absolute inset-0 overflow-hidden">
                <View className="absolute top-20 left-4 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
                <View className="absolute bottom-20 right-4 w-80 h-80 rounded-full bg-secondary/10 blur-3xl" />
                <View className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
                <Text className="absolute top-12 right-8 text-4xl opacity-20">🎯</Text>
                <Text className="absolute bottom-32 left-8 text-3xl opacity-20">🎲</Text>
                <Text className="absolute top-32 right-24 text-2xl opacity-20">✨</Text>
                <Text className="absolute bottom-20 right-24 text-3xl opacity-20">🏆</Text>
            </View>

            <View className="flex-row items-center justify-between px-6 pt-12 pb-8 max-w-5xl w-full self-center">
                <LanguageSelector compact />
                <Link href="/settings" asChild>
                    <TouchableOpacity className="p-2">
                        <Ionicons name="settings-outline" size={24} color="#F5FFFF" />
                    </TouchableOpacity>
                </Link>
            </View>

            <ScrollView
                contentContainerClassName="flex-1 items-center justify-center px-6 max-w-5xl w-full self-center space-y-14"
                showsVerticalScrollIndicator={false}
            >
                <View className="items-center space-y-12 w-full">
                    <View className="mb-6">
                        <Logo size="xl" animated />
                    </View>
                    <Text className="text-xl text-muted-foreground font-display text-center">
                        {t('tagline')}
                    </Text>
                    <View className="w-full space-y-6 pt-8">
                        <Link href="/create" asChild>
                            <Button variant="hero" className="w-full rounded-full py-5">
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="add-circle-outline" size={24} color="#0D1321" />
                                    <Text className="text-lg font-display font-bold text-primary-foreground">
                                        {t('createRoom')}
                                    </Text>
                                </View>
                            </Button>
                        </Link>

                        <Link href="/join" asChild>
                            <Button variant="secondary" size="lg" className="w-full">
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="people-outline" size={20} color="#0D1321" />
                                    <Text className="font-display font-semibold text-secondary-foreground">
                                        {t('joinRoom')}
                                    </Text>
                                </View>
                            </Button>
                        </Link>

                        <Link href="/how-to-play" asChild>
                            <Button variant="outline" size="lg" className="w-full">
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="help-circle-outline" size={20} color="#00D4AA" />
                                    <Text className="font-display font-semibold text-primary">
                                        {t('howToPlay')}
                                    </Text>
                                </View>
                            </Button>
                        </Link>
                    </View>
                </View>
            </ScrollView>

            <View className="p-4 items-center">
                <Text className="text-muted-foreground text-sm text-center">
                    Powered by AI ✨ Play with friends anywhere!
                </Text>
            </View>
        </SafeAreaView>
    );
}
