import React from 'react';
import { View } from 'react-native';

export type Insets = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

export function SafeAreaProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

export function useSafeAreaInsets(): Insets {
    return { top: 0, right: 0, bottom: 0, left: 0 };
}

type SafeAreaViewProps = React.ComponentProps<typeof View>;

export function SafeAreaView({ style, ...props }: SafeAreaViewProps) {
    const safeStyle = [
        {
            paddingTop: 'env(safe-area-inset-top)',
            paddingRight: 'env(safe-area-inset-right)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
        } as any,
        style,
    ];

    return <View {...props} style={safeStyle} />;
}
