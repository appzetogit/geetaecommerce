import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderDetails, updateOrderStatus, getSellerLocationsForOrder, sendDeliveryOtp, verifyDeliveryOtp, updateDeliveryLocation } from '../../../services/api/delivery/deliveryService';
import deliveryIcon from '@assets/deliveryboy/deliveryIcon.png';
import GoogleMapsTracking from '../../../components/GoogleMapsTracking';
import QRScannerModal from '../../../components/QRScannerModal';

// Helper to get delivery icon URL (works in both dev and production)
const getDeliveryIconUrl = () => {
    // Try imported path first (Vite will process this in production)
    if (deliveryIcon && typeof deliveryIcon === 'string') {
        return deliveryIcon;
    }
    // Fallback to public path
    return '/assets/deliveryboy/deliveryIcon.png';
};

// Icons components to avoid external dependency issues
const Icons = {
    ChevronLeft: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M15 18l-6-6 6-6" />
        </svg>
    ),
    MapPin: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    ),
    User: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    Phone: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    ),
    Clock: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    CheckCircle: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    ),
    Truck: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
    ),
    ShoppingBag: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    ),
    Navigation: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
    ),
    Store: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    ),
    AlertTriangle: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    )
};

type DeliveryOrderStatus = 'Pending' | 'Ready for pickup' | 'Picked up' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | 'Returned';

