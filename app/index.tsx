import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import Button from '@/components/ui/Button';
import ScreenBackground from '@/components/ui/ScreenBackground';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';

const floatingLogo = require('../assets/Flowting Logo.png');

export default function Index() {
    const { t, isRTL } = useLanguage();
    const { width, height } = useWindowDimensions();
    const isCompact = height < 760;

    const [logoError, setLogoError] = useState(false);

    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let mounted = true;
        Asset.fromModule(floatingLogo)
            .downloadAsync()
            .then(() => {
                if (mounted) setLogoError(false);
            })
            .catch(() => {
                if (mounted) setLogoError(true);
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: 1,
                    duration: 1600,
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1600,
                    useNativeDriver: true,
                }),
            ])
        );

        animation.start();
        return () => animation.stop();
    }, [floatAnim]);

    const translateY = floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -10],
    });

    const rotate = floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', isRTL ? '-1.2deg' : '1.2deg'],
    });

    const logoWidth = Math.max(260, Math.min(520, Math.round(width * 0.92)));
    const logoHeight = Math.round(logoWidth * 0.62);

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="home" />

            <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center justify-between px-6 ${isCompact ? 'pt-6 pb-4' : 'pt-12 pb-8'} max-w-5xl w-full self-center`}>
                <LanguageSelector compact />
                <Link href="/settings" asChild>
                    <TouchableOpacity className="p-2">
                        <Ionicons name="settings-outline" size={24} color="#2B1F17" />
                    </TouchableOpacity>
                </Link>
            </View>

            <View className={`flex-1 items-center justify-center px-6 max-w-5xl w-full self-center ${isCompact ? 'space-y-8' : 'space-y-14'}`}>
                <View className={`items-center w-full ${isCompact ? 'space-y-8' : 'space-y-12'}`}>
                    <View className={isCompact ? 'mb-2' : 'mb-6'}>
                        <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
                            {!logoError ? (
                                <Animated.Image
                                    source={floatingLogo}
                                    resizeMode="contain"
                                    style={{ width: logoWidth, height: logoHeight }}
                                    onError={() => setLogoError(true)}
                                />
                            ) : (
                                <View style={{ width: logoWidth, height: logoHeight }} />
                            )}
                        </Animated.View>
                    </View>
                    <Text className={`${isCompact ? 'text-base' : 'text-xl'} text-muted-foreground font-display text-center`}>
                        {t('tagline')}
                    </Text>
                    <View className={`w-full ${isCompact ? 'space-y-3 pt-2' : 'space-y-6 pt-8'}`}>
                        <Link href="/create" asChild>
                            <Button variant="hero" className={`w-full rounded-full ${isCompact ? 'py-4' : 'py-5'}`}>
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="add-circle-outline" size={isCompact ? 20 : 24} color="#FFF8EF" />
                                    <Text className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-bold text-primary-foreground`}>
                                        {t('createRoom')}
                                    </Text>
                                </View>
                            </Button>
                        </Link>

                        <Link href="/join" asChild>
                            <Button variant="secondary" size="lg" className="w-full">
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="people-outline" size={isCompact ? 18 : 20} color="#FFF8EF" />
                                    <Text className="font-display font-semibold text-secondary-foreground">
                                        {t('joinRoom')}
                                    </Text>
                                </View>
                            </Button>
                        </Link>

                        <Link href="/how-to-play" asChild>
                            <Button variant="outline" size="lg" className="w-full">
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="help-circle-outline" size={isCompact ? 18 : 20} color="#6B3F23" />
                                    <Text className="font-display font-semibold text-primary">
                                        {t('howToPlay')}
                                    </Text>
                                </View>
                            </Button>
                        </Link>
                    </View>
                </View>
            </View>

            <View className={isCompact ? 'p-3 items-center' : 'p-4 items-center'}>
                <Text className="text-muted-foreground text-sm text-center">
                    {t('poweredBy')}
                </Text>
            </View>
        </SafeAreaView>
    );
}
