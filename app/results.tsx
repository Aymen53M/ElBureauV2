import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Logo from '@/components/Logo';
import PlayerAvatar from '@/components/PlayerAvatar';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame, Player } from '@/contexts/GameContext';
import { generateGameHighlights } from '@/services/questionService';

const demoPlayers: Player[] = [
    { id: '1', name: 'Alex', score: 45, isHost: true, isReady: true, usedBets: [], hasApiKey: true },
    { id: '2', name: 'Sam', score: 38, isHost: false, isReady: true, usedBets: [], hasApiKey: false },
    { id: '3', name: 'Jordan', score: 32, isHost: false, isReady: true, usedBets: [], hasApiKey: false },
    { id: '4', name: 'Taylor', score: 28, isHost: false, isReady: true, usedBets: [], hasApiKey: false },
];

const CONFETTI_COLORS = ['#C97B4C', '#D1497B', '#D4A72C', '#D9822B', '#2D9C93', '#6B3F23', '#C83A32'];
const CONFETTI_COUNT = 50;

interface ConfettiPiece {
    id: number;
    x: number;
    delay: number;
    duration: number;
    color: string;
    size: number;
    rotation: number;
}

const ConfettiAnimation: React.FC<{ show: boolean }> = ({ show }) => {
    const { height: screenHeight } = Dimensions.get('window');

    const confettiPieces = useMemo<ConfettiPiece[]>(() =>
        Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 2000,
            duration: 3000 + Math.random() * 2000,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            size: 8 + Math.random() * 8,
            rotation: Math.random() * 360,
        })), []
    );

    const animations = useRef(
        confettiPieces.map(() => new Animated.Value(0))
    ).current;

    useEffect(() => {
        if (show) {
            confettiPieces.forEach((piece, index) => {
                const animate = () => {
                    animations[index].setValue(0);
                    Animated.timing(animations[index], {
                        toValue: 1,
                        duration: piece.duration,
                        delay: piece.delay,
                        useNativeDriver: true,
                    }).start(() => {
                        // Reset and repeat
                        if (show) animate();
                    });
                };
                animate();
            });
        }
    }, [show, animations, confettiPieces]);

    if (!show) return null;

    return (
        <View className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
            {confettiPieces.map((piece, index) => {
                const translateY = animations[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, screenHeight + 50],
                });
                const translateX = animations[index].interpolate({
                    inputRange: [0, 0.25, 0.5, 0.75, 1],
                    outputRange: [0, 15, 0, -15, 0],
                });
                const rotate = animations[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${piece.rotation + 720}deg`],
                });
                const opacity = animations[index].interpolate({
                    inputRange: [0, 0.1, 0.9, 1],
                    outputRange: [0, 1, 1, 0],
                });

                return (
                    <Animated.View
                        key={piece.id}
                        style={[
                            styles.confetti,
                            {
                                left: `${piece.x}%`,
                                width: piece.size,
                                height: piece.size,
                                borderRadius: piece.size / 2,
                                backgroundColor: piece.color,
                                transform: [{ translateY }, { translateX }, { rotate }],
                                opacity,
                            },
                        ]}
                    />
                );
            })}
        </View>
    );
};

export default function Results() {
    const router = useRouter();
    const { t } = useLanguage();
    const { gameState, setGameState } = useGame();

    const [showConfetti, setShowConfetti] = useState(false);
    const [revealedRanks, setRevealedRanks] = useState<number[]>([]);
    const [highlights, setHighlights] = useState<string | null>(null);
    const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);

    const players = gameState?.players.length
        ? [...gameState.players].sort((a, b) => b.score - a.score)
        : demoPlayers;
    const winner = players[0];

    useEffect(() => {
        const timer1 = setTimeout(() => setRevealedRanks([3]), 500);
        const timer2 = setTimeout(() => setRevealedRanks([3, 2]), 1000);
        const timer3 = setTimeout(() => setRevealedRanks([3, 2, 1]), 1500);
        const timer4 = setTimeout(() => {
            setRevealedRanks([3, 2, 1, 0]);
            setShowConfetti(true);
        }, 2000);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, []);

    // Generate AI highlights when confetti starts
    useEffect(() => {
        if (showConfetti && gameState?.hostApiKey && !highlights && !isLoadingHighlights) {
            setIsLoadingHighlights(true);
            generateGameHighlights(
                {
                    winner: { name: winner.name, score: winner.score },
                    players: players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost })),
                    theme: gameState.settings.customTheme || gameState.settings.theme,
                    totalQuestions: gameState.settings.numberOfQuestions,
                    language: gameState.settings.language,
                },
                gameState.hostApiKey
            ).then(result => {
                if (result.highlights) {
                    setHighlights(result.highlights);
                }
                setIsLoadingHighlights(false);
            });
        }
    }, [showConfetti, gameState, winner, players, highlights, isLoadingHighlights]);

    const handlePlayAgain = () => {
        setGameState(null);
        router.replace('/');
    };

    const getRankEmoji = (rank: number) => {
        switch (rank) {
            case 0: return '🥇';
            case 1: return '🥈';
            case 2: return '🥉';
            default: return `#${rank + 1}`;
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="game" />
            {/* Animated Confetti */}
            <ConfettiAnimation show={showConfetti} />

            <ScrollView
                className="flex-1"
                contentContainerClassName="p-4 max-w-5xl w-full self-center pb-12"
            >
                {/* Header */}
                <View className="items-center mb-8 pt-8">
                    <Logo size="md" animated={false} />
                </View>

                <View className="max-w-2xl mx-auto w-full space-y-8">
                    {/* Game Over Title */}
                    <View className="items-center">
                        <Text className="text-4xl font-display font-bold text-foreground mb-2">
                            {t('gameOver')}
                        </Text>
                        <Text className="text-muted-foreground">{t('finalStandings')}</Text>
                    </View>

                    {/* Winner Spotlight */}
                    {revealedRanks.includes(0) && (
                        <Card className="border-accent/50" style={styles.winnerCard}>
                            <CardContent className="p-8 items-center">
                                <Ionicons name="trophy" size={64} color="#D4A72C" style={{ marginBottom: 16 }} />
                                <Text className="text-sm text-muted-foreground mb-2">{t('winner')}</Text>
                                <View className="items-center mb-4">
                                    <PlayerAvatar name={winner.name} size="lg" showName={false} />
                                </View>
                                <Text className="text-3xl font-display font-bold text-accent mb-2" style={{
                                    textShadowColor: '#D4A72C',
                                    textShadowOffset: { width: 0, height: 0 },
                                    textShadowRadius: 15,
                                }}>
                                    {winner.name}
                                </Text>
                                <Text className="text-5xl font-display font-bold text-primary">
                                    {winner.score} <Text className="text-lg">{t('points')}</Text>
                                </Text>
                            </CardContent>
                        </Card>
                    )}

                    {/* AI Game Highlights */}
                    {revealedRanks.includes(0) && (
                        <Card className="border-primary/30 bg-primary/5 rounded-3xl">
                            <CardContent className="p-5">
                                <View className="flex-row items-center gap-2 mb-3">
                                    <Text className="text-xl">✨</Text>
                                    <Text className="font-display font-bold text-foreground">
                                        {t('gameHighlights')}
                                    </Text>
                                </View>
                                {isLoadingHighlights ? (
                                    <View className="flex-row items-center gap-3 py-2">
                                        <ActivityIndicator size="small" color="#C97B4C" />
                                        <Text className="text-muted-foreground text-sm">
                                            {t('generatingHighlights')}
                                        </Text>
                                    </View>
                                ) : highlights ? (
                                    <Text className="text-foreground leading-relaxed">
                                        {highlights}
                                    </Text>
                                ) : (
                                    <Text className="text-muted-foreground text-sm italic">
                                        {t('highlightsError')}
                                    </Text>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* All Rankings */}
                    <View className="space-y-3">
                        {players.map((player, index) => (
                            <View
                                key={player.id}
                                style={[
                                    { opacity: revealedRanks.includes(index) ? 1 : 0 },
                                ]}
                            >
                                <Card className={
                                    index === 0 ? 'border-accent/50 bg-accent/5' :
                                        index === 1 ? 'border-muted-foreground/30' :
                                            index === 2 ? 'border-secondary/30' : ''
                                }>
                                    <CardContent className="p-4 flex-row items-center gap-4">
                                        {/* Rank */}
                                        <Text className="text-3xl w-12 text-center">
                                            {getRankEmoji(index)}
                                        </Text>

                                        {/* Avatar */}
                                        <PlayerAvatar
                                            name={player.name}
                                            size="md"
                                            isHost={player.isHost}
                                            showName={false}
                                        />

                                        {/* Name */}
                                        <View className="flex-1">
                                            <Text className={`text-lg font-semibold ${index === 0 ? 'text-accent' : 'text-foreground'
                                                }`}>
                                                {player.name}
                                            </Text>
                                            {player.isHost && (
                                                <Text className="text-xs text-muted-foreground">({t('host')})</Text>
                                            )}
                                        </View>

                                        {/* Score */}
                                        <View className="items-end">
                                            <Text className={`text-2xl font-display font-bold ${index === 0 ? 'text-accent' : 'text-primary'
                                                }`}>
                                                {player.score}
                                            </Text>
                                            <Text className="text-sm text-muted-foreground">{t('points')}</Text>
                                        </View>
                                    </CardContent>
                                </Card>
                            </View>
                        ))}
                    </View>

                    {/* Actions */}
                    <View className="flex-row gap-4 pt-4">
                        <Button
                            variant="hero"
                            onPress={handlePlayAgain}
                            className="flex-1"
                        >
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="refresh" size={20} color="#FFF8EF" />
                                <Text className="font-display font-bold text-primary-foreground">
                                    {t('playAgain')}
                                </Text>
                            </View>
                        </Button>

                        <Button
                            variant="outline"
                            onPress={() => router.replace('/')}
                            className="flex-1"
                        >
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="home" size={20} color="#6B3F23" />
                                <Text className="font-display font-bold text-primary">
                                    {t('home')}
                                </Text>
                            </View>
                        </Button>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    winnerCard: {
        shadowColor: '#D4A72C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    confetti: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        top: -20,
    },
});
