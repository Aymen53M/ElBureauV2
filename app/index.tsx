import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from '@/components/ui/SafeArea';
import { Link } from '@/lib/router';
import { Ionicons } from '@/components/ui/Ionicons';
import Button from '@/components/ui/Button';
import ScreenBackground from '@/components/ui/ScreenBackground';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';

import floatingLogo from '../assets/Flowting Logo.png';

export default function Index() {
    const { t, isRTL } = useLanguage();
    const { width, height } = useWindowDimensions();
    const compactHeight = Platform.OS === 'web' ? 900 : 760;
    const isCompact = height < compactHeight;

    const [logoError, setLogoError] = useState(false);

    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: 1,
                    duration: 1600,
                    useNativeDriver: Platform.OS !== 'web',
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1600,
                    useNativeDriver: Platform.OS !== 'web',
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

    const logoAspect = 0.62;
    let logoWidth = Math.max(320, Math.min(900, Math.round(width * (isCompact ? 0.98 : 0.86))));
    let logoHeight = Math.round(logoWidth * logoAspect);
    const maxLogoHeight = Math.max(240, Math.round(height * (isCompact ? 0.42 : 0.46)));
    if (logoHeight > maxLogoHeight) {
        logoHeight = maxLogoHeight;
        logoWidth = Math.round(logoHeight / logoAspect);
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScreenBackground variant="home" />

            <View className={`${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center justify-between px-6 ${isCompact ? 'pt-6 pb-4' : 'pt-12 pb-8'} w-full z-10`}>
                <LanguageSelector compact />
                <Link href="/settings" asChild>
                    <TouchableOpacity className="p-2 w-12 h-12 rounded-lg bg-white items-center justify-center border-2 border-foreground shadow-[2px_2px_0px_#2B1F17]">
                        <Ionicons name="settings-outline" size={24} color="#2B1F17" />
                    </TouchableOpacity>
                </Link>
            </View>

            <View className={`flex-1 items-center justify-center px-6 w-full ${isCompact ? 'space-y-8' : 'space-y-10'}`}>
                <View className={`items-center w-full ${isCompact ? 'space-y-8' : 'space-y-12'}`}>
                    <View className={isCompact ? 'mb-2' : 'mb-6'}>
                        <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
                            {!logoError ? (
                                <Animated.Image
                                    source={{ uri: floatingLogo }}
                                    resizeMode="contain"
                                    style={{ width: logoWidth, height: logoHeight }}
                                    onError={() => setLogoError(true)}
                                />
                            ) : (
                                <View style={{ width: logoWidth, height: logoHeight }} />
                            )}
                        </Animated.View>
                    </View>

                    {/* Glass Panel for Tagline */}
                    <View className="px-6 py-3 rounded-lg bg-white border-2 border-foreground shadow-sm transform rotate-1">
                        <Text className={`${isCompact ? 'text-base' : 'text-xl'} text-foreground font-display text-center font-medium`}>
                            {t('tagline')}
                        </Text>
                    </View>

                    <View className={`w-full ${isCompact ? 'space-y-3 pt-2' : 'space-y-6 pt-8'}`}>
                        <Link href="/create" asChild>
                            <Button variant="hero" className={`w-full ${isCompact ? 'py-4' : 'py-5'} transform -rotate-1`}>
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="add-circle-outline" size={isCompact ? 22 : 26} color="#FFFFFF" />
                                    <Text className={`${isCompact ? 'text-lg' : 'text-xl'} font-display font-bold text-white`}>
                                        {t('createRoom')}
                                    </Text>
                                </View>
                            </Button>
                        </Link>

                        <Link href="/join" asChild>
                            <Button variant="secondary" size="lg" className="w-full bg-secondary text-secondary-foreground border-2 border-foreground transform rotate-1">
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="people-outline" size={isCompact ? 20 : 22} color="#2B1F17" />
                                    <Text className="font-display font-bold text-lg text-foreground">
                                        {t('joinRoom')}
                                    </Text>
                                </View>
                            </Button>
                        </Link>

                        <Link href="/how-to-play" asChild>
                            <Button variant="outline" size="lg" className="w-full border-2 border-foreground bg-white transform -rotate-1">
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="help-circle-outline" size={isCompact ? 20 : 22} color="#C17F59" />
                                    <Text className="font-display font-bold text-lg text-foreground">
                                        {t('howToPlay')}
                                    </Text>
                                </View>
                            </Button>
                        </Link>
                    </View>
                </View>
            </View>

            <View className={isCompact ? 'p-3 items-center' : 'p-4 items-center'}>
                <Text className="text-muted-foreground/70 text-sm text-center font-medium">
                    {t('poweredBy')}
                </Text>
            </View>
        </SafeAreaView>
    );
}
