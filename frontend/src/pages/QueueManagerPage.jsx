import React from 'react';
import QueueManager from '../features/simulations/QueueManager';

const QueueManagerPage = () => {
    return (
        <div className="min-h-screen bg-gray-100">
            <div className="container mx-auto py-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Simulation Queue Manager</h1>
                    <p className="text-gray-600">Manage simulation queue, priorities, and execution control</p>
                </div>
                <QueueManager />
            </div>
        </div>
    );
};

export default QueueManagerPage;
