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
                background: '#0D1321',
                foreground: '#F5FFFF',
                card: {
                    DEFAULT: '#151E2E',
                    foreground: '#F5FFFF',
                },
                primary: {
                    DEFAULT: '#00D4AA',
                    foreground: '#0D1321',
                },
                secondary: {
                    DEFAULT: '#F06543',
                    foreground: '#0D1321',
                },
                accent: {
                    DEFAULT: '#FFCC00',
                    foreground: '#0D1321',
                },
                destructive: {
                    DEFAULT: '#EB3B3B',
                    foreground: '#FFFFFF',
                },
                muted: {
                    DEFAULT: '#212D3D',
                    foreground: '#8FA3B8',
                },
                border: '#2A3A4D',
                input: '#1A2432',
                ring: '#00D4AA',
                neon: {
                    cyan: '#00FFFF',
                    pink: '#FF66AA',
                    yellow: '#FFD93D',
                    green: '#00FF88',
                    orange: '#FF8C42',
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
