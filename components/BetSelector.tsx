import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';

interface BetSelectorProps {
    totalQuestions: number;
    usedBets: number[];
    selectedBet: number | null;
    onSelectBet: (bet: number) => void;
}

const BetSelector: React.FC<BetSelectorProps> = ({
    totalQuestions,
    usedBets,
    selectedBet,
    onSelectBet,
}) => {
    const { t } = useLanguage();

    // Generate bet options from 1 to totalQuestions
    const betOptions = Array.from({ length: totalQuestions }, (_, i) => i + 1);

    return (
        <View className="space-y-4">
            <View className="items-center">
                <Text className="text-2xl font-display font-bold text-foreground mb-2">
                    {t('placeBet')}
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                    {t('betDescription')}
                </Text>
            </View>

            {/* Bet grid */}
            <View className="flex-row flex-wrap gap-3 justify-center py-4">
                {betOptions.map((bet) => {
                    const isUsed = usedBets.includes(bet);
                    const isSelected = selectedBet === bet;

                    return (
                        <TouchableOpacity
                            key={bet}
                            onPress={() => !isUsed && onSelectBet(bet)}
                            disabled={isUsed}
                            className={`w-14 h-14 rounded-xl items-center justify-center ${isUsed
                                ? 'bg-muted/50 border-2 border-border/50'
                                : isSelected
                                    ? 'bg-accent border-2 border-accent'
                                    : 'bg-muted border-2 border-border'
                                }`}
                            style={isSelected ? {
                                shadowColor: '#D4A72C',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.5,
                                shadowRadius: 15,
                                elevation: 8,
                            } : undefined}
                        >
                            <Text className={`text-xl font-display font-bold ${isUsed
                                ? 'text-muted-foreground opacity-50'
                                : isSelected
                                    ? 'text-accent-foreground'
                                    : 'text-foreground'
                                }`}>
                                {bet}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

export default BetSelector;
