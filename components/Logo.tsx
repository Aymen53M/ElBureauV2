import React from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, Pressable, Alert, Platform } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { usePathname, useRouter } from '@/lib/router';
import { getShadowStyle } from '@/lib/styles';

import logoSource from '../assets/Flowting Logo.png';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    animated?: boolean;
    className?: string;
    goHomeOnPress?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 'lg', animated = true, className }) => {
    const router = useRouter();
    const pathname = usePathname();
    const animatedValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (animated) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(animatedValue, {
                        toValue: -10,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                    Animated.timing(animatedValue, {
                        toValue: 0,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                ])
            ).start();
        }
    }, [animated, animatedValue]);

    const sizePx = (() => {
        switch (size) {
            case 'sm':
                return { w: 220, h: 88 };
            case 'md':
                return { w: 320, h: 128 };
            case 'lg':
                return { w: 460, h: 184 };
            case 'xl':
                return { w: 560, h: 224 };
        }
    })();

    const enableHomeNav = (size === 'sm' && !animated);

    const handlePress = () => {
        if (!enableHomeNav) return;
        if (pathname === '/') return;
        Alert.alert('Go Home?', 'Do you want to leave this screen and go to Home?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go Home', onPress: () => router.replace('/') },
        ]);
    };

    return (
        <Pressable
            onPress={handlePress}
            className={twMerge('relative', className)}
            accessibilityRole={enableHomeNav ? 'button' : undefined}
        >
            {/* Glow effect behind */}
            <View className="absolute inset-0" style={styles.glow}>
                <Image
                    source={{ uri: logoSource }}
                    style={[{ width: sizePx.w, height: sizePx.h, opacity: 0.55 }, styles.glowImage] as any}
                    resizeMode="contain"
                />
            </View>

            {/* Main logo */}
            <Animated.View style={animated ? { transform: [{ translateY: animatedValue }] } : undefined}>
                <Image
                    source={{ uri: logoSource }}
                    style={{ width: sizePx.w, height: sizePx.h }}
                    resizeMode="contain"
                />

                {/* Sparkle decorations */}
                <Text style={styles.hiddenSparkle}> </Text>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    glow: {
        opacity: 0.4,
    },
    glowImage: {
        ...getShadowStyle('#C97B4C', { width: 0, height: 0 }, 0.45, 20),
    },
    hiddenSparkle: {
        position: 'absolute',
        opacity: 0,
        width: 0,
        height: 0,
    },
});

export default Logo;
