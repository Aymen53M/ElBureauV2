import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import RootLayout from '../app/_layout';
import Index from '../app/index';
import CreateRoom from '../app/create';
import JoinRoom from '../app/join';
import Lobby from '../app/lobby';
import Game from '../app/game';
import Results from '../app/results';
import Settings from '../app/settings';
import HowToPlay from '../app/how-to-play';

export default function App() {
    return (
        <BrowserRouter>
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
        </BrowserRouter>
    );
}
