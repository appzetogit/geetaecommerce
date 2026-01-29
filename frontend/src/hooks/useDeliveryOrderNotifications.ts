import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { OrderNotificationData } from '../services/api/delivery/deliveryOrderNotificationService';
import { acceptOrder, rejectOrder } from '../services/api/delivery/deliveryOrderNotificationService';
import { getSocketBaseURL } from '../services/api/config';
import { getCurrentModuleToken } from '../utils/moduleAuth';

interface NotificationState {
    currentNotification: OrderNotificationData | null;
    notificationQueue: OrderNotificationData[];
    isConnected: boolean;
    error: string | null;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 2000;

export const useDeliveryOrderNotifications = () => {
    const { isAuthenticated, user } = useAuth();
    const [state, setState] = useState<NotificationState>({
        currentNotification: null,
        notificationQueue: [],
        isConnected: false,
        error: null,
    });

    const socketRef = useRef<Socket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);

    const connectSocket = useCallback(() => {
        if (!isAuthenticated || user?.userType !== 'Delivery' || !user?.id) {
            return;
        }

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        const token = getCurrentModuleToken();
        const socket = io(getSocketBaseURL(), {
            auth: {
                token,
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: INITIAL_RECONNECT_DELAY,
            reconnectionDelayMax: 10000,
            timeout: 20000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('🔌 Delivery notification socket connected');
            reconnectAttemptsRef.current = 0;
            setState(prev => ({
                ...prev,
                isConnected: true,
                error: null,
            }));

            // Join delivery notification room
            socket.emit('join-delivery-notifications', user.id);
        });

        socket.on('joined-notifications-room', (data: any) => {
            console.log('✅ Successfully joined notifications room:', data);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
            setState(prev => ({
                ...prev,
                isConnected: false,
                error: `Connection failed: ${error.message}`,
            }));
        });

        socket.on('disconnect', (reason) => {
            console.warn('⚠️ Socket disconnected:', reason);
            setState(prev => ({
                ...prev,
                isConnected: false,
            }));
        });

        socket.on('new-order', (orderData: OrderNotificationData) => {
            console.log('📦 New order notification received:', orderData);

            setState(prev => {
                // If there's already a current notification, queue this one
                if (prev.currentNotification) {
                    return {
                        ...prev,
                        notificationQueue: [...prev.notificationQueue, orderData],
                    };
                }
                // Otherwise, show it immediately
                return {
                    ...prev,
                    currentNotification: orderData,
                };
            });
        });

        socket.on('order-accepted', (data: { orderId: string; acceptedBy: string }) => {
            console.log('✅ Order accepted by another delivery boy:', data);

            setState(prev => {
                // If this is the current notification, clear it
                if (prev.currentNotification?.orderId === data.orderId) {
                    // Show next notification from queue if available
                    const nextNotification = prev.notificationQueue[0] || null;
                    return {
                        ...prev,
                        currentNotification: nextNotification,
                        notificationQueue: prev.notificationQueue.slice(1),
                    };
                }
                // Remove from queue if it's there
                return {
                    ...prev,
                    notificationQueue: prev.notificationQueue.filter(
                        notif => notif.orderId !== data.orderId
                    ),
                };
            });
        });

        socket.on('order-rejected-by-all', (data: { orderId: string }) => {
            console.log('❌ All delivery boys rejected order:', data);

            setState(prev => {
                // If this is the current notification, clear it
                if (prev.currentNotification?.orderId === data.orderId) {
                    // Show next notification from queue if available
                    const nextNotification = prev.notificationQueue[0] || null;
                    return {
                        ...prev,
                        currentNotification: nextNotification,
                        notificationQueue: prev.notificationQueue.slice(1),
                    };
                }
                // Remove from queue if it's there
                return {
                    ...prev,
                    notificationQueue: prev.notificationQueue.filter(
                        notif => notif.orderId !== data.orderId
                    ),
                };
            });
        });

        socket.on('disconnect', (reason: any) => {
            console.log('❌ Delivery notification socket disconnected:', reason);
            setState(prev => ({ ...prev, isConnected: false }));

            // Attempt reconnection
            if (reason === 'io server disconnect' || reason === 'io client disconnect') {
                return; // Don't auto-reconnect if intentionally disconnected
            }

            attemptReconnect();
        });

        socket.on('connect_error', (error: any) => {
            console.error('Socket connection error:', error);
            setState(prev => ({
                ...prev,
                isConnected: false,
                error: 'Failed to connect to notification server',
            }));

            attemptReconnect();
        });

        socket.on('error', (error: any) => {
            console.error('Socket error:', error);
            setState(prev => ({
                ...prev,
                error: 'Notification service error',
            }));
        });

        return socket;
    }, [isAuthenticated, user]);

    const attemptReconnect = useCallback(() => {
        reconnectAttemptsRef.current += 1;

        if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
            console.log('❌ Max reconnection attempts reached');
            setState(prev => ({
                ...prev,
                error: 'Unable to connect. Please refresh the page.',
            }));
            return;
        }

        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1);
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
            disconnectSocket();
            connectSocket();
        }, delay);
    }, [connectSocket]);

    const disconnectSocket = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }, []);

    const handleAccept = useCallback(async (orderId: string, navigate?: (path: string) => void) => {
        if (!socketRef.current || !user?.id) {
            return { success: false, message: 'Not connected or user not found' };
        }

        try {
            const result = await acceptOrder(socketRef.current, orderId, user.id);

            if (result.success) {
                // Clear current notification and show next from queue
                setState(prev => {
                    const nextNotification = prev.notificationQueue[0] || null;
                    return {
                        ...prev,
                        currentNotification: nextNotification,
                        notificationQueue: prev.notificationQueue.slice(1),
                    };
                });

                // Navigate to order detail page
                if (navigate) {
                    navigate(`/delivery/orders/${orderId}`);
                }
            } else if (result.message === 'Order notification not found') {
                // If notification is not found on server (stale), clear it from UI too
                console.warn('⚠️ clearing stale notification:', orderId);
                setState(prev => {
                    const nextNotification = prev.notificationQueue[0] || null;
                    return {
                        ...prev,
                        currentNotification: nextNotification,
                        notificationQueue: prev.notificationQueue.slice(1),
                    };
                });
            }

            return result;
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to accept order' };
        }
    }, [user]);

    const handleReject = useCallback(async (orderId: string) => {
        if (!socketRef.current || !user?.id) {
            return { success: false, message: 'Not connected or user not found', allRejected: false };
        }

        // Immediately clear the notification from UI
        setState(prev => {
            const nextNotification = prev.notificationQueue[0] || null;
            return {
                ...prev,
                currentNotification: nextNotification,
                notificationQueue: prev.notificationQueue.slice(1),
            };
        });

        try {
            // Perform the actual rejection in the background
            const result = await rejectOrder(socketRef.current, orderId, user.id);
            return result;
        } catch (error: any) {
            console.error('Failed to reject order in background:', error);
            return { success: false, message: error.message || 'Failed to reject order', allRejected: false };
        }
    }, [user]);

    const clearCurrentNotification = useCallback(() => {
        setState(prev => {
            const nextNotification = prev.notificationQueue[0] || null;
            return {
                ...prev,
                currentNotification: nextNotification,
                notificationQueue: prev.notificationQueue.slice(1),
            };
        });
    }, []);

    useEffect(() => {
        if (!isAuthenticated || user?.userType !== 'Delivery' || !user?.id) {
            disconnectSocket();
            return;
        }

        const socket = connectSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            disconnectSocket();
        };
    }, [isAuthenticated, user, connectSocket, disconnectSocket]);

    return {
        currentNotification: state.currentNotification,
        notificationQueue: state.notificationQueue,
        isConnected: state.isConnected,
        error: state.error,
        acceptOrder: handleAccept,
        rejectOrder: handleReject,
        clearNotification: clearCurrentNotification,
        socket: socketRef.current,
    };
};

