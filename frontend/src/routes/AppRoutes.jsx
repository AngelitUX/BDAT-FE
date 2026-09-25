import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Simulations from '../features/simulations/Simulations';

const AppRoutes = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Simulations />} />
                <Route path="/simulations" element={<Simulations />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
};

export default AppRoutes;
