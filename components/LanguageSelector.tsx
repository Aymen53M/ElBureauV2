import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLanguage, Language } from '@/contexts/LanguageContext';

interface LanguageSelectorProps {
    compact?: boolean;
}

const languages: { code: Language; flag: string; label: string }[] = [
    { code: 'en', flag: '🇺🇸', label: 'EN' },
    { code: 'fr', flag: '🇫🇷', label: 'FR' },
    { code: 'ar', flag: '🇸🇦', label: 'AR' },
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false }) => {
    const { language, setLanguage } = useLanguage();

    if (compact) {
        return (
            <View className="flex-row items-center gap-2">
                {languages.map((lang) => (
                    <TouchableOpacity
                        key={lang.code}
                        onPress={() => setLanguage(lang.code)}
                        className={`px-3 py-2 rounded-lg border-2 ${language === lang.code
                            ? 'bg-primary/10 border-primary'
                            : 'bg-white border-foreground/10'
                            }`}
                    >
                        <Text className="text-base">{lang.flag}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    }

    return (
        <View className="flex-row items-center justify-center gap-3">
            {languages.map((lang) => (
                <TouchableOpacity
                    key={lang.code}
                    onPress={() => setLanguage(lang.code)}
                    className={`flex-row items-center gap-2 px-4 py-3 rounded-lg ${language === lang.code
                        ? 'bg-primary/10 border-2 border-primary shadow-[2px_2px_0px_#C17F59]'
                        : 'bg-white border-2 border-foreground/10'
                        }`}
                >
                    <Text className="text-xl">{lang.flag}</Text>
                    <Text className={`font-display font-semibold ${language === lang.code ? 'text-primary' : 'text-foreground'
                        }`}>
                        {lang.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

export default LanguageSelector;
