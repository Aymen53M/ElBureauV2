import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { GameProvider } from '@/contexts/GameContext';
import '../global.css';

const queryClient = new QueryClient();

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <LanguageProvider>
                    <GameProvider>
                        <StatusBar style="light" />
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                contentStyle: { backgroundColor: '#0D1321' },
                                animation: 'slide_from_right',
                            }}
                        />
                    </GameProvider>
                </LanguageProvider>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}
