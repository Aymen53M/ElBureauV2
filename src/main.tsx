import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

(globalThis as any).global = globalThis;

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const w = window as any;
    if (!w.__elbureauAppHeightListener) {
        w.__elbureauAppHeightListener = true;
        let rafId: number | null = null;
        const setAppHeight = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const vv = window.visualViewport;
                const height = vv?.height || window.innerHeight;
                document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
            });
        };
        setAppHeight();
        window.addEventListener('resize', setAppHeight);
        window.addEventListener('orientationchange', setAppHeight);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', setAppHeight);
            window.visualViewport.addEventListener('scroll', setAppHeight);
        }
    }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
