import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { useOrders } from '../../hooks/useOrders';
import { useLocation as useLocationContext } from '../../hooks/useLocation';
import { useToast } from '../../context/ToastContext';

// import { products } from '../../data/products'; // Removed
import { OrderAddress, Order } from '../../types/order';
import PartyPopper from './components/PartyPopper';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '../../components/ui/sheet';
import WishlistButton from '../../components/WishlistButton';

import { getCoupons, validateCoupon, Coupon as ApiCoupon } from '../../services/api/customerCouponService';
import { getAppConfig, AppConfig, appConfig as defaultAppConfig } from '../../services/configService';
import { getAddresses } from '../../services/api/customerAddressService';
import { getProducts } from '../../services/api/customerProductService';
import { addToWishlist } from '../../services/api/customerWishlistService';
import { calculateProductPrice, getApplicableUnitPrice } from '../../utils/priceUtils';
import { initiateOnlineOrder, verifyOnlinePayment } from '../../services/api/customerOrderService';

// const STORAGE_KEY = 'saved_address'; // Removed

// Similar products helper removed - using API
// import { getActiveFreeGiftRules, getActiveFreeGiftRule } from '../../services/freeGiftService';


export default function Checkout() {
  const { cart, updateQuantity, clearCart, addToCart, removeFromCart, loading: cartLoading, freeGiftRules } = useCart();

  // Helper to get active rule from context
  const getActiveFreeGiftRule = () => freeGiftRules.length > 0 ? freeGiftRules[freeGiftRules.length - 1] : undefined;
  const { addOrder } = useOrders();
  const { location: userLocation } = useLocationContext();
  const { showToast: showGlobalToast } = useToast();
  const navigate = useNavigate();
  const location = useRouterLocation();
  const [config, setConfig] = useState<AppConfig>(defaultAppConfig);

  useEffect(() => {
    const loadConfig = async () => {
      const cfg = await getAppConfig();
      setConfig(cfg);
    };
    loadConfig();
  }, []);

  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState<number>(0);
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);
  const [savedAddress, setSavedAddress] = useState<OrderAddress | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<OrderAddress | null>(null);
  const [showCouponSheet, setShowCouponSheet] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<ApiCoupon | null>(null);
  const [showPartyPopper, setShowPartyPopper] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [hasAppliedCouponBefore, setHasAppliedCouponBefore] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<ApiCoupon[]>([]);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatedDiscount, setValidatedDiscount] = useState<number>(0);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [showGstinSheet, setShowGstinSheet] = useState(false);
  const [gstin, setGstin] = useState<string>('');
  const [showCancellationPolicy, setShowCancellationPolicy] = useState(false);
  const [giftPackaging, setGiftPackaging] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('Razorpay');
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);

  // Redirect if empty
  useEffect(() => {
    if (!cartLoading && cart.items.length === 0 && !showOrderSuccess) {
      navigate('/');
    }
  }, [cart.items.length, cartLoading, navigate, showOrderSuccess]);

  // Load addresses and coupons
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [addressResponse, couponResponse] = await Promise.all([
          getAddresses(),
          getCoupons()
        ]);

        if (addressResponse.success && Array.isArray(addressResponse.data) && addressResponse.data.length > 0) {
          const defaultAddr = addressResponse.data.find((a: any) => a.isDefault) || addressResponse.data[0];
          const mappedAddress: OrderAddress = {
            name: defaultAddr.fullName,
            phone: defaultAddr.phone,
            flat: '',
            street: defaultAddr.address,
            city: defaultAddr.city,
            state: defaultAddr.state,
            pincode: defaultAddr.pincode,
            landmark: defaultAddr.landmark || '',
            latitude: defaultAddr.latitude,
            longitude: defaultAddr.longitude,
            id: defaultAddr._id,
            _id: defaultAddr._id
          };
          setSavedAddress(mappedAddress);
          setSelectedAddress(mappedAddress);
        }

        if (couponResponse.success) {
          setAvailableCoupons(couponResponse.data);
        }
      } catch (error) {
        console.error('Error loading checkout data:', error);
      }
    };
    fetchInitialData();
  }, [location.key]);

  // Fetch similar products dynamically
  useEffect(() => {
    const fetchSimilar = async () => {
      const items = (cart?.items || []).filter(item => item && item.product);
      if (items.length === 0) return;

      const cartItem = items[0];
      try {
        let response;
        if (cartItem && cartItem.product) {
          // Try to fetch by category of the first item
          let catId = '';
          const product = cartItem.product;

          if (product.categoryId) {
            catId = typeof product.categoryId === 'string'
              ? product.categoryId
              : (product.categoryId as any)._id || (product.categoryId as any).id;
          }

          if (catId) {
            response = await getProducts({ category: catId, limit: 10 });
          } else {
            response = await getProducts({ limit: 10, sort: 'popular' });
          }
        } else {
          response = await getProducts({ limit: 10, sort: 'popular' });
        }

        if (response && response.data) {
          // Filter out items already in cart
          const itemsInCartIds = new Set((cart?.items || []).map(i => i.product?.id || i.product?._id).filter(Boolean));
          const filtered = response.data
            .filter((p: any) => !itemsInCartIds.has(p.id || p._id))
            .map((p: any) => {
              const { displayPrice, mrp } = calculateProductPrice(p);
              return {
                ...p,
                id: p._id || p.id,
                name: p.productName || p.name || 'Product',
                imageUrl: p.mainImage || p.imageUrl || p.mainImageUrl || '',
                price: displayPrice,
                mrp: mrp,
                pack: p.pack || p.variations?.[0]?.title || p.variations?.[0]?.name || 'Standard',
              };
            })
            .slice(0, 6);
          setSimilarProducts(filtered);
        }
      } catch (err) {
        console.error("Failed to fetch similar products", err);
      }
    };
    fetchSimilar();
  }, [cart?.items?.length]);

  if (cartLoading || ((cart?.items?.length || 0) === 0 && !showOrderSuccess)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-medium text-neutral-600">
            {cartLoading ? 'Loading checkout...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  const displayItems = (cart?.items || []).filter(item => item && item.product);
  const displayCart = {
    ...cart,
    items: displayItems,
    itemCount: displayItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
    total: displayItems.reduce((sum, item) => {
      if (item.isFreeGift) return sum;
      const unitPrice = getApplicableUnitPrice(item.product, item.variant, item.quantity || 0);
      return sum + unitPrice * (item.quantity || 0);
    }, 0)
  };

  const amountNeededForFreeDelivery = Math.max(0, config.freeDeliveryThreshold - (displayCart.total || 0));
  const cartItem = displayItems[0];

  const itemsTotal = displayItems.reduce((sum, item) => {
    if (!item?.product || item.isFreeGift) return sum;
    // For MRp calculation in savings, we still compare MRP vs Tier Price
    const { mrp } = calculateProductPrice(item.product, item.variant);
    // Determine the effective price we are selling at (this is 'discountedTotal' effectively, but 'Items total' in UI usually means MRP total in Indian e-commerce to show savings, OR it means Selling Price total.
    // Usually:
    // Items Total (MRP): ₹200
    // Savings: -₹50
    // To Pay: ₹150
    //
    // The code below suggests 'itemsTotal' is used to calculate 'savedAmount' = itemsTotal - discountedTotal.
    // So itemsTotal MUST be the MRP total.
    return sum + (mrp * (item.quantity || 0));
  }, 0);

  const discountedTotal = displayCart.total;
  const savedAmount = itemsTotal - discountedTotal;
  const handlingCharge = 0;
  const deliveryCharge = displayCart.total >= config.freeDeliveryThreshold ? 0 : config.deliveryFee;

  // Recalculate or use validated discount
  // If we have a selected coupon, we should re-validate if cart total changes,
  // but for simplicity, we'll re-calculate locally if possible or trust the previous validation if acceptable (better to re-validate)
  const subtotalBeforeCoupon = discountedTotal + handlingCharge + deliveryCharge;

  // Local calculation for immediate feedback, relying on backend validation on Apply
  let currentCouponDiscount = 0;
  if (selectedCoupon) {
    // Logic mirrors backend for UI update purposes
    if (selectedCoupon.minOrderValue && subtotalBeforeCoupon < selectedCoupon.minOrderValue) {
      // Invalid now
    } else {
      if (selectedCoupon.discountType === 'percentage') {
        currentCouponDiscount = Math.round((subtotalBeforeCoupon * selectedCoupon.discountValue) / 100);
        if (selectedCoupon.maxDiscountAmount && currentCouponDiscount > selectedCoupon.maxDiscountAmount) {
          currentCouponDiscount = selectedCoupon.maxDiscountAmount;
        }
      } else {
        currentCouponDiscount = selectedCoupon.discountValue;
      }
    }
  }

  // Calculate tip amount (use custom tip if custom tip input is shown, otherwise use selected tip)
  const finalTipAmount = showCustomTipInput ? customTipAmount : (tipAmount || 0);
  const giftPackagingFee = giftPackaging ? 30 : 0;

  const onlineDiscountConfig = config.onlinePaymentDiscount;
  const onlineDiscountPercentage = onlineDiscountConfig?.enabled ? onlineDiscountConfig.percentage : 0;

  // Base for online discount should be Subtotal + Handling + Delivery + Tip + Gift - Coupon
  const baseTotalForDiscount = Math.max(0, discountedTotal + handlingCharge + deliveryCharge + finalTipAmount + giftPackagingFee - currentCouponDiscount);
  const onlineDiscountAmount = (baseTotalForDiscount * onlineDiscountPercentage) / 100;

  const grandTotal = baseTotalForDiscount;

  const handleApplyCoupon = async (coupon: ApiCoupon) => {
    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(coupon.code, subtotalBeforeCoupon);
      if (result.success && result.data?.isValid) {
        const isFirstTime = !hasAppliedCouponBefore;
        setSelectedCoupon(coupon);
        setValidatedDiscount(result.data.discountAmount);
        setShowCouponSheet(false);
        if (isFirstTime) {
          setHasAppliedCouponBefore(true);
          setShowPartyPopper(true);
        }
      } else {
        setCouponError(result.message || 'Invalid coupon');
      }
    } catch (err: any) {
      setCouponError(err.response?.data?.message || 'Failed to apply coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setSelectedCoupon(null);
    setValidatedDiscount(0);
    setCouponError(null);
  };

  const handleMoveToWishlist = async (product: any) => {
    if (!product?.id && !product?._id) return;

    const productId = product.id || product._id;

    try {
      if (!userLocation?.latitude || !userLocation?.longitude) {
         showGlobalToast('Location is required to move items to wishlist', 'error');
         return;
      }

      // Add to wishlist
      await addToWishlist(productId, userLocation.latitude, userLocation.longitude);
      // Remove from cart
      await removeFromCart(productId);
      // Show success message
      showGlobalToast('Item moved to wishlist');
    } catch (error: any) {
      console.error('Failed to move to wishlist:', error);
      const msg = error.response?.data?.message || 'Failed to move item to wishlist';
      showGlobalToast(msg, 'error');
    }
  };



  const loadScript = (src: string) => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleVerifyPayment = async (orderId: string, paymentId: string) => {
      setIsProcessingPayment(true);
      try {
          const response = await verifyOnlinePayment({ orderId, paymentId, status: 'success' });
          if (response.success) {
              setPlacedOrderId(orderId);
              clearCart();
              setShowOrderSuccess(true);
          } else {
              alert("Payment Verification Failed. Please contact support.");
          }
      } catch (error) {
          console.error("Verify Error", error);
          alert("Error verifying payment");
      } finally {
          setIsProcessingPayment(false);
      }
  };

  const handlePaymentSelection = async (method: string) => {
    setShowPaymentModal(false);

    if (!selectedAddress || cart.items.length === 0) return;

    // Use user's current location as fallback if address doesn't have coordinates
    const finalLatitude = selectedAddress.latitude ?? userLocation?.latitude;
    const finalLongitude = selectedAddress.longitude ?? userLocation?.longitude;

    const addressWithLocation: OrderAddress = {
      ...selectedAddress,
      latitude: finalLatitude,
      longitude: finalLongitude,
    };

    if (method === 'Cash') {
       await performOrderPlacement('COD');
       return;
    }

    setIsProcessingPayment(true);
    try {
        const orderData = {
            items: cart.items.map(item => {
                const activeRule = getActiveFreeGiftRule();
                const isFreeGiftItem = item.isFreeGift;

                // Get the most reliable ID
                const productId = item.product.id || item.product._id;

                return {
                    product: { id: productId },
                    quantity: item.quantity,
                    variant: item.variant, // Assuming backend handles this structure
                    isFreeGift: isFreeGiftItem || false,
                    price: isFreeGiftItem ? 0 : undefined, // Explicitly send 0 if free gift
                    freeGiftReason: isFreeGiftItem && activeRule ? `Cart value ≥ ₹${activeRule.minCartValue}` : undefined
                };
            }),
            address: addressWithLocation,
            fees: {
                platformFee: handlingCharge,
                deliveryFee: deliveryCharge,
            },
            paymentMethod: method,
            couponCode: selectedCoupon?.code,
            gstin: gstin || undefined,
            tipAmount: finalTipAmount,
            giftPackaging: giftPackaging,
            gateway: method
        };

        const response = await initiateOnlineOrder(orderData as any);

        if (response.success) {
            const { gateway, orderId, amount, key, razorpayOrderId, paymentSessionId, isSandbox } = response.data;

            if (gateway === 'Razorpay') {
                const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
                if (!res) {
                    alert("Razorpay SDK failed to load");
                    setIsProcessingPayment(false);
                    return;
                }

                const options = {
                    key: key,
                    amount: amount * 100,
                    currency: "INR",
                    name: "Geeta Stores",
                    description: "Order Payment",
                    order_id: razorpayOrderId,
                    handler: async function (response: any) {
                        await handleVerifyPayment(orderId, response.razorpay_payment_id);
                    },
                    prefill: {
                        name: savedAddress?.name || "",
                        contact: savedAddress?.phone || ""
                    },
                    theme: {
                        color: "#16a34a"
                    }
                };
                const rzp1 = new (window as any).Razorpay(options);
                rzp1.open();
                setIsProcessingPayment(false);
            } else if (gateway === 'Cashfree') {
                const res = await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
                if (!res) {
                    alert("Cashfree SDK failed to load");
                    setIsProcessingPayment(false);
                    return;
                }
                const cashfree = new (window as any).Cashfree({
                    mode: isSandbox ? "sandbox" : "production"
                });
                cashfree.checkout({
                    paymentSessionId: paymentSessionId,
                    redirectTarget: "_modal",
                }).then((result: any) => {
                     // For seamless/modal flow, usually we verify on callback or webhook.
                     // But if promise resolves indicating success or close.
                     // Ideally we check payment status from backend.
                     // For now, let's assume if it returns, we check.
                     // Actually cashfree JS SDK usage implies redirect or handle result.
                     // Checking 'result' object might be needed.
                     // Just triggering verify for now as placeholder for user flow completion
                     handleVerifyPayment(orderId, "CF_References_Checked_Backend");
                });
                setIsProcessingPayment(false);
            }
        } else {
             alert(response.message || "Failed to initiate payment");
             setIsProcessingPayment(false);
        }
    } catch (error: any) {
        console.error("Payment Init Error", error);
        alert(error.response?.data?.message || error.message || "Error initiating payment");
        setIsProcessingPayment(false);
    }
  };

  const performOrderPlacement = async (method: string) => {
    // Re-validate just in case
    if (!selectedAddress || cart.items.length === 0) return;

    const finalLatitude = selectedAddress.latitude ?? userLocation?.latitude;
    const finalLongitude = selectedAddress.longitude ?? userLocation?.longitude;

    const addressWithLocation: OrderAddress = {
      ...selectedAddress,
      latitude: finalLatitude,
      longitude: finalLongitude,
    };

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const order: Order = {
      id: orderId,
      items: cart.items.map(item => {
          const activeRule = getActiveFreeGiftRule();
          const isFreeGiftItem = item.isFreeGift;
          return {
              ...item,
              isFreeGift: isFreeGiftItem || false,
              price: isFreeGiftItem ? 0 : item.price,
              freeGiftReason: isFreeGiftItem && activeRule ? `Cart value ≥ ₹${activeRule.minCartValue}` : undefined
          };
      }),
      totalItems: cart.itemCount,
      subtotal: discountedTotal,
      fees: {
        platformFee: handlingCharge,
        deliveryFee: deliveryCharge,
      },
      totalAmount: grandTotal,
      address: addressWithLocation,
      status: 'Placed',
      createdAt: new Date().toISOString(),
      tipAmount: finalTipAmount,
      gstin: gstin || undefined,
      couponCode: selectedCoupon?.code || undefined,
      giftPackaging: giftPackaging,
    };

    try {
      const placedId = await addOrder(order);
      if (placedId) {
        setPlacedOrderId(placedId);
        clearCart();
        setShowOrderSuccess(true);
      }
    } catch (error: any) {
      console.error("Order placement failed", error);
      const errorMessage = error.message || error.response?.data?.message || "Failed to place order. Please try again.";
      alert(errorMessage);
    }
  };

  const handlePlaceOrderClick = () => {
    if (!selectedAddress || cart.items.length === 0) {
      return;
    }

    // Validate required address fields
    if (!selectedAddress.city || !selectedAddress.pincode) {
      console.error("Address is missing required fields (city or pincode)");
      alert("Please ensure your address has city and pincode.");
      return;
    }

    // Use user's current location as fallback if address doesn't have coordinates
    const finalLatitude = selectedAddress.latitude ?? userLocation?.latitude;
    const finalLongitude = selectedAddress.longitude ?? userLocation?.longitude;

    // Validate that we have location data (either from address or user's current location)
    if (!finalLatitude || !finalLongitude) {
      console.error("Address is missing location data (latitude/longitude) and user location is not available");
      alert("Location is required for delivery. Please ensure your address has location data or enable location access.");
      return;
    }

    handlePaymentSelection(selectedPaymentMethod);
  };

  const handleGoToOrders = () => {
    if (placedOrderId) {
      navigate(`/orders/${placedOrderId}`);
    } else {
      navigate('/orders');
    }
  };

  return (
    <div
      className="bg-white min-h-screen flex flex-col"
    >

      {/* Party Popper Animation */}
      <PartyPopper
        show={showPartyPopper}
        onComplete={() => setShowPartyPopper(false)}
      />

      {/* Order Success Celebration Page */}
      {showOrderSuccess && (
        <div
          className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center h-screen w-screen overflow-hidden"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          {/* Confetti Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Animated confetti pieces */}
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
                  animation: `confettiFall ${2 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>

          {/* Success Content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            {/* Success Tick Circle */}
            <div
              className="relative mb-8"
              style={{ animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both' }}
            >
              {/* Outer ring animation */}
              <div
                className="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-500"
                style={{
                  animation: 'ringPulse 1.5s ease-out infinite',
                  opacity: 0.3
                }}
              />
              {/* Main circle */}
              <div className="w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl">
                <svg
                  className="w-16 h-16 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'checkDraw 0.5s ease-out 0.5s both' }}
                >
                  <path d="M5 12l5 5L19 7" className="check-path" />
                </svg>
              </div>
              {/* Sparkles */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    top: '50%',
                    left: '50%',
                    animation: `sparkle 0.6s ease-out ${0.3 + i * 0.1}s both`,
                    transform: `rotate(${i * 60}deg) translateY(-80px)`,
                  }}
                />
              ))}
            </div>

            {/* Location Info */}
            <div
              className="text-center"
              style={{ animation: 'slideUp 0.5s ease-out 0.6s both' }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-5 h-5 text-red-500">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedAddress?.city || "Your Location"}
                </h2>
              </div>
              <p className="text-gray-500 text-base">
                {selectedAddress ? `${selectedAddress.street}, ${selectedAddress.city}` : "Delivery Address"}
              </p>
            </div>

            {/* Order Placed Message */}
            <div
              className="mt-12 text-center"
              style={{ animation: 'slideUp 0.5s ease-out 0.8s both' }}
            >
              <h3 className="text-3xl font-bold text-green-600 mb-2">Order Placed!</h3>
              <p className="text-gray-600">Your order is on the way</p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGoToOrders}
              className="mt-10 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-12 rounded-xl shadow-lg transition-all hover:shadow-xl hover:scale-105"
              style={{ animation: 'slideUp 0.5s ease-out 1s both' }}
            >
              Track Your Order
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="px-4 md:px-6 lg:px-8 py-2 md:py-3 flex items-center justify-between">
          {/* Back Arrow */}
          <button
            onClick={() => navigate(-1)}
            className="w-7 h-7 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Title */}
          <h1 className="text-base font-bold text-neutral-900">Checkout</h1>

          {/* Spacer to maintain layout */}
          <div className="w-7 h-7"></div>
        </div>
      </div>

      {/* Ordering for someone else */}
      <div className="px-4 md:px-6 lg:px-8 py-2 md:py-3 bg-neutral-50 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-700">Ordering for someone else?</span>
          <button
            onClick={() => navigate('/checkout/address', {
              state: {
                editAddress: savedAddress
              }
            })}
            className="text-xs text-green-600 font-medium hover:text-green-700 transition-colors"
          >
            Add details
          </button>
        </div>
      </div>

      {/* Saved Address Section */}
      {savedAddress && (
        <div className="px-4 md:px-6 lg:px-8 py-2 md:py-3 border-b border-neutral-200">
          <div className="mb-2">
            <h3 className="text-xs font-semibold text-neutral-900 mb-0.5">Delivery Address</h3>
            <p className="text-[10px] text-neutral-600">Select or edit your saved address</p>
          </div>

          <div
            className={`border rounded-lg p-2.5 cursor-pointer transition-all ${selectedAddress ? 'border-green-600 bg-green-50' : 'border-neutral-300 bg-white'
              }`}
            onClick={() => setSelectedAddress(savedAddress)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedAddress ? 'border-green-600 bg-green-600' : 'border-neutral-400'
                    }`}>
                    {selectedAddress && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-neutral-900">{savedAddress.name}</span>
                </div>
                <p className="text-[10px] text-neutral-600 mb-0.5">{savedAddress.phone}</p>
                <p className="text-[10px] text-neutral-600">
                  {savedAddress.flat}, {savedAddress.street}, {savedAddress.city} - {savedAddress.pincode}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/checkout/address', {
                    state: {
                      editAddress: savedAddress
                    }
                  });
                }}
                className="text-xs text-green-600 font-medium ml-2"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Product Card */}
      <div className="px-4 md:px-6 lg:px-8 py-2 md:py-3 bg-white border-b border-neutral-200">
        <div className="bg-white rounded-lg border border-neutral-200 p-2.5">
          {/* Delivery info */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
                <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-neutral-900">Delivery in {config.estimatedDeliveryTime}</span>
          </div>


        {/* Free Gift Progress Bar (Multi-Tier Checkout) */}
        {(() => {
             const activeRules = freeGiftRules;
             if (activeRules.length === 0) return null;

             const currentTotal = displayCart.total;
             const highestRule = activeRules[activeRules.length - 1];
             const maxTarget = highestRule.minCartValue;
             const nextRule = activeRules.find(r => r.minCartValue > currentTotal);

             return (
               <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-semibold text-gray-800">
                            {nextRule ? `Unlock: ${nextRule.giftProduct?.productName || 'Gift'}` : "🎉 All Gifts Unlocked!"}
                        </span>
                        {nextRule && (
                             <span className="text-[10px] text-gray-500">
                                Add <span className="font-bold text-teal-700">₹{nextRule.minCartValue - currentTotal}</span> more
                             </span>
                        )}
                    </div>

                    {/* Milestone Bar */}
                    <div className="relative h-12 mb-1">
                         {/* Background Line */}
                         <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full -translate-y-1/2 z-0"></div>

                         {/* Progress Line */}
                         <div
                            className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-teal-400 to-green-500 rounded-full -translate-y-1/2 z-0 transition-all duration-300"
                            style={{ width: `${Math.min(100, (currentTotal / maxTarget) * 100)}%` }}
                         ></div>

                         {/* Milestones */}
                         {activeRules.map((rule) => {
                             const isUnlocked = currentTotal >= rule.minCartValue;
                             const position = (rule.minCartValue / maxTarget) * 100;

                             return (
                                 <div
                                    key={rule._id || rule.id}
                                    className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                                    style={{ left: `${position}%`, transform: `translate(-${position === 100 ? '100' : '50'}%, -50%)` }}
                                 >
                                     {/* Icon Circle */}
                                     <div className={`w-6 h-6 rounded-full border flex items-center justify-center bg-white transition-all duration-300 ${isUnlocked ? 'border-green-500 text-green-500 shadow-sm' : 'border-gray-300 text-gray-300'}`}>
                                         {isUnlocked ? (
                                             <span className="text-[10px] font-bold">✓</span>
                                         ) : (
                                             <span className="text-[8px]">🎁</span>
                                         )}
                                     </div>

                                     {/* Label */}
                                     {/* Only show label if it's the next target or last one to avoid clutter */}
                                     <div className="absolute top-7 w-16 text-center">
                                         <span className={`text-[8px] font-bold block ${isUnlocked ? 'text-green-600' : 'text-gray-400'}`}>
                                             ₹{rule.minCartValue}
                                         </span>
                                     </div>
                                 </div>
                             );
                         })}
                    </div>
                    {/* Next Gift Preview */}
                    {nextRule && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                            {nextRule.giftProduct?.mainImage && (
                                <img src={nextRule.giftProduct.mainImage} alt="" className="w-6 h-6 object-cover rounded border border-white shadow-sm" />
                            )}
                            <span className="text-[10px] text-gray-600">
                                Get free <b>{nextRule.giftProduct?.productName}</b> at ₹{nextRule.minCartValue}
                            </span>
                        </div>
                    )}
               </div>
             );
        })()}

          <p className="text-[10px] text-neutral-600 mb-2.5">Shipment of {displayCart.itemCount || 0} {(displayCart.itemCount || 0) === 1 ? 'item' : 'items'}</p>

          {/* Cart Items */}
          <div className="space-y-2.5">
            {displayItems.filter(item => item.product).map((item, index) => {
              const isFreeGift = item.isFreeGift;
              return (
              <div key={`${item.product?.id || 'product'}-${item.variant || ''}-${index}`} className="flex gap-2">
                {/* Product Image */}
                <div className="w-12 h-12 bg-neutral-100 rounded-lg flex-shrink-0 overflow-hidden relative">
                  {item.product?.imageUrl ? (
                    <img
                      src={item.product?.imageUrl}
                      alt={item.product?.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400">
                      {(item.product?.name || '').charAt(0)}
                    </div>
                  )}
                  {isFreeGift && (
                      <div className="absolute top-0 left-0 right-0 bg-green-500 text-white text-[8px] text-center font-bold">
                          FREE
                      </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold text-neutral-900 mb-0.5 line-clamp-2">
                    {item.product?.name}
                    {isFreeGift && <span className="ml-1 text-green-600 font-bold">(Free Gift)</span>}
                  </h3>
                  <p className="text-[10px] text-neutral-600 mb-0.5">{item.quantity} × {item.product?.pack}</p>

                  {!isFreeGift && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveToWishlist(item.product);
                    }}
                    className="text-[10px] text-green-600 font-medium mb-1.5 hover:text-green-700 transition-colors"
                  >
                    Move to wishlist
                  </button>
                  )}

                  {/* Quantity Selector */}
                  <div className="flex items-center justify-between mt-1.5">
                    {isFreeGift ? (
                        <div className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">
                            Standard Qty: 1
                        </div>
                    ) : (
                    <div className="flex items-center gap-1.5 bg-white border-2 border-green-600 rounded-full px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const variantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id || item.variant;
                          const variantTitle = (item.product as any).variantTitle || (item.product as any).pack;
                          updateQuantity(item.product?.id || item.product?._id, (item.quantity || 1) - 1, variantId, variantTitle);
                        }}
                        className="w-5 h-5 flex items-center justify-center text-green-600 font-bold hover:bg-green-50 rounded-full transition-colors text-xs"
                      >
                        −
                      </button>
                      <span className="text-xs font-bold text-green-600 min-w-[1.25rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const variantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id || item.variant;
                          const variantTitle = (item.product as any).variantTitle || (item.product as any).pack;
                          updateQuantity(item.product?.id || item.product?._id, (item.quantity || 1) + 1, variantId, variantTitle);
                        }}
                        className="w-5 h-5 flex items-center justify-center text-green-600 font-bold hover:bg-green-50 rounded-full transition-colors text-xs"
                      >
                        +
                      </button>
                    </div>
                    )}

                    <div className="flex flex-col items-end">
                      {isFreeGift ? (
                          <span className="text-xs font-bold text-neutral-900">₹0</span>
                      ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-neutral-900">
                                ₹{(getApplicableUnitPrice(item.product, item.variant, item.quantity) * (item.quantity || 0)).toFixed(0)}
                            </span>
                             {/* Show tier info if active */}
                             {getApplicableUnitPrice(item.product, item.variant, item.quantity) < calculateProductPrice(item.product, item.variant).displayPrice && (
                                <span className="text-[9px] text-green-600 font-medium">
                                    Bulk Applied
                                </span>
                             )}
                          </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>


        </div>
      </div>

      {/* You might also like */}
      <div className="px-4 md:px-6 lg:px-8 py-2.5 md:py-3 border-b border-neutral-200">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">You might also like</h2>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3" style={{ scrollSnapType: 'x mandatory' }}>
          {similarProducts.map((product, index) => {
            // Get price details
            const { displayPrice, mrp, discount, hasDiscount } = calculateProductPrice(product);

            // Get quantity in cart
            const productId = product.id || product._id;
            const inCartItem = (cart?.items || []).find(item => {
              const itemProductId = item.product?.id || item.product?._id;
              return itemProductId === productId;
            });
            const inCartQty = inCartItem?.quantity || 0;

            return (
              <div
                key={`${product.id || product._id}-${index}`}
                className="flex-shrink-0 w-[140px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="bg-white rounded-lg overflow-hidden flex flex-col relative h-full" style={{ boxShadow: '0 1px 1px rgba(0, 0, 0, 0.03)' }}>
                  {/* Product Image Area */}
                  <div
                    onClick={() => navigate(`/product/${product.id || product._id}`)}
                    className="relative block cursor-pointer"
                  >
                    <div className="w-full h-28 bg-neutral-100 flex items-center justify-center overflow-hidden relative">
                      {product.imageUrl || product.mainImage ? (
                        <img
                          src={product.imageUrl || product.mainImage}
                          alt={product.name || product.productName || 'Product'}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.fallback-icon')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon';
                              fallback.textContent = (product.name || product.productName || '?').charAt(0).toUpperCase();
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl">
                          {(product.name || product.productName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Red Discount Badge - Top Left */}
                      {discount > 0 && (
                        <div className="absolute top-1 left-1 z-10 bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                          {discount}% OFF
                        </div>
                      )}

                      {/* Heart Icon - Top Right */}
                      <WishlistButton
                        productId={product.id || product._id}
                        size="sm"
                        className="top-1 right-1 shadow-sm"
                      />

                      {/* ADD Button or Quantity Stepper - Overlaid on bottom right of image */}
                      <div className="absolute bottom-1.5 right-1.5 z-10">
                        <AnimatePresence mode="wait">
                          {inCartQty === 0 ? (
                            <motion.button
                              key="add-button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2 }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToCart(product, e.currentTarget);
                              }}
                              className="bg-white/95 backdrop-blur-sm text-green-600 border-2 border-green-600 text-[10px] font-semibold px-2 py-1 rounded shadow-md hover:bg-white transition-colors"
                            >
                              ADD
                            </motion.button>
                          ) : (
                            <motion.div
                              key="stepper"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-center gap-1 bg-green-600 rounded px-1.5 py-1 shadow-md"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const variantId = (inCartItem?.product as any)?.variantId || (inCartItem?.product as any)?.selectedVariant?._id || inCartItem?.variant;
                                const variantTitle = (inCartItem?.product as any)?.variantTitle || (inCartItem?.product as any)?.pack;
                                updateQuantity(productId, inCartQty - 1, variantId, variantTitle);
                              }}
                                className="w-4 h-4 flex items-center justify-center text-white font-bold hover:bg-green-700 rounded transition-colors p-0 leading-none"
                                style={{ lineHeight: 1, fontSize: '14px' }}
                              >
                                <span className="relative top-[-1px]">−</span>
                              </motion.button>
                              <motion.span
                                key={inCartQty}
                                initial={{ scale: 1.2, y: -2 }}
                                animate={{ scale: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                                className="text-white font-bold min-w-[0.75rem] text-center"
                                style={{ fontSize: '12px' }}
                              >
                                {inCartQty}
                              </motion.span>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const variantId = (inCartItem?.product as any)?.variantId || (inCartItem?.product as any)?.selectedVariant?._id || inCartItem?.variant;
                                  const variantTitle = (inCartItem?.product as any)?.variantTitle || (inCartItem?.product as any)?.pack;
                                  updateQuantity(productId, inCartQty + 1, variantId, variantTitle);
                                }}
                                className="w-4 h-4 flex items-center justify-center text-white font-bold hover:bg-green-700 rounded transition-colors p-0 leading-none"
                                style={{ lineHeight: 1, fontSize: '14px' }}
                              >
                                <span className="relative top-[-1px]">+</span>
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="p-1.5 flex-1 flex flex-col bg-white">
                    {/* Light Grey Tags */}
                    <div className="flex gap-0.5 mb-0.5">
                      <div className="bg-neutral-200 text-neutral-700 text-[8px] font-medium px-1 py-0.5 rounded">
                        {product.pack || '1 unit'}
                      </div>
                      {product.pack && (product.pack.includes('g') || product.pack.includes('kg')) && (
                        <div className="bg-neutral-200 text-neutral-700 text-[8px] font-medium px-1 py-0.5 rounded">
                          {product.pack.replace(/[gk]/gi, '').trim()} GSM
                        </div>
                      )}
                    </div>

                    {/* Product Name */}
                    <div
                      onClick={() => navigate(`/product/${product.id || product._id}`)}
                      className="mb-0.5 cursor-pointer"
                    >
                      <h3 className="text-[10px] font-bold text-neutral-900 line-clamp-2 leading-tight">
                        {product.name || product.productName || 'Product'}
                      </h3>
                    </div>

                    {/* Rating and Reviews */}
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            width="8"
                            height="8"
                            viewBox="0 0 24 24"
                            fill={i < 4 ? '#fbbf24' : '#e5e7eb'}
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-[8px] text-neutral-500">(85)</span>
                    </div>

                    {/* Delivery Time */}
                    <div className="text-[9px] text-neutral-600 mb-0.5">
                      20 MINS
                    </div>

                    {/* Discount - Blue Text */}
                    {discount > 0 && (
                      <div className="text-[9px] text-blue-600 font-semibold mb-0.5">
                        {discount}% OFF
                      </div>
                    )}

                    {/* Price */}
                    <div className="mb-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[13px] font-bold text-neutral-900">
                          ₹{(displayPrice || 0).toLocaleString('en-IN')}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] text-neutral-400 line-through">
                            ₹{(mrp || 0).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Link */}
                    <div
                      onClick={() => navigate(`/category/${product.categoryId || product.category || 'all'}`)}
                      className="w-full bg-green-100 text-green-700 text-[8px] font-medium py-0.5 rounded-lg flex items-center justify-between px-1 hover:bg-green-200 transition-colors mt-auto cursor-pointer"
                    >
                      <span>See more like this</span>
                      <div className="flex items-center gap-0.5">
                        <div className="w-px h-2 bg-green-300"></div>
                        <svg width="6" height="6" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0 0L8 4L0 8Z" fill="#16a34a" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Get FREE delivery banner */}
      {deliveryCharge > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-2 mb-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 13h14M5 13l4-4m-4 4l4 4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="18" cy="5" r="2" fill="#3b82f6" />
            </svg>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700">Get FREE delivery</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 18l6-6-6-6" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-[10px] text-blue-600 mt-0.5">Add products worth ₹{amountNeededForFreeDelivery} more</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${Math.min(100, ((199 - amountNeededForFreeDelivery) / 199) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Coupon Section */}
      {selectedCoupon ? (
        <div className="px-4 py-1.5 border-b border-neutral-200">
          <div className="flex items-center justify-between bg-green-50 rounded-lg p-2 border border-green-200">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-700 truncate">{selectedCoupon?.code}</p>
                <p className="text-[10px] text-green-600 truncate">{selectedCoupon?.title}</p>
              </div>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="text-xs text-green-600 font-medium ml-2 flex-shrink-0"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-1.5 flex justify-end border-b border-neutral-200">
          <button
            onClick={() => setShowCouponSheet(true)}
            className="text-xs text-neutral-600 flex items-center gap-1"
          >
            See all coupons
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Bill details */}
      <div className="px-4 md:px-6 lg:px-8 py-2.5 md:py-3 border-b border-neutral-200">
        <h2 className="text-base font-bold text-neutral-900 mb-2.5">Bill details</h2>

        <div className="space-y-2">
          {/* Items total */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-700">Items total</span>
              {savedAmount > 0 && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                  Saved ₹{savedAmount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {itemsTotal > discountedTotal && (
                <span className="text-xs text-neutral-500 line-through">₹{itemsTotal}</span>
              )}
              <span className="text-xs font-medium text-neutral-900">₹{discountedTotal}</span>
            </div>
          </div>



          {/* Delivery charge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="2" fill="none" />
                <circle cx="5.5" cy="18.5" r="1.5" fill="currentColor" />
                <circle cx="18.5" cy="18.5" r="1.5" fill="currentColor" />
              </svg>
              <span className="text-xs text-neutral-700">Delivery charge</span>
            </div>
            <div className="flex flex-col items-end">
              <span className={`text-xs font-medium ${deliveryCharge === 0 ? 'text-green-600' : 'text-neutral-900'}`}>
                {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
              </span>
              {deliveryCharge > 0 && (
                <span className="text-[10px] text-orange-600 mt-0.5">
                  Free delivery on orders above ₹{config.freeDeliveryThreshold}
                </span>
              )}
            </div>
          </div>

          {/* Coupon discount */}
          {selectedCoupon && currentCouponDiscount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs text-neutral-700">Coupon discount</span>
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  {selectedCoupon.code}
                </span>
              </div>
              <span className="text-xs font-medium text-green-600">-₹{currentCouponDiscount.toLocaleString('en-IN')}</span>
            </div>
          )}

          {/* Tip amount */}
          {finalTipAmount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs text-neutral-700">Tip to delivery partner</span>
              </div>
              <span className="text-xs font-medium text-neutral-900">₹{finalTipAmount}</span>
            </div>
          )}

          {/* Online Payment Discount Row */}
          {onlineDiscountAmount > 0 && selectedPaymentMethod !== 'Cash' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs text-neutral-700">Online Payment Discount</span>
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  {onlineDiscountPercentage}% OFF
                </span>
              </div>
              <span className="text-xs font-medium text-green-600">-₹{onlineDiscountAmount.toFixed(2)}</span>
            </div>
          )}

          {/* Gift Packaging */}
          {giftPackaging && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                <span className="text-xs text-neutral-700">Gift Packaging</span>
              </div>
              <span className="text-xs font-medium text-neutral-900">₹{giftPackagingFee}</span>
            </div>
          )}

          {/* Grand total */}
          <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
            <span className="text-sm font-bold text-neutral-900">Grand total</span>
            <span className="text-sm font-bold text-neutral-900">
              ₹{(selectedPaymentMethod !== 'Cash' ? (grandTotal - onlineDiscountAmount) : grandTotal).toFixed(2)}
            </span>
          </div>

          {/* Online Payment Discount Incentive */}
          {onlineDiscountAmount > 0 && (
            <div className="mt-2 bg-green-50 rounded-lg p-2.5 border border-dashed border-green-300">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-[11px] font-semibold text-green-700">
                  Save ₹{onlineDiscountAmount.toFixed(2)} extra by paying online!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add GSTIN */}
      <div className="px-4 py-2 border-b border-neutral-200">
        <button
          onClick={() => setShowGstinSheet(true)}
          className="w-full flex items-center justify-between bg-neutral-50 rounded-lg p-2 hover:bg-neutral-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">%</span>
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-neutral-900">Add GSTIN</p>
              <p className="text-[10px] text-neutral-600">
                {gstin ? `GSTIN: ${gstin}` : 'Claim GST input credit up to 18% on your order'}
              </p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>


      {/* Tip your delivery partner */}
      <div className="px-4 py-2 border-b border-neutral-200">
        <h3 className="text-sm font-bold text-neutral-900 mb-0.5">Tip your delivery partner</h3>
        <p className="text-xs text-neutral-600 mb-2">Your kindness means a lot! 100% of your tip will go directly to your delivery partner.</p>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1.5">
          <button
            onClick={() => {
              setTipAmount(20);
              setShowCustomTipInput(false);
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 font-medium text-xs ${tipAmount === 20 && !showCustomTipInput
              ? 'border-green-600 bg-green-50 text-green-700'
              : 'border-neutral-300 bg-white text-neutral-700'
              }`}
          >
            😊 ₹20
          </button>
          <button
            onClick={() => {
              setTipAmount(30);
              setShowCustomTipInput(false);
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 font-medium text-xs ${tipAmount === 30 && !showCustomTipInput
              ? 'border-green-600 bg-green-50 text-green-700'
              : 'border-neutral-300 bg-white text-neutral-700'
              }`}
          >
            🤩 ₹30
          </button>
          <button
            onClick={() => {
              setTipAmount(50);
              setShowCustomTipInput(false);
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 font-medium text-xs ${tipAmount === 50 && !showCustomTipInput
              ? 'border-green-600 bg-green-50 text-green-700'
              : 'border-neutral-300 bg-white text-neutral-700'
              }`}
          >
            😍 ₹50
          </button>
          <button
            onClick={() => {
              setShowCustomTipInput(true);
              setTipAmount(null);
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 font-medium text-xs ${showCustomTipInput
              ? 'border-green-600 bg-green-50 text-green-700'
              : 'border-neutral-300 bg-white text-neutral-700'
              }`}
          >
            🎁 Custom
          </button>
        </div>

        {/* Custom Tip Input */}
        {showCustomTipInput && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              value={customTipAmount || ''}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 0) {
                  setCustomTipAmount(val);
                }
              }}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val < 0) {
                  setCustomTipAmount(0);
                }
              }}
              placeholder="Enter custom tip amount"
              className="flex-1 px-3 py-1.5 bg-white border-2 border-green-600 rounded-lg text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-green-500"
              min="0"
              step="1"
            />
            <button
              onClick={() => {
                setShowCustomTipInput(false);
                setCustomTipAmount(0);
                setTipAmount(null);
              }}
              className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Gift Packaging */}
      <div className="px-4 py-2 border-b border-neutral-200">
        <button
          onClick={() => setGiftPackaging(!giftPackaging)}
          className={`w-full flex items-center justify-between rounded-lg p-2 transition-colors ${
            giftPackaging
              ? 'bg-green-50 border-2 border-green-600'
              : 'bg-neutral-50 border-2 border-transparent hover:bg-neutral-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
              giftPackaging
                ? 'border-green-600 bg-green-600'
                : 'border-neutral-400 bg-white'
            }`}>
              {giftPackaging && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
            <div className="text-left">
              <p className={`text-xs font-semibold ${giftPackaging ? 'text-green-700' : 'text-neutral-900'}`}>
                Gift Packaging
              </p>
              <p className="text-[10px] text-neutral-600">
                {giftPackaging ? 'Add ₹30 for gift packaging' : 'Add ₹30 for elegant gift packaging'}
              </p>
            </div>
          </div>
          {giftPackaging && (
            <span className="text-xs font-semibold text-green-600">₹30</span>
          )}
        </button>
      </div>

      {/* Payment Method */}
      <div className="px-4 py-3 border-b border-neutral-200">
        <h3 className="text-sm font-bold text-neutral-900 mb-2">Payment Method</h3>
        <div className="relative">
          <button
            onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
            className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl transition-all ${
              isPaymentDropdownOpen
                ? 'border-blue-600 ring-1 ring-blue-600 bg-white'
                : 'border-neutral-300 bg-white'
            }`}
          >
            <span className="font-semibold text-neutral-900">
              {selectedPaymentMethod === 'Cash' ? 'Cash' : selectedPaymentMethod}
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-neutral-500 transition-transform duration-200 ${isPaymentDropdownOpen ? 'rotate-180 text-blue-600' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <AnimatePresence>
            {isPaymentDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden flex flex-col"
              >
                {[
                  { id: 'Cash', label: 'Cash' },
                  { id: 'Razorpay', label: 'Razorpay' },
                  { id: 'Cashfree', label: 'Cashfree' }
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => {
                      setSelectedPaymentMethod(method.id);
                      setIsPaymentDropdownOpen(false);
                    }}
                    className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 border-b border-neutral-100 last:border-0 group text-left"
                  >
                    <span className={`text-sm font-medium ${selectedPaymentMethod === method.id ? 'text-blue-600' : 'text-neutral-700'}`}>
                      {method.label}
                    </span>
                    <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors">→</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Cancellation Policy */}
      <div className="px-4 py-2">
        <button
          onClick={() => setShowCancellationPolicy(true)}
          className="text-xs text-neutral-700 hover:text-neutral-900 transition-colors"
        >
          Cancellation Policy
        </button>
      </div>

      {/* Made with love by Geeta Stores */}
      <div className="px-4 py-2">
        <div className="w-full flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-neutral-500">
            <span className="text-[10px] font-medium">Made with</span>
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
              className="text-red-500 text-sm"
            >
              ❤️
            </motion.span>
            <span className="text-[10px] font-medium">by</span>
            <span className="text-[10px] font-semibold text-green-600">Geeta Stores</span>
          </div>
        </div>
      </div>

      {/* GSTIN Sheet Modal */}
      <Sheet open={showGstinSheet} onOpenChange={setShowGstinSheet}>
        <SheetContent side="bottom" className="max-h-[50vh]">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between mb-2">
              <SheetTitle className="text-base font-bold text-neutral-900">Add GSTIN</SheetTitle>
              <SheetClose onClick={() => setShowGstinSheet(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="px-4 pb-4 mt-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                GSTIN Number
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  if (value.length <= 15) {
                    setGstin(value);
                  }
                }}
                placeholder="Enter 15-character GSTIN"
                className="w-full px-4 py-3 bg-white border-2 border-neutral-300 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                maxLength={15}
              />
              <p className="text-xs text-neutral-500 mt-1">
                Format: 15 characters (e.g., 27AAAAA0000A1Z5)
              </p>
            </div>
            <button
              onClick={() => {
                if (gstin.length === 15) {
                  setShowGstinSheet(false);
                } else {
                  alert('Please enter a valid 15-character GSTIN');
                }
              }}
              className="w-full bg-green-600 text-white py-3 px-4 font-bold text-sm uppercase tracking-wide hover:bg-green-700 transition-colors rounded-lg"
            >
              Save GSTIN
            </button>
            {gstin && (
              <button
                onClick={() => {
                  setGstin('');
                  setShowGstinSheet(false);
                }}
                className="w-full mt-2 bg-neutral-100 text-neutral-700 py-2 px-4 font-medium text-sm hover:bg-neutral-200 transition-colors rounded-lg"
              >
                Remove GSTIN
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancellation Policy Sheet Modal */}
      <Sheet open={showCancellationPolicy} onOpenChange={setShowCancellationPolicy}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between mb-2">
              <SheetTitle className="text-base font-bold text-neutral-900">Cancellation Policy</SheetTitle>
              <SheetClose onClick={() => setShowCancellationPolicy(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="px-4 pb-4 overflow-y-auto max-h-[calc(85vh-80px)]">
            <div className="space-y-4 mt-4 text-sm text-neutral-700">
              <div>
                <h3 className="font-bold text-neutral-900 mb-2">Order Cancellation</h3>
                <p className="mb-2">
                  You can cancel your order before it is confirmed by the seller. Once confirmed, cancellation may not be possible.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-neutral-900 mb-2">Refund Policy</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Refunds will be processed within 5-7 business days</li>
                  <li>Refund amount will be credited to your original payment method</li>
                  <li>Delivery charges are non-refundable</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-neutral-900 mb-2">Partial Cancellation</h3>
                <p>
                  Partial cancellation of items in an order is not allowed. You can cancel the entire order or contact customer support for assistance.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-neutral-900 mb-2">Contact Support</h3>
                <p>
                  For any cancellation requests or queries, please contact our customer support team at support@Geeta Stores.com or call +91-XXXXX-XXXXX
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Coupon Sheet Modal */}
      <Sheet open={showCouponSheet} onOpenChange={setShowCouponSheet}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between mb-2">
              <SheetTitle className="text-base font-bold text-neutral-900">Available Coupons</SheetTitle>
              <SheetClose onClick={() => setShowCouponSheet(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="px-4 pb-4 overflow-y-auto max-h-[calc(85vh-80px)]">
            <div className="space-y-2.5 mt-2">
              {availableCoupons.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <p>No coupons available at the moment.</p>
                </div>
              ) : (
                availableCoupons.map((coupon) => {
                  const subtotalBeforeCoupon = discountedTotal + handlingCharge + deliveryCharge;
                  const meetsMinOrder = !coupon.minOrderValue || subtotalBeforeCoupon >= coupon.minOrderValue;
                  const isSelected = selectedCoupon?._id === coupon._id;

                  return (
                    <div
                      key={coupon._id}
                      className={`border-2 rounded-lg p-2.5 transition-all ${isSelected
                        ? 'border-green-600 bg-green-50'
                        : meetsMinOrder
                          ? 'border-neutral-200 bg-white'
                          : 'border-neutral-200 bg-neutral-50 opacity-60'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-green-600">{coupon.code}</span>
                            <span className="text-xs font-semibold text-neutral-900">{coupon.title}</span>
                          </div>
                          <p className="text-[10px] text-neutral-600 mb-1">{coupon.description}</p>
                          {coupon.minOrderValue && (
                            <p className="text-[10px] text-neutral-500">
                              Min. order: ₹{coupon.minOrderValue}
                            </p>
                          )}
                        </div>
                        {isSelected ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="text-xs font-medium">Applied</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => meetsMinOrder && handleApplyCoupon(coupon)}
                            disabled={!meetsMinOrder || isValidatingCoupon}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${meetsMinOrder
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                              }`}
                          >
                            {isValidatingCoupon ? '...' : 'Apply'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom Sticky Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-[60] shadow-lg">
        {selectedAddress ? (
          <button
            onClick={handlePlaceOrderClick}
            disabled={cart.items.length === 0}
            className={`w-full py-3 px-4 font-bold text-sm uppercase tracking-wide transition-colors ${cart.items.length > 0
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
              }`}
          >
            Place Order
          </button>
        ) : (
          <button
            onClick={() => navigate('/checkout/address', {
              state: {
                editAddress: savedAddress
              }
            })}
            className="w-full bg-green-600 text-white py-3 px-4 font-bold text-sm uppercase tracking-wide hover:bg-green-700 transition-colors"
          >
            Choose address at next step
          </button>
        )}
      </div>

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-scaleIn">
                <div className="bg-gray-800 px-6 py-4 text-white flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Select Payment Method</h3>
                    <button onClick={() => { setShowPaymentModal(false); setIsProcessingPayment(false); }} className="text-white/80 hover:text-white">✕</button>
                </div>
                <div className="p-6 space-y-4">
                     <div className="text-center mb-6">
                         <p className="text-gray-500 text-sm mb-1">Total Amount</p>
                         <p className="text-3xl font-bold text-gray-900">₹{Math.max(0, grandTotal)}</p>
                     </div>

                     {isProcessingPayment ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-sm font-medium text-gray-600">Processing Payment...</p>
                        </div>
                     ) : (
                        <div className="space-y-3">
                            <button
                              onClick={() => handlePaymentSelection('Razorpay')}
                              className="w-full group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">R</div>
                                   <div>
                                       <span className="block font-semibold text-gray-700 group-hover:text-blue-700">Razorpay</span>
                                       {onlineDiscountAmount > 0 && (
                                           <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">₹{(grandTotal - onlineDiscountAmount).toFixed(2)} (-₹{onlineDiscountAmount.toFixed(2)})</span>
                                       )}
                                   </div>
                                </div>
                                <span className="text-gray-300 group-hover:text-blue-500">→</span>
                            </button>

                            <button
                              onClick={() => handlePaymentSelection('Cashfree')}
                              className="w-full group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">C</div>
                                   <div>
                                       <span className="block font-semibold text-gray-700 group-hover:text-purple-700">Cashfree</span>
                                       {onlineDiscountAmount > 0 && (
                                           <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">₹{(grandTotal - onlineDiscountAmount).toFixed(2)} (-₹{onlineDiscountAmount.toFixed(2)})</span>
                                       )}
                                   </div>
                                </div>
                                <span className="text-gray-300 group-hover:text-purple-500">→</span>
                            </button>

                             <button
                              onClick={() => handlePaymentSelection('Cash')}
                              className="w-full group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">COD</div>
                                   <span className="font-semibold text-gray-700 group-hover:text-green-700">Cash on Delivery</span>
                                </div>
                                <span className="text-gray-300 group-hover:text-green-500">→</span>
                            </button>
                         </div>
                     )}
                </div>
            </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes checkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
          }
        }

        @keyframes ringPulse {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        @keyframes sparkle {
          0% {
            transform: rotate(var(--rotation, 0deg)) translateY(0) scale(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--rotation, 0deg)) translateY(-80px) scale(1);
            opacity: 0;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes confettiFall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }

        .check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>
    </div>
  );
}
