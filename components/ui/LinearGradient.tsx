import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

type Point = { x: number; y: number };

type LinearGradientProps = ViewProps & {
    colors: readonly string[];
    start?: Point;
    end?: Point;
    children?: React.ReactNode;
};

function toDeg(start?: Point, end?: Point) {
    const sx = start?.x ?? 0;
    const sy = start?.y ?? 0;
    const ex = end?.x ?? 1;
    const ey = end?.y ?? 1;
    const dx = ex - sx;
    const dy = ey - sy;
    const rad = Math.atan2(dy, dx);
    return (rad * 180) / Math.PI;
}

export function LinearGradient({ colors, start, end, style, children, ...rest }: LinearGradientProps) {
    const deg = toDeg(start, end);
    const backgroundImage = `linear-gradient(${deg}deg, ${colors.join(', ')})`;
    const flatStyle = StyleSheet.flatten(style as any);

    return (
        <View
            {...rest}
            style={[
                flatStyle,
                {
                    backgroundColor: colors[0],
                    backgroundImage,
                } as any,
            ]}
        >
            {children}
        </View>
    );
}
