import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';

interface ThemeSelectorProps {
    selectedTheme: string;
    customTheme: string;
    onSelectTheme: (theme: string) => void;
    onCustomThemeChange: (text: string) => void;
    density?: 'default' | 'compact';
}

const themes = [
    { id: 'movies', icon: '🎬' },
    { id: 'sports', icon: '⚽' },
    { id: 'science', icon: '🔬' },
    { id: 'popCulture', icon: '🎤' },
    { id: 'geography', icon: '🌍' },
    { id: 'history', icon: '📜' },
    { id: 'music', icon: '🎵' },
    { id: 'gaming', icon: '🎮' },
    { id: 'custom', icon: '✏️' },
];

const ThemeSelector: React.FC<ThemeSelectorProps> = ({
    selectedTheme,
    customTheme,
    onSelectTheme,
    onCustomThemeChange,
    density = 'default',
}) => {
    const { t } = useLanguage();

    const isCompact = density === 'compact';
    const tileClass = isCompact ? 'w-16 h-16 rounded-2xl' : 'w-20 h-20 rounded-2xl';
    const iconClass = isCompact ? 'text-2xl mb-0.5' : 'text-3xl mb-1';
    const gridClass = isCompact ? 'gap-2' : 'gap-3';

    return (
        <View className="space-y-4">
            <Text className="text-lg font-display font-semibold text-foreground mb-2">
                {t('theme')}
            </Text>

            {/* Theme grid */}
            <View className={`flex-row flex-wrap justify-center ${gridClass}`}>
                {themes.map((theme) => (
                    <TouchableOpacity
                        key={theme.id}
                        onPress={() => onSelectTheme(theme.id)}
                        className={`${tileClass} items-center justify-center ${selectedTheme === theme.id
                                ? 'bg-primary/20 border-2 border-primary'
                                : 'bg-muted border-2 border-transparent'
                            }`}
                    >
                        <Text className={iconClass}>{theme.icon}</Text>
                        <Text className={`text-xs font-display ${selectedTheme === theme.id ? 'text-primary' : 'text-muted-foreground'
                            }`}>
                            {t(theme.id)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Custom theme input */}
            {selectedTheme === 'custom' && (
                <TextInput
                    value={customTheme}
                    onChangeText={onCustomThemeChange}
                    placeholder={t('customTheme')}
                    placeholderTextColor="#7B6657"
                    className="h-12 px-4 rounded-xl border border-primary bg-input text-foreground font-sans"
                />
            )}
        </View>
    );
};

export default ThemeSelector;
