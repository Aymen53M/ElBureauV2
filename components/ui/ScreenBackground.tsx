import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from '@/components/ui/LinearGradient';
import Svg, { Circle } from '@/components/ui/Svg';
import { twMerge } from 'tailwind-merge';
import { useLanguage } from '@/contexts/LanguageContext';

type Variant = 'default' | 'home' | 'game';

interface ScreenBackgroundProps {
    className?: string;
    variant?: Variant;
}

export default function ScreenBackground({ className = '', variant = 'default' }: ScreenBackgroundProps) {
    const { isRTL } = useLanguage();

    const paperStops: readonly [string, string, ...string[]] = variant === 'game'
        ? ['#FFF8EF', '#F7F1E6', '#EFE1D1']
        : ['#F7F1E6', '#FFF8EF', '#EFE1D1'];

    const stickerOpacity = variant === 'home' ? 0.85 : 0.55;

    return (
        <View pointerEvents="none" className={twMerge('absolute inset-0 overflow-hidden', className)}>
            <LinearGradient
                colors={paperStops}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
            />

            <View
                className={twMerge('absolute -bottom-10', isRTL ? '-right-12' : '-left-12')}
                style={{ opacity: 0.22 }}
            >
                <Svg width={260} height={260} viewBox="0 0 260 260">
                    <Circle cx={130} cy={130} r={92} stroke="#C97B4C" strokeWidth={10} fill="transparent" opacity={0.35} />
                    <Circle cx={130} cy={130} r={76} stroke="#C97B4C" strokeWidth={6} fill="transparent" opacity={0.22} />
                    <Circle cx={182} cy={78} r={8} fill="#C97B4C" opacity={0.20} />
                    <Circle cx={70} cy={188} r={6} fill="#C97B4C" opacity={0.16} />
                </Svg>
            </View>

            <View
                className="absolute -top-10 -left-14 w-56 h-56 rounded-full border-2 border-border/60"
                style={{ opacity: 0.35, transform: [{ rotate: isRTL ? '18deg' : '-18deg' }] }}
            />
            <View
                className="absolute top-24 right-6 w-40 h-40 rounded-full border-2 border-border/50"
                style={{ opacity: 0.25, transform: [{ rotate: isRTL ? '-12deg' : '12deg' }] }}
            />
            <View
                className="absolute -bottom-16 -right-10 w-64 h-64 rounded-full border-2 border-border/50"
                style={{ opacity: 0.25, transform: [{ rotate: isRTL ? '10deg' : '-10deg' }] }}
            />

            <View
                className="absolute top-16 left-6 w-20 h-20 rounded-2xl border border-accent/30 bg-accent/15 items-center justify-center"
                style={{ opacity: stickerOpacity, transform: [{ rotate: isRTL ? '-8deg' : '8deg' }] }}
            >
                <Text className="text-2xl">🎯</Text>
            </View>

            <View
                className="absolute bottom-24 left-8 w-20 h-20 rounded-2xl border border-secondary/30 bg-secondary/15 items-center justify-center"
                style={{ opacity: stickerOpacity, transform: [{ rotate: isRTL ? '10deg' : '-10deg' }] }}
            >
                <Text className="text-2xl">🎲</Text>
            </View>

            <View
                className="absolute top-44 right-10 w-20 h-20 rounded-2xl border border-primary/25 bg-primary/10 items-center justify-center"
                style={{ opacity: stickerOpacity, transform: [{ rotate: isRTL ? '6deg' : '-6deg' }] }}
            >
                <Text className="text-2xl">✨</Text>
            </View>

            <View
                className="absolute bottom-10 right-10 w-24 h-24 rounded-2xl border border-muted-foreground/25 bg-muted/60 items-center justify-center"
                style={{ opacity: variant === 'home' ? 0.75 : 0.45, transform: [{ rotate: isRTL ? '-6deg' : '6deg' }] }}
            >
                <Text className="text-2xl">🏆</Text>
            </View>
        </View>
    );
}
