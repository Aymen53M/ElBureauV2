import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/Card';
import Logo from '@/components/Logo';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HowToPlay() {
    const router = useRouter();
    const { t } = useLanguage();

    const steps = [
        { icon: '🎯', titleKey: 'htpStep1Title', descKey: 'htpStep1Desc' },
        { icon: '🎲', titleKey: 'htpStep2Title', descKey: 'htpStep2Desc' },
        { icon: '🤔', titleKey: 'htpStep3Title', descKey: 'htpStep3Desc' },
        { icon: '✅', titleKey: 'htpStep4Title', descKey: 'htpStep4Desc' },
        { icon: '🏆', titleKey: 'htpStep5Title', descKey: 'htpStep5Desc' },
    ];

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-4 max-w-3xl w-full self-center pb-10"
            >
                {/* Header */}
                <View className="flex-row items-center gap-4 mb-8 pt-8">
                    <TouchableOpacity onPress={() => router.back()} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="#F5FFFF" />
                    </TouchableOpacity>
                    <Logo size="sm" animated={false} />
                    <Text className="text-2xl font-display font-bold text-foreground flex-1">
                        {t('howToPlay')}
                    </Text>
                </View>

                <View className="max-w-lg mx-auto w-full space-y-4">
                    {steps.map((step, index) => (
                        <Card key={index}>
                            <CardContent className="p-4 flex-row items-start gap-4">
                                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                                    <Text className="text-2xl">{step.icon}</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-lg font-display font-bold text-foreground mb-1">
                                        {index + 1}. {t(step.titleKey)}
                                    </Text>
                                    <Text className="text-muted-foreground">
                                        {t(step.descKey)}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Tips */}
                    <Card className="border-accent/30 bg-accent/5 mt-6">
                        <CardContent className="p-4">
                            <Text className="text-lg font-display font-bold text-accent mb-2">
                                💡 {t('proTips')}
                            </Text>
                            <View className="space-y-2">
                                <Text className="text-foreground">• {t('proTip1')}</Text>
                                <Text className="text-foreground">• {t('proTip2')}</Text>
                                <Text className="text-foreground">• {t('proTip3')}</Text>
                            </View>
                        </CardContent>
                    </Card>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
