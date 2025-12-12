import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Logo from '@/components/Logo';
import ThemeSelector from '@/components/ThemeSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame, Difficulty, QuestionType } from '@/contexts/GameContext';

const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'mixed'];
const questionTypes: { type: QuestionType; icon: string }[] = [
    { type: 'multiple-choice', icon: '📝' },
    { type: 'open-ended', icon: '✍️' },
    { type: 'true-false', icon: '✓✗' },
];

export default function CreateRoom() {
    const router = useRouter();
    const { t, language } = useLanguage();
    const { apiKey, playerName, setGameState, setCurrentPlayer } = useGame();

    const [theme, setTheme] = useState('movies');
    const [customTheme, setCustomTheme] = useState('');
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    const [questionCount, setQuestionCount] = useState(10);
    const [timePerQuestion, setTimePerQuestion] = useState(30);
    const [questionType, setQuestionType] = useState<QuestionType>('multiple-choice');

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

    const handleCreate = () => {
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

        // Generate room code
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Initialize game state
        const hostId = 'host-' + Date.now();
        const hostPlayer = {
            id: hostId,
            name: playerName,
            score: 0,
            isHost: true,
            isReady: true,
            usedBets: [],
            hasApiKey: true,
        };

        setGameState({
            roomCode,
            phase: 'lobby',
            players: [hostPlayer],
            currentQuestion: 0,
            questions: [],
            settings: {
                theme: theme === 'custom' ? 'custom' : theme,
                customTheme: theme === 'custom' ? customTheme : undefined,
                difficulty,
                numberOfQuestions: questionCount,
                timePerQuestion,
                questionType,
                language,
                hintsEnabled: true,
            },
            hostId,
            hostApiKey: apiKey,
            playerApiKeys: { [hostId]: apiKey },
            answers: {},
        });

        setCurrentPlayer(hostPlayer);

        router.push('/lobby');
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-7 pb-14 max-w-4xl w-full self-center space-y-8"
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View className="flex-row items-center gap-4 mb-6 pt-8">
                    <TouchableOpacity onPress={() => router.back()} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="#F5FFFF" />
                    </TouchableOpacity>
                    <Logo size="sm" animated={false} />
                    <Text className="text-2xl font-display font-bold text-foreground flex-1">
                        {t('createRoom')}
                    </Text>
                </View>

                <View className="max-w-lg mx-auto w-full space-y-8">
                    {/* API Key Warning */}
                    {!canCreate && (
                        <Card className="border-destructive/50 bg-destructive/10 rounded-3xl">
                            <CardContent className="p-5 flex-row items-center gap-3">
                                <Text className="text-2xl">⚠️</Text>
                                <View className="flex-1">
                                    <Text className="font-semibold text-foreground">{t('setupRequiredLabel')}</Text>
                                    <Text className="text-sm text-muted-foreground">
                                        {t('setupRequiredMessage')}
                                    </Text>
                                </View>
                                <Button size="sm" variant="outline" onPress={() => router.push('/settings')}>
                                    <Text className="text-primary font-display">{t('settingsButton')}</Text>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Theme Selection */}
                    <Card className="rounded-3xl">
                        <CardContent className="p-7 space-y-4">
                            <ThemeSelector
                                selectedTheme={theme}
                                customTheme={customTheme}
                                onSelectTheme={setTheme}
                                onCustomThemeChange={setCustomTheme}
                            />
                        </CardContent>
                    </Card>

                    {/* Difficulty */}
                    <Card className="rounded-3xl">
                        <CardHeader className="pb-4">
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="flash" size={20} color="#FFCC00" />
                                <CardTitle className="text-lg">{t('difficulty')}</CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <View className="flex-row gap-2">
                                {difficulties.map((d) => (
                                    <TouchableOpacity
                                        key={d}
                                        onPress={() => setDifficulty(d)}
                                        className={`flex-1 py-3 rounded-xl items-center border-2 ${getDifficultyColor(d, difficulty === d)}`}
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

                    {/* Question Count */}
                    <Card className="rounded-3xl">
                        <CardHeader className="pb-4">
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="help-circle" size={20} color="#00D4AA" />
                                <CardTitle className="text-lg">
                                    {t('numberOfQuestions')}: <Text className="text-primary">{questionCount}</Text>
                                </CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Slider
                                value={questionCount}
                                onValueChange={(val) => setQuestionCount(Math.round(val))}
                                minimumValue={5}
                                maximumValue={20}
                                step={1}
                                minimumTrackTintColor="#00D4AA"
                                maximumTrackTintColor="#212D3D"
                                thumbTintColor="#00D4AA"
                            />
                            <View className="flex-row justify-between mt-1">
                                <Text className="text-xs text-muted-foreground">5</Text>
                                <Text className="text-xs text-muted-foreground">20</Text>
                            </View>
                        </CardContent>
                    </Card>

                    {/* Time per Question */}
                    <Card className="rounded-3xl">
                        <CardHeader className="pb-4">
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="timer" size={20} color="#F06543" />
                                <CardTitle className="text-lg">
                                    {t('timeLeft')}: <Text className="text-secondary">{timePerQuestion}s</Text>
                                </CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent>
                            <Slider
                                value={timePerQuestion}
                                onValueChange={(val) => setTimePerQuestion(Math.round(val))}
                                minimumValue={10}
                                maximumValue={60}
                                step={5}
                                minimumTrackTintColor="#F06543"
                                maximumTrackTintColor="#212D3D"
                                thumbTintColor="#F06543"
                            />
                            <View className="flex-row justify-between mt-1">
                                <Text className="text-xs text-muted-foreground">10s</Text>
                                <Text className="text-xs text-muted-foreground">60s</Text>
                            </View>
                        </CardContent>
                    </Card>

                    {/* Question Type */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">{t('questionType')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <View className="flex-row gap-2">
                                {questionTypes.map(({ type, icon }) => (
                                    <TouchableOpacity
                                        key={type}
                                        onPress={() => setQuestionType(type)}
                                        className={`flex-1 py-4 rounded-xl items-center border-2 ${questionType === type
                                            ? 'bg-primary/20 border-primary'
                                            : 'bg-muted border-transparent'
                                            }`}
                                    >
                                        <Text className="text-xl mb-1">{icon}</Text>
                                        <Text className={`text-xs font-display ${questionType === type ? 'text-primary' : 'text-muted-foreground'
                                            }`}>
                                            {t(type === 'multiple-choice' ? 'multipleChoice' : type === 'open-ended' ? 'openEnded' : 'trueFalse')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </CardContent>
                    </Card>

                    {/* Create Button */}
                    <View className="pt-2">
                        <Button
                            variant="hero"
                            onPress={handleCreate}
                            disabled={!canCreate || (theme === 'custom' && !customTheme)}
                            className="w-full py-4 shadow-lg shadow-primary/30"
                        >
                            <View className="flex-row items-center gap-3 justify-center">
                                <Text className="text-lg font-display font-bold text-primary-foreground">
                                    {t('createRoom')}
                                </Text>
                                <Text className="text-xl">🎉</Text>
                            </View>
                        </Button>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
