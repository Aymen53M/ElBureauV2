/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,jsx,ts,tsx}",
        "./components/**/*.{js,jsx,ts,tsx}",
        "./contexts/**/*.{js,jsx,ts,tsx}",
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            fontFamily: {
                display: ['Fredoka'],
                sans: ['Rubik'],
            },
            colors: {
                background: '#F7F1E6',
                foreground: '#2B1F17',
                card: {
                    DEFAULT: '#FFF8EF',
                    foreground: '#2B1F17',
                },
                primary: {
                    DEFAULT: '#6B3F23',
                    foreground: '#FFF8EF',
                },
                secondary: {
                    DEFAULT: '#C83A32',
                    foreground: '#FFF8EF',
                },
                accent: {
                    DEFAULT: '#D4A72C',
                    foreground: '#2B1F17',
                },
                destructive: {
                    DEFAULT: '#B3261E',
                    foreground: '#FFF8EF',
                },
                muted: {
                    DEFAULT: '#EFE1D1',
                    foreground: '#7B6657',
                },
                border: '#E2CFBC',
                input: '#FFF4E6',
                ring: '#C97B4C',
                neon: {
                    cyan: '#2D9C93',
                    pink: '#D1497B',
                    yellow: '#D4A72C',
                    green: '#3C8C6E',
                    orange: '#D9822B',
                },
            },
            borderRadius: {
                lg: 16,
                md: 12,
                sm: 8,
                xl: 20,
                '2xl': 24,
            },
        },
    },
    plugins: [],
};
