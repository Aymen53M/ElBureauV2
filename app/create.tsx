import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeArea';
import { useRouter } from '@/lib/router';
import { Ionicons } from '@/components/ui/Ionicons';
import Slider from '@/components/ui/Slider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Logo from '@/components/Logo';
import ScreenBackground from '@/components/ui/ScreenBackground';
import ThemeSelector from '@/components/ThemeSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame, Difficulty, QuestionType } from '@/contexts/GameContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { createRoom } from '@/services/roomService';

const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'mixed'];
const questionTypes: { type: QuestionType; icon: string }[] = [
    { type: 'multiple-choice', icon: '📝' },
    { type: 'open-ended', icon: '✍️' },
    { type: 'true-false', icon: '✓✗' },
];

export default function CreateRoom() {
    const router = useRouter();
    const { t, language, isRTL } = useLanguage();
    const { apiKey, playerName, playerId, setGameState, setCurrentPlayer } = useGame();
    const { height: windowHeight } = useWindowDimensions();
    const isCompact = windowHeight < 760;

    const [theme, setTheme] = useState('movies');
    const [customTheme, setCustomTheme] = useState('');
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    const [questionCount, setQuestionCount] = useState(10);
    const [timePerQuestion, setTimePerQuestion] = useState(30);
    const [questionType, setQuestionType] = useState<QuestionType>('multiple-choice');

    const [step, setStep] = useState(0);
    const maxStep = 3;

    const canCreate = apiKey && playerName;

    const getDifficultyColor = (d: Difficulty, isSelected: boolean) => {
        if (!isSelected) return 'bg-muted border-transparent';
        switch (d) {
            case 'easy': return 'bg-neon-green/20 border-neon-green';
            case 'medium': return 'bg-accent/20 border-accent';
            case 'hard': return 'bg-destructive/20 border-destructive';
            case 'mixed': return 'bg-secondary/20 border-secondary';
        }
    };

    const handleCreate = async () => {
        if (!canCreate) {
            Alert.alert(
                t('setupRequired'),
                t('setupRequiredDesc'),
                [
                    { text: t('goToSettings'), onPress: () => router.push('/settings') },
                    { text: t('cancel'), style: 'cancel' },
                ]
            );
            return;
        }

        if (!isSupabaseConfigured) {
            Alert.alert('Supabase', 'Realtime is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
            return;
        }

        if (!playerId) {
            Alert.alert(t('loading'), t('loading'));
            return;
        }

        const hostId = playerId;
        const hostPlayer = {
            id: hostId,
            name: playerName,
            score: 0,
            isHost: true,
            isReady: true,
            usedBets: [],
            hasApiKey: true,
            language,
        };

        const settings = {
            theme: theme === 'custom' ? 'custom' : theme,
            customTheme: theme === 'custom' ? customTheme : undefined,
            difficulty,
            numberOfQuestions: questionCount,
            timePerQuestion,
            questionType,
            language,
            hintsEnabled: true,
        };

        let roomCode = '';
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            roomCode = Math.floor(Math.random() * 1_000_000)
                .toString()
                .padStart(6, '0');
            try {
                const { room, players } = await createRoom({
                    roomCode,
                    hostPlayer,
                    settings,
                });

                setGameState({
                    roomCode: room.room_code,
                    phase: 'lobby',
                    players,
                    currentQuestion: 0,
                    questions: [],
                    settings: room.settings,
                    hostId: room.host_player_id,
                    hostApiKey: apiKey,
                    playerApiKeys: { [hostId]: apiKey },
                    answers: {},
                });

                setCurrentPlayer(hostPlayer);
                router.push('/lobby');
                return;
            } catch (err) {
                lastError = err;
                console.error('Create room failed', { roomCode, err });
                const msg = err instanceof Error ? err.message.toLowerCase() : '';
                if (!msg.includes('duplicate') && !msg.includes('unique')) {
                    break;
                }
            }
        }

        const fallbackMsg = typeof lastError === 'string'
            ? lastError
            : lastError instanceof Error
                ? lastError.message
                : 'Failed to create room';
        Alert.alert(t('createRoom'), `${fallbackMsg}\nRoom code: ${roomCode}`);
    };

    const canProceedStep0 = theme !== 'custom' || !!customTheme.trim();

    const handleBack = () => {
        if (step > 0) {
            setStep((s) => Math.max(0, s - 1));
        } else {
            router.back();
        }
    };

    const handleNext = () => {
        if (step === 0 && !canProceedStep0) return;
        setStep((s) => Math.min(maxStep, s + 1));
    };

    const nextLabel = step === maxStep ? t('createRoom') : t('next');
    const nextDisabled =
        (step === 0 && !canProceedStep0) ||
        (step === maxStep && (!canCreate || (theme === 'custom' && !customTheme)));

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="default" />
            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View className={`${isCompact ? 'p-4' : 'p-7'} max-w-4xl w-full self-center flex-1 ${isCompact ? 'space-y-4' : 'space-y-6'}`}>
                    {/* Header */}
                    <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-4 ${isCompact ? 'pt-2' : 'pt-8'}`}>
                        <TouchableOpacity onPress={handleBack} className="p-2">
                            <Ionicons name="arrow-back" size={24} color="#2B1F17" />
                        </TouchableOpacity>
                        <Logo size="sm" animated={false} />
                        <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold text-foreground flex-1`}>
                            {t('createRoom')}
                        </Text>
                        <View className="flex-row items-center gap-1">
                            {Array.from({ length: maxStep + 1 }, (_, i) => (
                                <View
                                    key={i}
                                    className={`${i === step ? 'bg-primary' : 'bg-muted'} ${isCompact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full`}
                                />
                            ))}
                        </View>
                    </View>

                    {/* API Key Warning */}
                    {!canCreate && (
                        <Card className="border-destructive/50 bg-destructive/10 rounded-3xl">
                            <CardContent className={`${isCompact ? 'p-4' : 'p-5'} flex-row items-center gap-3`}>
                                <Text className={isCompact ? 'text-xl' : 'text-2xl'}>⚠️</Text>
                                <View className="flex-1">
                                    <Text className="font-semibold text-foreground">{t('setupRequiredLabel')}</Text>
                                    {!isCompact && (
                                        <Text className="text-sm text-muted-foreground">
                                            {t('setupRequiredMessage')}
                                        </Text>
                                    )}
                                </View>
                                <Button size="sm" variant="outline" onPress={() => router.push('/settings')}>
                                    <Text className="text-primary font-display">{t('settingsButton')}</Text>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step content */}
                    <View className="flex-1 justify-center">
                        {step === 0 && (
                            <Card className="rounded-3xl">
                                <CardContent className={isCompact ? 'p-5 space-y-3' : 'p-7 space-y-4'}>
                                    <ThemeSelector
                                        selectedTheme={theme}
                                        customTheme={customTheme}
                                        onSelectTheme={setTheme}
                                        onCustomThemeChange={setCustomTheme}
                                        density={isCompact ? 'compact' : 'default'}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {step === 1 && (
                            <View className={isCompact ? 'space-y-4' : 'space-y-6'}>
                                <Card className="rounded-3xl">
                                    <CardHeader className={isCompact ? 'pb-2' : 'pb-4'}>
                                        <View className="flex-row items-center gap-2">
                                            <Ionicons name="flash" size={20} color="#D4A72C" />
                                            <CardTitle className="text-lg">{t('difficulty')}</CardTitle>
                                        </View>
                                    </CardHeader>
                                    <CardContent className={isCompact ? 'space-y-2' : 'space-y-3'}>
                                        <View className="flex-row gap-2">
                                            {difficulties.map((d) => (
                                                <TouchableOpacity
                                                    key={d}
                                                    onPress={() => setDifficulty(d)}
                                                    className={`flex-1 ${isCompact ? 'py-2' : 'py-3'} rounded-xl items-center border-2 ${getDifficultyColor(d, difficulty === d)}`}
                                                >
                                                    <Text className={`font-display font-semibold ${difficulty === d ? 'text-foreground' : 'text-muted-foreground'
                                                        }`}>
                                                        {t(d)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className={isCompact ? 'pb-2' : 'pb-3'}>
                                        <CardTitle className="text-lg">{t('questionType')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <View className="flex-row gap-2">
                                            {questionTypes.map(({ type, icon }) => (
                                                <TouchableOpacity
                                                    key={type}
                                                    onPress={() => setQuestionType(type)}
                                                    className={`flex-1 ${isCompact ? 'py-3' : 'py-4'} rounded-xl items-center border-2 ${questionType === type
                                                        ? 'bg-primary/20 border-primary'
                                                        : 'bg-muted border-transparent'
                                                        }`}
                                                >
                                                    <Text className={isCompact ? 'text-lg mb-0.5' : 'text-xl mb-1'}>{icon}</Text>
                                                    <Text className={`text-xs font-display ${questionType === type ? 'text-primary' : 'text-muted-foreground'
                                                        }`}>
                                                        {t(type === 'multiple-choice' ? 'multipleChoice' : type === 'open-ended' ? 'openEnded' : 'trueFalse')}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </CardContent>
                                </Card>
                            </View>
                        )}

                        {step === 2 && (
                            <Card className="rounded-3xl">
                                <CardHeader className={isCompact ? 'pb-2' : 'pb-4'}>
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="help-circle" size={20} color="#6B3F23" />
                                        <CardTitle className="text-lg">
                                            {t('numberOfQuestions')}: <Text className="text-primary">{questionCount}</Text>
                                        </CardTitle>
                                    </View>
                                </CardHeader>
                                <CardContent className={isCompact ? 'space-y-2' : 'space-y-4'}>
                                    <Slider
                                        value={questionCount}
                                        onValueChange={(val: number) => setQuestionCount(Math.round(val))}
                                        minimumValue={5}
                                        maximumValue={20}
                                        step={1}
                                        minimumTrackTintColor="#C97B4C"
                                        maximumTrackTintColor="#E2CFBC"
                                        thumbTintColor="#C97B4C"
                                    />
                                    <View className="flex-row justify-between mt-1">
                                        <Text className="text-xs text-muted-foreground">5</Text>
                                        <Text className="text-xs text-muted-foreground">20</Text>
                                    </View>
                                </CardContent>
                            </Card>
                        )}

                        {step === 3 && (
                            <Card className="rounded-3xl">
                                <CardHeader className={isCompact ? 'pb-2' : 'pb-4'}>
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="timer" size={20} color="#C97B4C" />
                                        <CardTitle className="text-lg">
                                            {t('timeLeft')}: <Text className="text-secondary">{timePerQuestion}s</Text>
                                        </CardTitle>
                                    </View>
                                </CardHeader>
                                <CardContent className={isCompact ? 'space-y-4' : 'space-y-6'}>
                                    <View className={isCompact ? 'space-y-2' : 'space-y-3'}>
                                        <Slider
                                            value={timePerQuestion}
                                            onValueChange={(val: number) => setTimePerQuestion(Math.round(val))}
                                            minimumValue={10}
                                            maximumValue={60}
                                            step={5}
                                            minimumTrackTintColor="#C97B4C"
                                            maximumTrackTintColor="#E2CFBC"
                                            thumbTintColor="#C97B4C"
                                        />
                                        <View className="flex-row justify-between mt-1">
                                            <Text className="text-xs text-muted-foreground">10s</Text>
                                            <Text className="text-xs text-muted-foreground">60s</Text>
                                        </View>
                                    </View>

                                    <Button
                                        variant="hero"
                                        onPress={handleCreate}
                                        disabled={nextDisabled}
                                        className="w-full py-4 shadow-lg shadow-primary/30"
                                    >
                                        <View className="flex-row items-center gap-3 justify-center">
                                            <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-primary-foreground`}>
                                                {t('createRoom')}
                                            </Text>
                                            <Text className={isCompact ? 'text-lg' : 'text-xl'}>🎉</Text>
                                        </View>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </View>

                    {/* Bottom nav */}
                    <View className="flex-row gap-3">
                        <Button
                            variant="outline"
                            onPress={handleBack}
                            className="flex-1"
                        >
                            <Text className="font-display font-bold text-primary">{t('back')}</Text>
                        </Button>
                        <Button
                            variant="hero"
                            onPress={step === maxStep ? handleCreate : handleNext}
                            disabled={nextDisabled}
                            className="flex-1"
                        >
                            <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-primary-foreground`}>
                                {nextLabel}
                            </Text>
                        </Button>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
