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
                    if (id.includes('react-router-dom')) return 'router';
                    if (id.includes('@tanstack/react-query')) return 'query';
                    if (id.includes('@supabase/supabase-js')) return 'supabase';
                    if (id.includes('react-native-web') || id.includes('/react-native/')) return 'rnweb';
                    if (id.includes('react-dom')) return 'react-dom';
                    if (id.includes('react/')) return 'react';
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
