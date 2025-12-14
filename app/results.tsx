import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
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
    const { height: windowHeight } = useWindowDimensions();
    const isCompact = windowHeight < 760;

    const [showConfetti, setShowConfetti] = useState(false);
    const [revealedRanks, setRevealedRanks] = useState<number[]>([]);
    const [highlights] = useState<string | null>(null);
    const [isLoadingHighlights] = useState(false);
    const [view, setView] = useState<'podium' | 'rankings' | 'highlights'>('podium');
    const [rankPage, setRankPage] = useState(0);

    const players = gameState?.players.length
        ? [...gameState.players].sort((a, b) => b.score - a.score)
        : demoPlayers;
    const winner = players[0];

    useEffect(() => {
        const top = Math.min(4, players.length);
        const revealSequence = Array.from({ length: top }, (_, i) => top - 1 - i);

        const timer1 = setTimeout(() => setRevealedRanks(revealSequence.slice(0, 1)), 500);
        const timer2 = setTimeout(() => setRevealedRanks(revealSequence.slice(0, 2)), 1000);
        const timer3 = setTimeout(() => setRevealedRanks(revealSequence.slice(0, 3)), 1500);
        const timer4 = setTimeout(() => {
            setRevealedRanks(Array.from({ length: players.length }, (_, i) => i));
            setShowConfetti(true);
        }, 2000);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [players.length]);

    useEffect(() => {
        setRankPage(0);
    }, [view, players.length, isCompact]);

    // Generate AI highlights when confetti starts
    useEffect(() => {
        if (!showConfetti || highlights || isLoadingHighlights) return;
    }, [showConfetti, highlights, isLoadingHighlights]);

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

    const ranksPerPage = isCompact ? 4 : 6;
    const totalRankPages = Math.max(1, Math.ceil(players.length / ranksPerPage));
    const clampedRankPage = Math.min(rankPage, totalRankPages - 1);
    const rankStart = clampedRankPage * ranksPerPage;
    const rankEnd = Math.min(players.length, rankStart + ranksPerPage);
    const visiblePlayers = players.slice(rankStart, rankEnd);

    const TabButton: React.FC<{ id: 'podium' | 'rankings' | 'highlights'; label: string; icon: string }> = ({
        id,
        label,
        icon,
    }) => (
        <TouchableOpacity
            onPress={() => setView(id)}
            className={`flex-1 ${isCompact ? 'py-2' : 'py-3'} rounded-2xl border ${view === id ? 'bg-primary/15 border-primary' : 'bg-muted/50 border-transparent'}`}
        >
            <View className="flex-row items-center justify-center gap-2">
                <Text className={isCompact ? 'text-base' : 'text-lg'}>{icon}</Text>
                {!isCompact && (
                    <Text className={`font-display font-bold ${view === id ? 'text-primary' : 'text-muted-foreground'}`}>
                        {label}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="game" />
            {/* Animated Confetti */}
            <ConfettiAnimation show={showConfetti} />

            <View className={`flex-1 ${isCompact ? 'p-4' : 'p-6'} max-w-5xl w-full self-center`}>
                {/* Header */}
                <View className={`items-center ${isCompact ? 'pt-2' : 'pt-6'} ${isCompact ? 'mb-3' : 'mb-5'}`}>
                    <Logo size={isCompact ? 'sm' : 'md'} animated={false} />
                </View>

                {/* Title + Tabs */}
                <View className={isCompact ? 'space-y-3' : 'space-y-4'}>
                    <View className="items-center">
                        <Text className={`${isCompact ? 'text-3xl' : 'text-4xl'} font-display font-bold text-foreground ${isCompact ? 'mb-0.5' : 'mb-2'}`}>
                            {t('gameOver')}
                        </Text>
                        {!isCompact && (
                            <Text className="text-muted-foreground">{t('finalStandings')}</Text>
                        )}
                    </View>

                    <View className="flex-row gap-2">
                        <TabButton id="podium" label={t('winner')} icon="🏆" />
                        <TabButton id="rankings" label={t('finalStandings')} icon="📋" />
                        <TabButton id="highlights" label={t('gameHighlights')} icon="✨" />
                    </View>
                </View>

                {/* Content */}
                <View className="flex-1 justify-center">
                    {view === 'podium' && (
                        <Card className="border-accent/50" style={styles.winnerCard}>
                            <CardContent className={`${isCompact ? 'p-5' : 'p-8'} items-center`}>
                                <Ionicons name="trophy" size={isCompact ? 44 : 64} color="#D4A72C" style={{ marginBottom: isCompact ? 10 : 16 }} />
                                <Text className="text-sm text-muted-foreground mb-2">{t('winner')}</Text>
                                <View className={isCompact ? 'items-center mb-3' : 'items-center mb-4'}>
                                    <PlayerAvatar name={winner.name} size={isCompact ? 'md' : 'lg'} showName={false} />
                                </View>
                                <Text className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-display font-bold text-accent mb-2`} style={{
                                    textShadowColor: '#D4A72C',
                                    textShadowOffset: { width: 0, height: 0 },
                                    textShadowRadius: 15,
                                }}>
                                    {winner.name}
                                </Text>
                                <Text className={`${isCompact ? 'text-4xl' : 'text-5xl'} font-display font-bold text-primary`}>
                                    {winner.score} <Text className="text-lg">{t('points')}</Text>
                                </Text>
                            </CardContent>
                        </Card>
                    )}

                    {view === 'rankings' && (
                        <View className={isCompact ? 'space-y-2' : 'space-y-3'}>
                            {visiblePlayers.map((player, offset) => {
                                const index = rankStart + offset;
                                return (
                                    <View
                                        key={player.id}
                                        style={[{ opacity: revealedRanks.includes(index) ? 1 : 0 }]}
                                    >
                                        <Card className={
                                            index === 0 ? 'border-accent/50 bg-accent/5' :
                                                index === 1 ? 'border-muted-foreground/30' :
                                                    index === 2 ? 'border-secondary/30' : ''
                                        }>
                                            <CardContent className={`${isCompact ? 'p-3' : 'p-4'} flex-row items-center gap-3`}>
                                                <Text className={`${isCompact ? 'text-2xl w-10' : 'text-3xl w-12'} text-center`}>
                                                    {getRankEmoji(index)}
                                                </Text>
                                                <PlayerAvatar
                                                    name={player.name}
                                                    size={isCompact ? 'sm' : 'md'}
                                                    isHost={player.isHost}
                                                    showName={false}
                                                />
                                                <View className="flex-1">
                                                    <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-semibold ${index === 0 ? 'text-accent' : 'text-foreground'}`}>
                                                        {player.name}
                                                    </Text>
                                                    {player.isHost && (
                                                        <Text className="text-xs text-muted-foreground">({t('host')})</Text>
                                                    )}
                                                </View>
                                                <View className="items-end">
                                                    <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold ${index === 0 ? 'text-accent' : 'text-primary'}`}>
                                                        {player.score}
                                                    </Text>
                                                    {!isCompact && (
                                                        <Text className="text-sm text-muted-foreground">{t('points')}</Text>
                                                    )}
                                                </View>
                                            </CardContent>
                                        </Card>
                                    </View>
                                );
                            })}

                            {totalRankPages > 1 && (
                                <View className="flex-row items-center justify-between">
                                    <Button
                                        variant="outline"
                                        onPress={() => setRankPage((p) => Math.max(0, p - 1))}
                                        disabled={clampedRankPage === 0}
                                    >
                                        <Text className="font-display font-bold text-primary">{t('back')}</Text>
                                    </Button>
                                    <Text className="text-sm text-muted-foreground">
                                        {clampedRankPage + 1}/{totalRankPages}
                                    </Text>
                                    <Button
                                        variant="outline"
                                        onPress={() => setRankPage((p) => Math.min(totalRankPages - 1, p + 1))}
                                        disabled={clampedRankPage >= totalRankPages - 1}
                                    >
                                        <Text className="font-display font-bold text-primary">{t('next')}</Text>
                                    </Button>
                                </View>
                            )}
                        </View>
                    )}

                    {view === 'highlights' && (
                        <Card className="border-primary/30 bg-primary/5 rounded-3xl">
                            <CardContent className={isCompact ? 'p-4' : 'p-5'}>
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
                </View>

                {/* Actions */}
                <View className={`flex-row gap-4 ${isCompact ? 'pt-3' : 'pt-4'}`}>
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
