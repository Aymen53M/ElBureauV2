import { Platform, ViewStyle } from 'react-native';

export const getShadowStyle = (
    shadowColor: string,
    shadowOffset: { width: number; height: number } = { width: 4, height: 4 },
    shadowOpacity: number = 1,
    shadowRadius: number = 0
): ViewStyle => {
    if (Platform.OS === 'web') {
        return {
            // @ts-ignore
            boxShadow: `${shadowOffset.width}px ${shadowOffset.height}px ${shadowRadius}px ${shadowColor}`,
        };
    }

    return {
        shadowColor,
        shadowOffset,
        shadowOpacity,
        shadowRadius,
        elevation: 4,
    };
};