export default function DeliveryOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sellerLocations, setSellerLocations] = useState<any[]>([]);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [deliveryBoyLocation, setDeliveryBoyLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);

    const fetchOrder = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await getOrderDetails(id);
            setOrder(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load order details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrder();
    }, [id]);

    // Fetch seller locations when order is assigned
    useEffect(() => {
        const fetchSellerLocations = async () => {
            if (!id || !order) return;
            // Only fetch if order has delivery boy assigned and status is before "Picked up"
            if (order.status && order.status !== 'Picked up' && order.status !== 'Delivered') {
                try {
                    const locations = await getSellerLocationsForOrder(id);
                    setSellerLocations(locations || []);
                } catch (err) {
                    console.error('Failed to fetch seller locations:', err);
                }
            }
        };
        fetchSellerLocations();
    }, [id, order?.status]);

    // Clean up when component unmounts
    useEffect(() => {
        return () => {
            if (locationIntervalRef.current) {
                clearInterval(locationIntervalRef.current);
            }
        };
    }, []);

    const handleScanSuccess = async (decodedText: string) => {
        setShowScanner(false);
        if (!order) return;

        // Check if scanned text matches Order ID or MongoDB ID
        if (decodedText === order.orderId || decodedText === order._id) {
            // If order is Out for Delivery, we can mark it as Delivered directly via scan
            if (order.status === 'Out for Delivery') {
                const confirmDelivery = window.confirm(`Order verified! Mark as Delivered?`);
                if (confirmDelivery) {
                     await handleStatusChange('Delivered');
                }
            } else if (order.status === 'Ready for pickup') {
                 await handleStatusChange('Picked up');
            } else {
                 alert(`Scanned Order: ${decodedText}. Current Order: ${order.orderId}`);
            }
        } else {
            alert("Invalid QR Code! This code does not match the current order.");
        }
    };


    const handleSendOtp = async () => {
        if (!id) return;
        try {
            setOtpSending(true);
            await sendDeliveryOtp(id);
            setShowOtpInput(true);
            alert('OTP sent to customer successfully');
        } catch (err: any) {
            alert(err.message || 'Failed to send OTP');
        } finally {
            setOtpSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!id || !otpValue) {
            alert('Please enter OTP');
            return;
        }
        try {
            setOtpVerifying(true);
            const result = await verifyDeliveryOtp(id, otpValue);
            alert(result.message || 'OTP verified successfully. Order marked as delivered.');
            await fetchOrder(); // Refresh order data
            setShowOtpInput(false);
            setOtpValue('');
        } catch (err: any) {
            alert(err.message || 'Failed to verify OTP');
        } finally {
            setOtpVerifying(false);
        }
    };

    // Track if location permission was denied
    const locationPermissionDeniedRef = useRef<boolean>(false);

    // Get delivery boy's current location
    useEffect(() => {
        const getCurrentLocation = () => {
            if (!navigator.geolocation) {
                console.warn('Geolocation is not supported by this browser');
                return;
            }

            if (locationPermissionDeniedRef.current) {
                // Don't retry if permission was denied
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setDeliveryBoyLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                    locationPermissionDeniedRef.current = false; // Reset on success
                    setLocationError(null);
                },
                (error: GeolocationPositionError) => {
                    // Handle different error types
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            locationPermissionDeniedRef.current = true;
                            setLocationError('Location permission denied. Please enable location access in your browser settings to track delivery.');
                            console.warn('Location permission denied. Please enable location access in your browser settings.');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            setLocationError('Location information unavailable. Please check your device settings.');
                            console.warn('Location information unavailable. Please check your device settings.');
                            break;
                        case error.TIMEOUT:
                            setLocationError('Location request timed out. Please try again.');
                            console.warn('Location request timed out. Please try again.');
                            break;
                        default:
                            setLocationError(`Error getting location: ${error.message}`);
                            console.warn('Error getting location:', error.message);
                            break;
                    }
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        };

        getCurrentLocation();
    }, []);



    // Socket.io connection
    const socketRef = useRef<any>(null);
    const [socketConnected, setSocketConnected] = useState(false);

    // Initialize Socket
    useEffect(() => {
        let isMounted = true;
        let socket: any = null;

        const initializeSocket = async () => {
            try {
                const [{ io }, { getSocketBaseURL, getAuthToken }] = await Promise.all([
                    import('socket.io-client'),
                    import('../../../services/api/config')
                ]);

                if (!isMounted) return;

                const baseURL = getSocketBaseURL();
                const token = getAuthToken();

                socket = io(baseURL, {
                    auth: { token },
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 2000
                });

                socket.on('connect', () => {
                    if (isMounted) {
                        console.log('✅ Delivery Socket Connected:', socket.id);
                        setSocketConnected(true);
                    }
                });

                socket.on('disconnect', (reason: string) => {
                    if (isMounted) {
                        console.log('❌ Delivery Socket Disconnected:', reason);
                        setSocketConnected(false);
                    }
                });

                socket.on('connect_error', (error: any) => {
                    if (isMounted) {
                        console.error('❌ Delivery Socket Connection Error:', error.message);
                    }
                });

                socketRef.current = socket;
            } catch (err) {
                console.error('Failed to initialize socket:', err);
            }
        };

        initializeSocket();

        return () => {
            isMounted = false;
            if (socket) {
                console.log('🔌 Disconnecting delivery socket...');
                socket.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    // Helper to get socket (for use in other effects)
    const getSocket = useCallback(() => socketRef.current, []);


    // Update delivery boy location from geolocation updates (Socket)
    useEffect(() => {
        if (!id || !order) return;

        const shouldTrack = order.status && order.status !== 'Delivered' && order.status !== 'Cancelled' && order.status !== 'Returned';
        const socket = socketRef.current;

        if (shouldTrack && socketConnected && socket) {
            const updateLocation = async () => {
                if (!navigator.geolocation) return;
                if (locationPermissionDeniedRef.current) return;

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const newLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        };
                        setDeliveryBoyLocation(newLocation);
                        setLastUpdate(new Date());

                        // Emit via Socket
                        socket.emit('update-location', {
                            orderId: id,
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        });

                        locationPermissionDeniedRef.current = false;
                    },
                    (error: GeolocationPositionError) => {
                        // ... error handling ...
                         if (error.code === error.PERMISSION_DENIED) {
                            if (!locationPermissionDeniedRef.current) {
                                locationPermissionDeniedRef.current = true;
                                console.warn('Location permission denied.');
                            }
                        }
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            };

            // Initial update
            updateLocation();

            // Interval (4 seconds)
            locationIntervalRef.current = setInterval(updateLocation, 4000);

            return () => {
                if (locationIntervalRef.current) {
                    clearInterval(locationIntervalRef.current);
                    locationIntervalRef.current = null;
                }
            };
        } else {
            if (locationIntervalRef.current) {
                clearInterval(locationIntervalRef.current);
                locationIntervalRef.current = null;
            }
        }
    }, [id, order?.status, socketConnected]);


    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
                <p className="text-neutral-500">Loading order...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center flex-col">
                <p className="text-red-500 mb-4">{error || 'Order not found'}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 bg-neutral-200 rounded-lg text-neutral-700 font-medium"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const statusFlow: DeliveryOrderStatus[] = ['Pending', 'Ready for pickup', 'Picked up', 'Out for Delivery', 'Delivered'];

    let currentStatusIndex = statusFlow.indexOf(order.status as DeliveryOrderStatus);
    // Handle cases where status might not be in the flow (e.g. Cancelled)
    if (currentStatusIndex === -1 && (order.status === 'Cancelled' || order.status === 'Returned')) {
        // Maybe show a different UI for cancelled/returned orders
        currentStatusIndex = -1;
    }

    const handleStatusChange = async (newStatus: DeliveryOrderStatus) => {
        if (!id) return;
        try {
            setLoading(true); // Or use a separate loading state for the action
            const updatedOrder = await updateOrderStatus(id, newStatus);
            // Verify the update was successful and update local state
            if (updatedOrder && updatedOrder.data) {
                setOrder(updatedOrder.data);
            } else {
                // Fallback - re-fetch everything
                await fetchOrder();
            }
        } catch (err: any) {
            alert(err.message || "Failed to update status");
            setLoading(false);
        }
    };

    const getNextStatus = () => {
        if (currentStatusIndex !== -1 && currentStatusIndex < statusFlow.length - 1) {
            return statusFlow[currentStatusIndex + 1];
        }
        return null;
    };

    const nextStatus = getNextStatus();
    const isMapVisible = order.status === 'Picked up' || (sellerLocations.length > 0 && order.status !== 'Delivered');
    const showSellerLocations = sellerLocations.length > 0 && order.status !== 'Picked up' && order.status !== 'Delivered';
    const showCustomerLocation = order.status === 'Picked up';

    return (
        <div className="min-h-screen bg-neutral-50 pb-32 relative">

            {/* Top Bar with Back Button */}
            <div className="sticky top-0 z-20 bg-white border-b border-neutral-100 px-4 py-3 flex items-center shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
                >
                    <Icons.ChevronLeft size={24} />
                </button>
                <span className="ml-2 font-semibold text-lg text-neutral-800">Order Details</span>

                <div className="ml-auto">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                        order.status === 'Picked up' ? 'bg-indigo-100 text-indigo-700' :
                            order.status === 'Ready for pickup' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-orange-100 text-orange-700'
                        }`}>
                        {order.status}
                    </span>
                </div>
            </div>

            {/* Location Error Warning */}
            {locationError && (
                <div className="mx-4 mt-4 bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                    <Icons.AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-800">Location Access Required</p>
                        <p className="text-xs text-red-600 mt-0.5">{locationError}</p>
                    </div>
                </div>
            )}

            {/* Google Maps View - Shared Component for Parity */}
            {isMapVisible && (
                <GoogleMapsTracking
                    sellerLocations={sellerLocations.map(s => ({
                        lat: s.latitude,
                        lng: s.longitude,
                        name: s.storeName
                    }))}
                    customerLocation={{
                        lat: order.deliveryAddress?.latitude || order.address?.latitude || 0,
                        lng: order.deliveryAddress?.longitude || order.address?.longitude || 0
                    }}
                    deliveryLocation={deliveryBoyLocation || undefined}
                    isTracking={!!deliveryBoyLocation}
                    showRoute={!!deliveryBoyLocation && (
                        order.status === 'Picked up' ||
                        order.status === 'Out for Delivery' ||
                        (sellerLocations.length > 0 && order.status !== 'Delivered')
                    )}
                    routeOrigin={deliveryBoyLocation || undefined}
                    routeDestination={
                        order.status === 'Picked up' || order.status === 'Out for Delivery'
                            ? {
                                lat: order.deliveryAddress?.latitude || order.address?.latitude || 0,
                                lng: order.deliveryAddress?.longitude || order.address?.longitude || 0
                            }
                            : sellerLocations.length > 0
                                ? { lat: sellerLocations[sellerLocations.length - 1].latitude, lng: sellerLocations[sellerLocations.length - 1].longitude }
                                : undefined
                    }
                    routeWaypoints={
                        order.status === 'Picked up' || order.status === 'Out for Delivery'
                            ? []
                            : sellerLocations.length > 1
                                ? sellerLocations.slice(0, -1).map(s => ({ lat: s.latitude, lng: s.longitude }))
                                : []
                    }
                    destinationName={
                        order.status === 'Picked up' || order.status === 'Out for Delivery'
                            ? order.address?.split(',')[0]
                            : sellerLocations.length > 0
                                ? sellerLocations[0].storeName
                                : undefined
                    }
                    onRouteInfoUpdate={setRouteInfo}
                    lastUpdate={lastUpdate}
                />
            )}

            {/* Seller Locations Card (before picked up) */}
            {showSellerLocations && sellerLocations.length > 0 && (
                <div className="p-4">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                        <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                            <Icons.Store size={18} className="text-neutral-500" />
                            Seller Shop Locations
                        </h3>
                        <div className="space-y-3">
                            {sellerLocations.map((seller: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-neutral-900">{seller.storeName}</p>
                                        <p className="text-sm text-neutral-500">{seller.address}, {seller.city}</p>
                                    </div>
                                    {seller.latitude && seller.longitude && (
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Icons.MapPin size={16} className="text-blue-600" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 space-y-4 max-w-lg mx-auto">

                {/* Status Stepper Card */}
                {currentStatusIndex !== -1 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-1">Process</p>
                                <h2 className="text-lg font-bold text-neutral-900">Order Progress</h2>
                            </div>
                        </div>

                        {/* Status Progress Bar */}
                        <div className="relative">
                            <div className="flex justify-between mb-2 relative z-10">
                                {statusFlow.map((step, idx) => (
                                    <div key={idx} className="flex flex-col items-center flex-1">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${idx <= currentStatusIndex
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'bg-white border-neutral-200 text-neutral-300'
                                            }`}>
                                            {idx <= currentStatusIndex ? <Icons.CheckCircle size={14} /> : idx + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Connecting Line */}
                            <div className="absolute top-4 left-0 w-full h-0.5 bg-neutral-100 -z-0">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-500"
                                    style={{ width: `${(currentStatusIndex / (statusFlow.length - 1)) * 100}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-neutral-500 font-medium mt-2">
                                {statusFlow.map((step, idx) => (
                                    <span key={idx} className={`text-center flex-1 transition-colors ${idx === currentStatusIndex ? 'text-blue-600 font-bold' : ''}`}>
                                        {step === 'Ready for pickup' ? 'Ready' : step}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}


                {/* Customer Details */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                    <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                        <Icons.User size={18} className="text-neutral-500" />
                        Customer Details
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                                <Icons.User size={20} />
                            </div>
                            <div>
                                <p className="font-medium text-neutral-900">{order.customerName}</p>
                                <p className="text-sm text-neutral-500">Customer</p>
                            </div>
                            <a href={`tel:${order.customerPhone}`} className="ml-auto p-3 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-md transition-transform hover:scale-105 active:scale-95">
                                <Icons.Phone size={20} />
                            </a>
                        </div>
                        <div className="flex items-start gap-3 pt-3 border-t border-neutral-50">
                            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 text-orange-600">
                                <Icons.MapPin size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-neutral-600 leading-relaxed font-medium">{order.address}</p>
                                {order.distance && (
                                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md">
                                        {order.distance} away
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Order Items */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                            <Icons.ShoppingBag size={18} className="text-neutral-500" />
                            Order Summary
                        </h3>
                        <span className="text-xs font-medium text-neutral-500 px-2 py-1 bg-neutral-100 rounded-md">
                            {order.items?.length || 0} Items
                        </span>
                    </div>

                    {/* Free Gift Warning Banner */}
                    {order.items?.some((i: any) => i.isFreeGift) && (
                        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3">
                            <span className="text-xl">🎁</span>
                            <div>
                                <p className="font-bold text-yellow-800 text-sm">Includes Free Gift</p>
                                <p className="text-xs text-yellow-700">Please ensure the free gift is delivered.</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className={`flex justify-between items-center py-2 border-b border-neutral-50 last:border-0 ${item.isFreeGift ? 'bg-green-50 p-2 rounded border border-green-100' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${item.isFreeGift ? 'bg-green-200 text-green-800' : 'bg-neutral-100 text-neutral-600'}`}>
                                        {item.quantity}x
                                    </span>
                                    <div>
                                        <span className={`text-sm font-medium ${item.isFreeGift ? 'text-green-900' : 'text-neutral-700'}`}>
                                            {item.name || item.productName || item.product?.productName}
                                        </span>
                                        {item.isFreeGift && <span className="block text-[10px] text-green-600 font-bold uppercase tracking-wider">Free Gift</span>}
                                    </div>
                                </div>
                                <span className={`text-sm font-semibold ${item.isFreeGift ? 'text-green-700' : 'text-neutral-900'}`}>
                                    {item.isFreeGift ? 'FREE' : `₹${item.price * item.quantity}`}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-dashed border-neutral-200 flex justify-between items-center">
                        <span className="font-semibold text-neutral-700">Total Amount</span>
                        <span className="text-xl font-bold text-neutral-900">₹{order.totalAmount}</span>
                    </div>
                </div>

                {/* Order Info */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 mb-20">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-neutral-50 rounded-lg">
                            <p className="text-xs text-neutral-500 mb-1">Order ID</p>
                            <p className="text-sm font-bold text-neutral-900">{order.orderId}</p>
                        </div>
                        <div className="p-3 bg-neutral-50 rounded-lg">
                            <p className="text-xs text-neutral-500 mb-1">Order Date</p>
                            <p className="text-sm font-bold text-neutral-900">
                                {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            {/* OTP Section (when order is Picked up) */}
            {order.status === 'Picked up' && !showOtpInput && (
                <div className="fixed bottom-24 left-6 right-6 z-30">
                    <button
                        onClick={handleSendOtp}
                        className="w-full py-4 rounded-2xl bg-green-600 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] text-white font-bold text-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-3 overflow-hidden group"
                        disabled={otpSending}
                    >
                        <span className="relative z-10">{otpSending ? 'Sending OTP...' : 'Send Delivery OTP'}</span>
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
                    </button>
                </div>
            )}

            {/* OTP Input Section */}
            {showOtpInput && (
                <div className="fixed bottom-24 left-6 right-6 z-30 bg-white rounded-2xl p-4 shadow-2xl border border-neutral-200">
                    <p className="text-sm font-semibold text-neutral-900 mb-3">Enter Delivery OTP</p>
                    <input
                        type="text"
                        value={otpValue}
                        onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-lg font-semibold text-center mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        maxLength={6}
                    />
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setShowOtpInput(false);
                                setOtpValue('');
                            }}
                            className="flex-1 py-3 rounded-xl bg-neutral-200 text-neutral-700 font-semibold hover:bg-neutral-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleVerifyOtp}
                            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
                            disabled={otpVerifying || otpValue.length !== 6}
                        >
                            {otpVerifying ? 'Verifying...' : 'Verify OTP'}
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Glassmorphic Action Button Dock - Order Taken button or status update */}
            {nextStatus && order.status !== 'Picked up' && !showOtpInput && (
                <div className="fixed bottom-24 left-6 right-6 z-30 flex gap-3">
                    {/* Scan Button (Visible when Out for Delivery or Ready for Pickup) */}
                   {(order.status === 'Out for Delivery' || order.status === 'Ready for pickup') && (
                        <button
                            onClick={() => setShowScanner(true)}
                            className="w-16 h-full rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                            title="Scan QR Code"
                        >
                             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                                <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                                <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                                <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                                <rect x="7" y="7" width="10" height="10" rx="1"></rect>
                             </svg>
                        </button>
                   )}

                    <button
                        onClick={() => handleStatusChange(nextStatus)}
                        className="flex-1 py-4 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] text-white font-bold text-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-3 overflow-hidden group"
                        disabled={loading}
                    >
                        <span className="relative z-10">
                            {loading ? 'Updating...' : nextStatus === 'Picked up' ? 'Order Taken' : `Mark as ${nextStatus}`}
                        </span>
                        {!loading && <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center relative z-10 group-hover:bg-white/30 transition-colors">
                            <Icons.ChevronLeft className="rotate-180" size={18} />
                        </div>}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
                    </button>
                </div>
            )}

            {/* Scanner Modal */}
            {showScanner && (
                <QRScannerModal
                    onScanSuccess={handleScanSuccess}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}
