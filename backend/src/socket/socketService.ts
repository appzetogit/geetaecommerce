import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { handleOrderAcceptance, handleOrderRejection } from '../services/orderNotificationService';
import Order from '../models/Order';
import DeliveryTracking from '../models/DeliveryTracking';

// In-memory cache for order destinations (lat, lng) to avoid DB reads on every update
// Key: orderId, Value: { latitude, longitude }
const orderDestinationsCache = new Map<string, { latitude: number; longitude: number }>();

// Throttler for DB updates
// Key: orderId, Value: last timestamp
const locationUpdateThrottler = new Map<string, number>();

// Haversine formula to calculate distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

// Calculate ETA (assuming 30 km/h)
const calculateETA = (distanceInMeters: number): number => {
    const averageSpeedKmh = 30;
    const averageSpeedMs = (averageSpeedKmh * 1000) / 60; // meters per minute
    return Math.ceil(distanceInMeters / averageSpeedMs);
};

export const initializeSocket = (httpServer: HttpServer) => {
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or server-to-server)
                if (!origin) return callback(null, true);

                // In production, check against allowed origins
                if (process.env.NODE_ENV === 'production') {
                    // Get allowed origins from environment variable (comma-separated)
                    const frontendUrl = process.env.FRONTEND_URL || "";
                    const allowedOrigins = frontendUrl
                        .split(",")
                        .map((url) => url.trim())
                        .filter((url) => url.length > 0);

                    // Default production origins if FRONTEND_URL not set
                    const defaultOrigins = [
                        "https://www.Geeta Stores.com",
                        "https://Geeta Stores.com",
                    ];

                    const allAllowedOrigins = allowedOrigins.length > 0
                        ? [...allowedOrigins, ...defaultOrigins]
                        : defaultOrigins;

                    // Normalize origins for comparison (remove trailing slash, lowercase)
                    const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
                    const normalizedOrigin = normalizeUrl(origin);

                    // Check if origin matches any allowed origin
                    const isAllowed = allAllowedOrigins.some((allowedOrigin) => {
                        const normalizedAllowed = normalizeUrl(allowedOrigin);

                        // Exact match
                        if (normalizedOrigin === normalizedAllowed) return true;

                        // Support for www and non-www variants
                        if (normalizedAllowed.includes("www.")) {
                            const nonWww = normalizedAllowed.replace("www.", "");
                            if (normalizedOrigin === nonWww) return true;
                        } else {
                            const withWww = normalizedAllowed.replace(/^(https?:\/\/)/, "$1www.");
                            if (normalizedOrigin === withWww) return true;
                        }
                        return false;
                    });

                    if (!isAllowed) {
                        console.warn(`⚠️ Socket.io connection rejected from origin: ${origin}. Allowed origins: ${allAllowedOrigins.join(', ')}`);
                        console.warn(`⚠️ Normalized origin: ${normalizedOrigin}`);
                    } else {
                        console.log(`✅ Socket.io connection allowed from origin: ${origin}`);
                    }

                    return callback(null, isAllowed);
                }

                // In development, allow any localhost port
                if (
                    origin.startsWith('http://localhost:') ||
                    origin.startsWith('http://127.0.0.1:') ||
                    origin.startsWith('https://localhost:')
                ) {
                    return callback(null, true);
                }

                return callback(null, false);
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        // Production-specific Socket.io configuration
        allowEIO3: true,
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'], // Keep polling for fallback
        upgradeTimeout: 30000,
        // Add robust connection handling
        connectTimeout: 45000,
        maxHttpBufferSize: 1e8,
    });

    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            // Allow connection but mark as unauthenticated
            return next();
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
            (socket as any).user = decoded;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log('✅ Socket connected:', socket.id, 'User:', (socket as any).user?.userId || 'Unauthenticated');

        // Customer subscribes to order tracking
        socket.on('track-order', async (orderId: string) => {
            const user = (socket as any).user;

            if (!user) {
                console.warn(`⚠️ Unauthenticated socket tried to track order: ${orderId}`);
                socket.emit('tracking-error', { message: 'Authentication required' });
                return;
            }

            try {
                // Verify order belongs to this customer
                const order = await Order.findOne({ _id: orderId, customer: user.userId });

                if (!order) {
                    console.warn(`⚠️ User ${user.userId} tried to track unauthorized order: ${orderId}`);
                    socket.emit('tracking-error', { message: 'Unauthorized or order not found' });
                    return;
                }

                console.log(`📦 Customer ${user.userId} tracking order: ${orderId}`);
                socket.join(`order-${orderId}`);

                // Send acknowledgment
                socket.emit('tracking-started', {
                    orderId,
                    message: 'Live tracking started',
                });
            } catch (error) {
                console.error(`❌ Error in track-order for order ${orderId}:`, error);
                socket.emit('tracking-error', { message: 'Internal server error' });
            }
        });

        // Customer unsubscribes from order tracking
        socket.on('stop-tracking', (orderId: string) => {
            console.log(`🛑 Stopped tracking order: ${orderId}`);
            socket.leave(`order-${orderId}`);
        });

        // Delivery partner joins their active deliveries room
        socket.on('join-delivery-room', (deliveryPartnerId: string) => {
            console.log(`🛵 Delivery partner joined: ${deliveryPartnerId}`);
            socket.join(`delivery-${deliveryPartnerId}`);
        });

        // Seller joins their notification room
        socket.on('join-seller-room', (sellerId: string) => {
            const normalizedSellerId = String(sellerId).trim();
            console.log(`🏪 Seller ${normalizedSellerId} joined notifications room`);
            socket.join(`seller-${normalizedSellerId}`);

            socket.emit('joined-seller-room', {
                success: true,
                message: 'Successfully joined seller notifications room',
                sellerId: normalizedSellerId
            });
        });

        // Admin joins their notification room
        socket.on('join-admin-room', (adminId: string) => {
            const normalizedAdminId = String(adminId).trim();
            console.log(`🛡️ Admin ${normalizedAdminId} joined notifications room`);
            socket.join(`admin-${normalizedAdminId}`);
            socket.join('admin-notifications');

            socket.emit('joined-admin-room', {
                success: true,
                message: 'Successfully joined admin notifications room',
                adminId: normalizedAdminId
            });
        });

        // Delivery boy joins notification room
        socket.on('join-delivery-notifications', (deliveryBoyId: string) => {
            // Normalize deliveryBoyId to string to ensure consistent room naming
            const normalizedDeliveryBoyId = String(deliveryBoyId).trim();
            console.log(`🔔 Delivery boy ${normalizedDeliveryBoyId} joined notifications room`);

            socket.join('delivery-notifications');
            socket.join(`delivery-${normalizedDeliveryBoyId}`);

            console.log(`✅ Delivery boy ${normalizedDeliveryBoyId} joined rooms: delivery-notifications, delivery-${normalizedDeliveryBoyId}`);

            // Send confirmation that they joined successfully
            socket.emit('joined-notifications-room', {
                success: true,
                message: 'Successfully joined delivery notifications room',
                deliveryBoyId: normalizedDeliveryBoyId
            });
        });

        // Handle order acceptance
        socket.on('accept-order', async (data: { orderId: string; deliveryBoyId: string }) => {
            try {
                console.log(`✅ Delivery boy ${data.deliveryBoyId} accepting order ${data.orderId}`);
                const result = await handleOrderAcceptance(io, data.orderId, String(data.deliveryBoyId).trim());
                socket.emit('accept-order-response', result);
            } catch (error) {
                console.error('❌ Error in accept-order handler:', error);
                socket.emit('accept-order-response', { success: false, message: 'Internal server error' });
            }
        });

        // Handle order rejection
        socket.on('reject-order', async (data: { orderId: string; deliveryBoyId: string }) => {
            try {
                console.log(`❌ Delivery boy ${data.deliveryBoyId} rejecting order ${data.orderId}`);
                const result = await handleOrderRejection(io, data.orderId, String(data.deliveryBoyId).trim());
                socket.emit('reject-order-response', result);
            } catch (error) {
                console.error('❌ Error in reject-order handler:', error);
                socket.emit('reject-order-response', { success: false, message: 'Internal server error', allRejected: false });
            }
        });

        // Handle delivery location update (optimized)
        socket.on('update-location', async (data: { orderId: string; latitude: number; longitude: number }) => {
            const { orderId, latitude, longitude } = data;
            const deliveryBoyId = (socket as any).user?.userId;

            if (!deliveryBoyId || !orderId || !latitude || !longitude) return;

            try {
                // 1. Verify Delivery Boy is assigned to this order
                const order = await Order.findOne({ _id: orderId, deliveryBoy: deliveryBoyId }).select('deliveryAddress status');
                if (!order) {
                    console.warn(`⚠️ Unauthorized location update attempt from ${deliveryBoyId} for order ${orderId}`);
                    return;
                }

                // 2. Get Destination (from cache or DB)
                let destination = orderDestinationsCache.get(orderId);

                if (!destination && order.deliveryAddress) {
                    destination = {
                        latitude: order.deliveryAddress.latitude || 0,
                        longitude: order.deliveryAddress.longitude || 0
                    };
                    orderDestinationsCache.set(orderId, destination);

                    // Clear cache after 2 hours (cleanup)
                    setTimeout(() => orderDestinationsCache.delete(orderId), 2 * 60 * 60 * 1000);
                }

                // 3. Calculate Distance & ETA
                let distance = 0;
                let eta = 0;
                if (destination) {
                    distance = calculateDistance(latitude, longitude, destination.latitude, destination.longitude);
                    eta = calculateETA(distance);
                }

                // 4. Determine Status (Simplified)
                let status = 'in_transit';
                if (distance < 100) status = 'nearby';
                // Note: We don't change to 'picked_up'/'delivered' here as those are state transitions, not just location updates

                // 5. Broadcast Immediately (Fast Path)
                const locationUpdatePayload = {
                    orderId,
                    location: { latitude, longitude, timestamp: new Date() },
                    eta,
                    distance,
                    status
                };

                io.to(`order-${orderId}`).emit('location-update', locationUpdatePayload);

                // 6. Throttled DB Update (Slow Path)
                const lastUpdate = locationUpdateThrottler.get(orderId) || 0;
                const now = Date.now();

                if (now - lastUpdate > 30000) { // 30 seconds throttle
                    locationUpdateThrottler.set(orderId, now);

                    try {
                        let tracking = await DeliveryTracking.findOne({ order: orderId });

                        if (!tracking) {
                            tracking = new DeliveryTracking({
                                order: orderId,
                                deliveryBoy: deliveryBoyId,
                                latitude,
                                longitude,
                                currentLocation: { latitude, longitude, timestamp: new Date() },
                                route: [{ lat: latitude, lng: longitude }],
                                status: status as any
                            });
                        } else {
                            tracking.currentLocation = { latitude, longitude, timestamp: new Date() };
                            tracking.latitude = latitude;
                            tracking.longitude = longitude;
                            tracking.route.push({ lat: latitude, lng: longitude });
                            if (tracking.route.length > 50) tracking.route = tracking.route.slice(-50);
                            tracking.distance = distance;
                            tracking.eta = eta;
                            // Only update status if it's a spatial status (nearby/in_transit), don't override Delivered/Picked Up
                            if (tracking.status !== 'delivered' && tracking.status !== 'picked_up' && tracking.status !== 'idle') {
                                 tracking.status = status as any;
                            }
                        }
                        await tracking.save();
                    } catch (dbError) {
                         console.error('Error syncing location to DB:', dbError);
                    }
                }
            } catch (err) {
                console.error('Error in socket location update:', err);
            }
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', socket.id, 'Reason:', reason);
        });

        // Error handling
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        // Handle connection errors
        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });
    });

    console.log('🔌 Socket.io initialized');
    return io;
};

// Helper function to clear order cache when status changes
export const clearOrderCache = (orderId: string) => {
    orderDestinationsCache.delete(orderId);
    locationUpdateThrottler.delete(orderId);
};

// Helper function to emit location updates
export const emitLocationUpdate = (
    io: SocketIOServer,
    orderId: string,
    data: {
        location: { latitude: number; longitude: number; timestamp: Date };
        eta: number;
        distance: number;
        status: string;
    }
) => {
    io.to(`order-${orderId}`).emit('location-update', {
        orderId,
        ...data,
        timestamp: new Date(),
    });
};
