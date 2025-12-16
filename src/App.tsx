import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const RootLayout = React.lazy(() => import('../app/_layout'));
const Index = React.lazy(() => import('../app/index'));
const CreateRoom = React.lazy(() => import('../app/create'));
const JoinRoom = React.lazy(() => import('../app/join'));
const Lobby = React.lazy(() => import('../app/lobby'));
const Game = React.lazy(() => import('../app/game'));
const Results = React.lazy(() => import('../app/results'));
const Settings = React.lazy(() => import('../app/settings'));
const HowToPlay = React.lazy(() => import('../app/how-to-play'));

export default function App() {
    return (
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <React.Suspense fallback={null}>
                <Routes>
                    <Route element={<RootLayout />}>
                        <Route path="/" element={<Index />} />
                        <Route path="/create" element={<CreateRoom />} />
                        <Route path="/join" element={<JoinRoom />} />
                        <Route path="/lobby" element={<Lobby />} />
                        <Route path="/game" element={<Game />} />
                        <Route path="/results" element={<Results />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/how-to-play" element={<HowToPlay />} />
                    </Route>
                </Routes>
            </React.Suspense>
        </BrowserRouter>
    );
}
