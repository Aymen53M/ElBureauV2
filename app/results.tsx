import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Logo from '@/components/Logo';
import PlayerAvatar from '@/components/PlayerAvatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame, Player } from '@/contexts/GameContext';

const demoPlayers: Player[] = [
    { id: '1', name: 'Alex', score: 45, isHost: true, isReady: true, usedBets: [], hasApiKey: true },
    { id: '2', name: 'Sam', score: 38, isHost: false, isReady: true, usedBets: [], hasApiKey: false },
    { id: '3', name: 'Jordan', score: 32, isHost: false, isReady: true, usedBets: [], hasApiKey: false },
    { id: '4', name: 'Taylor', score: 28, isHost: false, isReady: true, usedBets: [], hasApiKey: false },
];

export default function Results() {
    const router = useRouter();
    const { t } = useLanguage();
    const { gameState, setGameState } = useGame();

    const [showConfetti, setShowConfetti] = useState(false);
    const [revealedRanks, setRevealedRanks] = useState<number[]>([]);

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
            {/* Confetti placeholders */}
            {showConfetti && (
                <View className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(30)].map((_, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.confetti,
                                {
                                    left: `${Math.random() * 100}%`,
                                    backgroundColor: ['#00D4AA', '#FF66AA', '#FFD93D', '#FF8C42', '#8B5CF6'][i % 5],
                                }
                            ]}
                        />
                    ))}
                </View>
            )}

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
                                <Ionicons name="trophy" size={64} color="#FFCC00" style={{ marginBottom: 16 }} />
                                <Text className="text-sm text-muted-foreground mb-2">{t('winner')}</Text>
                                <View className="items-center mb-4">
                                    <PlayerAvatar name={winner.name} size="lg" showName={false} />
                                </View>
                                <Text className="text-3xl font-display font-bold text-accent mb-2" style={{
                                    textShadowColor: '#FFCC00',
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
                                <Ionicons name="refresh" size={20} color="#0D1321" />
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
                                <Ionicons name="home" size={20} color="#00D4AA" />
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
        shadowColor: '#FFCC00',
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
