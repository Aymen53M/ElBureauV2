import React from 'react';
import { TextInput, View, TextInputProps, StyleSheet } from 'react-native';
import { twMerge } from 'tailwind-merge';

interface InputProps extends TextInputProps {
    className?: string;
    containerClassName?: string;
}

const Input: React.FC<InputProps> = ({
    className = '',
    containerClassName = '',
    ...props
}) => {
    return (
        <View className={twMerge("w-full", containerClassName)}>
            <TextInput
                className={twMerge(
                    "h-12 w-full rounded-lg border-2 border-foreground bg-white px-4 text-base text-foreground",
                    className
                )}
                placeholderTextColor="#8C7B70"
                style={styles.input}
                {...props}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    input: {
        fontFamily: 'Patrick Hand',
        boxShadow: '2px 2px 0px 0px #2B1F17', // Web only
    },
});

export default Input;
