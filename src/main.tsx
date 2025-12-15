import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

(globalThis as any).global = globalThis;

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const w = window as any;
    if (!w.__elbureauAppHeightListener) {
        w.__elbureauAppHeightListener = true;
        const setAppHeight = () => {
            document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
        };
        setAppHeight();
        window.addEventListener('resize', setAppHeight);
    }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
