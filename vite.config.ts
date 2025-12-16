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
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;
                    if (id.includes('@supabase')) return 'supabase';
                    if (id.includes('@tanstack')) return 'tanstack';
                    if (id.includes('react-router')) return 'router';
                    if (id.includes('react-native') || id.includes('react-native-web') || id.includes('nativewind')) return 'rn-web';
                    if (id.includes('react-dom') || id.includes('react')) return 'react';
                    return 'vendor';
                },
            },
        },
    },
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
