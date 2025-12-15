import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
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

    const stickerOpacity = variant === 'home' ? 0.85 : 0.55;

    return (
        <View
            pointerEvents="none"
            className={twMerge('absolute inset-0 overflow-hidden bg-background', className)}
            style={StyleSheet.absoluteFillObject}
        >
            {/* Paper texture is already on body/html, so we just use transparent or bg-background if needed */}

            {/* Decorative drawn circles */}
            <View
                className="absolute -top-10 -left-14 w-56 h-56 rounded-full border-2 border-foreground/10"
                style={{ opacity: 0.35, transform: [{ rotate: isRTL ? '18deg' : '-18deg' }] }}
            />
            <View
                className="absolute top-24 right-6 w-40 h-40 rounded-full border-2 border-foreground/10"
                style={{ opacity: 0.25, transform: [{ rotate: isRTL ? '-12deg' : '12deg' }] }}
            />
            <View
                className="absolute -bottom-16 -right-10 w-64 h-64 rounded-full border-2 border-foreground/10"
                style={{ opacity: 0.25, transform: [{ rotate: isRTL ? '10deg' : '-10deg' }] }}
            />

            {/* Stickers / Doodles */}
            <View
                className="absolute top-16 left-6 w-20 h-20 bg-white border-2 border-foreground items-center justify-center transform rotate-6 shadow-sm"
                style={{
                    opacity: stickerOpacity,
                    transform: [{ rotate: isRTL ? '-8deg' : '8deg' }],
                    borderRadius: 15, // Simple rounded for stickers or use sketchy if preferred
                    // Let's use inline sketchy border radius for variety
                    borderTopLeftRadius: 255, borderTopRightRadius: 15, borderBottomRightRadius: 225, borderBottomLeftRadius: 15,
                }}
            >
                <Text className="text-2xl font-display">🎯</Text>
            </View>

            <View
                className="absolute bottom-24 left-8 w-20 h-20 bg-white border-2 border-foreground items-center justify-center shadow-sm"
                style={{
                    opacity: stickerOpacity,
                    transform: [{ rotate: isRTL ? '10deg' : '-10deg' }],
                    borderTopLeftRadius: 15, borderTopRightRadius: 225, borderBottomRightRadius: 15, borderBottomLeftRadius: 255,
                }}
            >
                <Text className="text-2xl font-display">🎲</Text>
            </View>

            <View
                className="absolute top-44 right-10 w-20 h-20 bg-white border-2 border-foreground items-center justify-center shadow-sm"
                style={{
                    opacity: stickerOpacity,
                    transform: [{ rotate: isRTL ? '6deg' : '-6deg' }],
                    borderTopLeftRadius: 255, borderTopRightRadius: 15, borderBottomRightRadius: 225, borderBottomLeftRadius: 15,
                }}
            >
                <Text className="text-2xl font-display">✨</Text>
            </View>

            <View
                className="absolute bottom-10 right-10 w-24 h-24 bg-white border-2 border-foreground items-center justify-center shadow-sm"
                style={{
                    opacity: variant === 'home' ? 0.75 : 0.45,
                    transform: [{ rotate: isRTL ? '-6deg' : '6deg' }],
                    borderTopLeftRadius: 15, borderTopRightRadius: 255, borderBottomRightRadius: 15, borderBottomLeftRadius: 225,
                }}
            >
                <Text className="text-2xl font-display">🏆</Text>
            </View>
        </View>
    );
}
