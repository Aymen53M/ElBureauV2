import path from 'node:path';
import fs from 'node:fs/promises';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        react({
            jsxImportSource: 'nativewind',
            babel: {
                presets: ['nativewind/babel'],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
            'react-native': 'react-native-web',
            'react-native-safe-area-context': path.resolve(__dirname, 'components/ui/SafeArea.tsx'),
        },
    },
    optimizeDeps: {
        exclude: ['react-native', 'react-native-safe-area-context'],
        esbuildOptions: {
            plugins: [
                {
                    name: 'rn-css-interop-doctor-jsx',
                    setup(build) {
                        build.onLoad(
                            { filter: /[\\/]react-native-css-interop[\\/]dist[\\/]doctor\.js$/ },
                            async (args) => {
                                const contents = await fs.readFile(args.path, 'utf8');
                                return { contents, loader: 'jsx' };
                            }
                        );
                    },
                },
            ],
        },
    },
    define: {
        global: 'globalThis',
        'process.env': '{}',
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
});
