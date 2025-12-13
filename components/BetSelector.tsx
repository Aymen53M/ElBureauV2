import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';

interface BetSelectorProps {
    totalQuestions: number;
    usedBets: number[];
    selectedBet: number | null;
    onSelectBet: (bet: number) => void;
    showHeader?: boolean;
    density?: 'default' | 'compact';
    variant?: 'grid' | 'stepper';
}

const BetSelector: React.FC<BetSelectorProps> = ({
    totalQuestions,
    usedBets,
    selectedBet,
    onSelectBet,
    showHeader = true,
    density = 'default',
    variant = 'grid',
}) => {
    const { t } = useLanguage();

    // Generate bet options from 1 to totalQuestions
    const betOptions = Array.from({ length: totalQuestions }, (_, i) => i + 1);

    const isCompact = density === 'compact';
    const isTight = isCompact && totalQuestions > 12;
    const cellClass = isTight
        ? 'w-9 h-9 rounded-md'
        : isCompact
            ? 'w-11 h-11 rounded-lg'
            : 'w-14 h-14 rounded-xl';
    const cellTextClass = isTight ? 'text-sm' : isCompact ? 'text-base' : 'text-xl';
    const gridClass = isTight ? 'gap-1 py-2' : isCompact ? 'gap-2 py-2' : 'gap-3 py-4';

    const firstAvailable = betOptions.find((b) => !usedBets.includes(b)) ?? null;
    const current = selectedBet ?? firstAvailable;

    const findPrevAvailable = (from: number) => {
        for (let v = from - 1; v >= 1; v--) {
            if (!usedBets.includes(v)) return v;
        }
        return null;
    };

    const findNextAvailable = (from: number) => {
        for (let v = from + 1; v <= totalQuestions; v++) {
            if (!usedBets.includes(v)) return v;
        }
        return null;
    };

    return (
        <View className={isCompact ? 'space-y-3' : 'space-y-4'}>
            {showHeader && (
                <View className="items-center">
                    <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold text-foreground mb-2`}>
                        {t('placeBet')}
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                        {t('betDescription')}
                    </Text>
                </View>
            )}

            {variant === 'stepper' ? (
                <View className="flex-row items-center justify-center gap-4 py-2">
                    <TouchableOpacity
                        onPress={() => {
                            if (current === null) return;
                            const prev = findPrevAvailable(current);
                            if (prev !== null) onSelectBet(prev);
                        }}
                        disabled={current === null || findPrevAvailable(current) === null}
                        className={`${isCompact ? 'w-11 h-11' : 'w-14 h-14'} rounded-xl items-center justify-center border-2 border-border bg-muted`}
                    >
                        <Text className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-display font-bold text-foreground`}>-</Text>
                    </TouchableOpacity>

                    <View className={`${isCompact ? 'px-5 py-2' : 'px-7 py-3'} rounded-xl border border-accent/30 bg-accent/10`}>
                        <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-display font-bold text-foreground`}>
                            {current ?? '—'}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => {
                            if (current === null) {
                                if (firstAvailable !== null) onSelectBet(firstAvailable);
                                return;
                            }
                            const next = findNextAvailable(current);
                            if (next !== null) onSelectBet(next);
                        }}
                        disabled={
                            (current === null && firstAvailable === null) ||
                            (current !== null && findNextAvailable(current) === null)
                        }
                        className={`${isCompact ? 'w-11 h-11' : 'w-14 h-14'} rounded-xl items-center justify-center border-2 border-border bg-muted`}
                    >
                        <Text className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-display font-bold text-foreground`}>+</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View className={`flex-row flex-wrap justify-center ${gridClass}`}>
                    {betOptions.map((bet) => {
                        const isUsed = usedBets.includes(bet);
                        const isSelected = selectedBet === bet;

                        return (
                            <TouchableOpacity
                                key={bet}
                                onPress={() => !isUsed && onSelectBet(bet)}
                                disabled={isUsed}
                                className={`${cellClass} items-center justify-center ${isUsed
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
                                <Text className={`${cellTextClass} font-display font-bold ${isUsed
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
            )}
        </View>
    );
};

export default BetSelector;
