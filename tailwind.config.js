/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,jsx,ts,tsx}",
        "./app/**/*.{js,jsx,ts,tsx}",
        "./components/**/*.{js,jsx,ts,tsx}",
        "./contexts/**/*.{js,jsx,ts,tsx}",
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            fontFamily: {
                display: ['Patrick Hand', 'cursive'],
                sans: ['Patrick Hand', 'cursive'],
            },
            colors: {
                background: '#FDFBF7', // Paper White
                foreground: '#2B1F17', // Ink Black/Brown
                card: {
                    DEFAULT: '#FFFFFF',
                    foreground: '#2B1F17',
                },
                popover: {
                    DEFAULT: '#FFFFFF',
                    foreground: '#2B1F17',
                },
                primary: {
                    DEFAULT: '#2B1F17', // Ink
                    foreground: '#FFFFFF',
                },
                secondary: {
                    DEFAULT: '#E3C8A8', // Parchment
                    foreground: '#2B1F17',
                },
                accent: {
                    DEFAULT: '#FF6B6B', // Red Pen
                    foreground: '#FFFFFF',
                },
                muted: {
                    DEFAULT: '#F3EFE7',
                    foreground: '#8C7B70',
                },
                destructive: {
                    DEFAULT: '#D32F2F',
                    foreground: '#FFFFFF',
                },
                success: {
                    DEFAULT: '#4CAF50', // Green Marker
                    foreground: '#FFFFFF',
                },
                border: '#2B1F17', // Ink
                input: 'transparent',
                ring: '#2B1F17',
            },
            borderRadius: {
                lg: '255px 15px 225px 15px / 15px 225px 15px 255px',
                md: '255px 15px 225px 15px / 15px 225px 15px 255px',
                sm: '255px 15px 225px 15px / 15px 225px 15px 255px',
                xl: '255px 15px 225px 15px / 15px 225px 15px 255px',
                '2xl': '255px 15px 225px 15px / 15px 225px 15px 255px',
            },
        },
    },
    plugins: [],
};
