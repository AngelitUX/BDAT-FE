import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, Clock } from 'lucide-react';

const NotificationSystem = ({ socket }) => {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        if (!socket) return;

        // Listen for queue updates
        socket.on('simulation_queue_update', (data) => {
            const message = getQueueUpdateMessage(data);
            if (message) {
                addNotification({
                    type: 'info',
                    title: 'Queue Update',
                    message: message,
                    duration: 5000
                });
            }
        });

        // Listen for status updates
        socket.on('simulation_status_update', (data) => {
            const message = getStatusUpdateMessage(data);
            if (message) {
                addNotification({
                    type: getStatusNotificationType(data.state),
                    title: 'Simulation Status',
                    message: message,
                    duration: 6000
                });
            }
        });

        // Listen for progress updates
        socket.on('simulation_progress_update', (data) => {
            // Only show progress notifications for major milestones
            if (data.progress && (data.progress === 0.25 || data.progress === 0.5 || data.progress === 0.75)) {
                addNotification({
                    type: 'info',
                    title: 'Progress Update',
                    message: `Simulation ${data.simulation_id}: ${Math.round(data.progress * 100)}% complete`,
                    duration: 3000
                });
            }
        });

        return () => {
            socket.off('simulation_queue_update');
            socket.off('simulation_status_update');
            socket.off('simulation_progress_update');
        };
    }, [socket]);

    const getQueueUpdateMessage = (data) => {
        switch (data.action) {
            case 'added':
                return `Simulation ${data.simulation_id} added to queue (Position: ${data.position})`;
            case 'removed':
                return `Simulation ${data.simulation_id} removed from queue`;
            case 'priority_changed':
                return `Simulation ${data.simulation_id} priority changed to ${data.new_priority}`;
            case 'started':
                return `Simulation ${data.simulation_id} started from queue`;
            default:
                return null;
        }
    };

    const getStatusUpdateMessage = (data) => {
        switch (data.state) {
            case 'Queued':
                return `Simulation ${data.simulation_id} is now queued for execution`;
            case 'Running':
                return `Simulation ${data.simulation_id} has started running`;
            case 'Paused':
                return `Simulation ${data.simulation_id} has been paused`;
            case 'Resumed':
                return `Simulation ${data.simulation_id} has been resumed`;
            case 'Finished':
                return `Simulation ${data.simulation_id} completed successfully`;
            case 'Aborted':
                return `Simulation ${data.simulation_id} was aborted`;
            case 'Error':
                return `Simulation ${data.simulation_id} encountered an error`;
            default:
                return null;
        }
    };

    const getStatusNotificationType = (status) => {
        switch (status) {
            case 'Finished':
                return 'success';
            case 'Error':
            case 'Aborted':
                return 'error';
            case 'Running':
            case 'Resumed':
                return 'info';
            case 'Paused':
                return 'warning';
            default:
                return 'info';
        }
    };

    const addNotification = (notification) => {
        const id = Date.now() + Math.random();
        const newNotification = {
            id,
            ...notification,
            timestamp: new Date()
        };

        setNotifications(prev => [newNotification, ...prev.slice(0, 4)]); // Keep max 5 notifications

        // Auto-remove after duration
        if (notification.duration) {
            setTimeout(() => {
                removeNotification(id);
            }, notification.duration);
        }
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            case 'warning':
                return <Clock className="w-5 h-5 text-yellow-500" />;
            case 'info':
            default:
                return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    const getBackgroundColor = (type) => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200';
            case 'error':
                return 'bg-red-50 border-red-200';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200';
            case 'info':
            default:
                return 'bg-blue-50 border-blue-200';
        }
    };

    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`p-4 rounded-lg border shadow-lg transition-all duration-300 transform hover:scale-105 ${getBackgroundColor(notification.type)}`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                            {getIcon(notification.type)}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-gray-900">
                                    {notification.title}
                                </h4>
                                <p className="text-sm text-gray-700 mt-1">
                                    {notification.message}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {notification.timestamp.toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => removeNotification(notification.id)}
                            className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default NotificationSystem;
