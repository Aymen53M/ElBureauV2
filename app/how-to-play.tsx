import React from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeArea';
import { useRouter } from '@/lib/router';
import { Ionicons } from '@/components/ui/Ionicons';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Logo from '@/components/Logo';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { useLanguage } from '@/contexts/LanguageContext';
import { isCompactLayout } from '@/lib/styles';

export default function HowToPlay() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const { height: windowHeight, width: windowWidth } = useWindowDimensions();
    const isCompact = isCompactLayout({ width: windowWidth, height: windowHeight });

    const [stepIndex, setStepIndex] = React.useState(0);

    const steps = [
        { icon: '🎯', titleKey: 'htpStep1Title', descKey: 'htpStep1Desc' },
        { icon: '🎲', titleKey: 'htpStep2Title', descKey: 'htpStep2Desc' },
        { icon: '🤔', titleKey: 'htpStep3Title', descKey: 'htpStep3Desc' },
        { icon: '✅', titleKey: 'htpStep4Title', descKey: 'htpStep4Desc' },
        { icon: '🏆', titleKey: 'htpStep5Title', descKey: 'htpStep5Desc' },
    ];

    const isTips = stepIndex >= steps.length;
    const active = !isTips ? steps[stepIndex] : null;
    const canPrev = stepIndex > 0;
    const canNext = stepIndex < steps.length;

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="default" />

            <View className={`${isCompact ? 'p-4' : 'p-7'} max-w-3xl w-full self-center flex-1 ${isCompact ? 'space-y-4' : 'space-y-6'}`}>
                {/* Header */}
                <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-4 ${isCompact ? 'pt-2' : 'pt-8'}`}>
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white rounded-lg border-2 border-foreground">
                        <Ionicons name="arrow-back" size={24} color="#2B1F17" />
                    </TouchableOpacity>
                    <Logo size="sm" animated={false} />
                    <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold text-foreground flex-1`}>
                        {t('howToPlay')}
                    </Text>
                    <View className="px-3 py-1 rounded-full bg-white border-2 border-foreground">
                        <Text className="font-display font-bold text-foreground">
                            {isTips ? `${steps.length + 1}/${steps.length + 1}` : `${stepIndex + 1}/${steps.length + 1}`}
                        </Text>
                    </View>
                </View>

                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                    showsVerticalScrollIndicator={false}
                >
                    {!isTips && active && (
                        <Card className="rounded-lg border-2 border-foreground bg-white transform rotate-1">
                            <CardContent className={isCompact ? 'p-4' : 'p-6'}>
                                <View className="items-center">
                                    <View className={`${isCompact ? 'w-14 h-14' : 'w-16 h-16'} rounded-lg bg-primary/10 border-2 border-primary items-center justify-center`}>
                                        <Text className={isCompact ? 'text-2xl' : 'text-3xl'}>{active.icon}</Text>
                                    </View>
                                </View>
                                <View className={isCompact ? 'mt-3 space-y-2' : 'mt-4 space-y-3'}>
                                    <Text className={`${isCompact ? 'text-lg' : 'text-xl'} font-display font-bold text-foreground text-center`}>
                                        {stepIndex + 1}. {t(active.titleKey)}
                                    </Text>
                                    <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-muted-foreground text-center`}>
                                        {t(active.descKey)}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>
                    )}

                    {isTips && (
                        <Card className="border-2 border-accent bg-accent/10 transform -rotate-1">
                            <CardContent className={isCompact ? 'p-4 space-y-3' : 'p-6 space-y-4'}>
                                <Text className={`${isCompact ? 'text-lg' : 'text-xl'} font-display font-bold text-accent text-center`}>
                                    💡 {t('proTips')}
                                </Text>
                                <View className={isCompact ? 'space-y-1.5' : 'space-y-2'}>
                                    <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-foreground`}>• {t('proTip1')}</Text>
                                    <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-foreground`}>• {t('proTip2')}</Text>
                                    <Text className={`${isCompact ? 'text-sm' : 'text-base'} text-foreground`}>• {t('proTip3')}</Text>
                                </View>
                            </CardContent>
                        </Card>
                    )}
                </ScrollView>

                <View className="flex-row gap-3">
                    <Button
                        variant="outline"
                        onPress={() => (canPrev ? setStepIndex((s) => Math.max(0, s - 1)) : router.back())}
                        className="flex-1 border-2 border-foreground bg-white"
                    >
                        <Text className="font-display font-bold text-foreground">{t('back')}</Text>
                    </Button>
                    <Button
                        variant="hero"
                        onPress={() => {
                            if (canNext) setStepIndex((s) => Math.min(steps.length, s + 1));
                            else router.back();
                        }}
                        className="flex-1 border-2 border-foreground"
                    >
                        <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-white`}>
                            {canNext ? t('next') : t('confirm')}
                        </Text>
                    </Button>
                </View>
            </View>
        </SafeAreaView>
    );
}
