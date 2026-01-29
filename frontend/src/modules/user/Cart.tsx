import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import Button from '../../components/ui/button';
import { appConfig } from '../../services/configService';
import { calculateProductPrice, getApplicableUnitPrice } from '../../utils/priceUtils';

export default function Cart() {
  const { cart, updateQuantity, removeFromCart, clearCart, freeGiftRules: activeRules } = useCart();
  const navigate = useNavigate();


  const deliveryFee = cart.total >= appConfig.freeDeliveryThreshold ? 0 : appConfig.deliveryFee;
  const platformFee = appConfig.platformFee;
  const totalAmount = cart.total + deliveryFee + platformFee;

  const handleCheckout = () => {
    navigate('/checkout');
  };

  if (cart.items.length === 0) {
    return (
      <div className="px-4 py-8 md:py-16 text-center">
        <div className="text-6xl md:text-8xl mb-4">🛒</div>
        <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mb-2">Your cart is empty</h2>
        <p className="text-neutral-600 mb-6 md:mb-8 md:text-lg">Add some items to get started!</p>
        <Link to="/">
          <Button variant="default" size="lg" className="md:px-8 md:py-3 md:text-lg">
            Start Shopping
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-4 md:pb-8">
      {/* Header */}
      <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 bg-white border-b border-neutral-200 mb-4 md:mb-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl md:text-2xl font-bold text-neutral-900">Your Basket 🛍️</h1>
          {cart.items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-sm md:text-base text-red-600 font-medium hover:text-red-700 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        <p className="text-xs md:text-sm text-neutral-600">Delivered in {appConfig.estimatedDeliveryTime}</p>

        {/* Free Gift Progress Bar (Multi-Tier) */}
        {(() => {
            if (activeRules.length === 0) return null;

            const currentTotal = cart.total;
            const highestRule = activeRules[activeRules.length - 1];
            const maxTarget = highestRule.minCartValue;

            // Find next milestone
            const nextRule = activeRules.find(r => r.minCartValue > currentTotal);

            return (
              <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                 {nextRule ? (
                     <div className="text-center mb-4 text-sm text-gray-700">
                         Add <span className="font-bold text-teal-700">₹{(nextRule.minCartValue - currentTotal).toLocaleString('en-IN')}</span> more to unlock <span className="font-bold">{nextRule.giftProduct?.productName || 'Gift'}</span> 🎁
                     </div>
                 ) : (
                     <div className="text-green-600 font-medium text-center mb-4 flex items-center justify-center gap-2">
                         <span className="text-lg">🎉</span> All Free Gifts Unlocked!
                     </div>
                 )}

                 {/* Milestone Bar Container */}
                 <div className="relative h-12 mb-2 px-2">
                     {/* Background Line */}
                     <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-gray-100 rounded-full -translate-y-1/2 z-0"></div>

                     {/* Progress Line */}
                     <div
                        className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-teal-400 to-green-500 rounded-full -translate-y-1/2 z-0 transition-all duration-700 ease-out"
                        style={{ width: `${Math.min(100, (currentTotal / maxTarget) * 100)}%` }}
                     ></div>

                     {/* Milestones */}
                     {activeRules.map((rule, idx) => {
                         const isUnlocked = currentTotal >= rule.minCartValue;
                         const position = (rule.minCartValue / maxTarget) * 100;

                         return (
                             <div
                                key={rule._id || rule.id}
                                className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center group z-10"
                                style={{ left: `${position}%`, transform: `translate(-${position === 100 ? '100' : '50'}%, -50%)` }}
                             >
                                 {/* Icon Circle */}
                                 <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white transition-all duration-300 ${isUnlocked ? 'border-green-500 text-green-500 shadow-md scale-110' : 'border-gray-300 text-gray-300'}`}>
                                     {isUnlocked ? (
                                         <span className="text-sm font-bold">✓</span>
                                     ) : (
                                         <span className="text-[10px]">🎁</span>
                                     )}
                                 </div>

                                 {/* Label */}
                                 <div className="absolute top-9 w-24 text-center">
                                     <span className={`text-[10px] font-bold block ${isUnlocked ? 'text-green-600' : 'text-gray-400'}`}>
                                         {isUnlocked ? 'Unlocked' : `₹${rule.minCartValue}`}
                                     </span>
                                     <span className="text-[9px] text-gray-500 leading-tight block truncate mx-auto max-w-full">
                                         {rule.giftProduct?.productName?.split(' ')[0]}...
                                     </span>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
              </div>
            );
        })()}
      </div>

      {/* Cart Items */}
      <div className="px-4 md:px-6 lg:px-8 space-y-4 md:space-y-6 mb-4 md:mb-6">
        {cart.items.map((item) => {
          const { displayPrice, mrp, hasDiscount } = calculateProductPrice(item.product, item.variant);
          const applicableUnitPrice = getApplicableUnitPrice(item.product, item.variant, item.quantity || 1);
          const isTieredApplied = applicableUnitPrice < displayPrice;
          const isFreeGift = item.isFreeGift;

          return (
            <div
              key={item.product.id}
              className="bg-white rounded-lg border border-neutral-200 p-4 md:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 md:gap-6">
                {/* Product Image */}
                <div className="w-20 h-20 md:w-24 md:h-24 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {item.product.imageUrl ? (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-2xl text-neutral-400">
                      {item.product.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-neutral-900 mb-1 md:mb-2 line-clamp-2 md:text-lg">
                    {item.product.name}
                  </h3>
                  <p className="text-xs md:text-sm text-neutral-500 mb-2">{item.product.pack}</p>
                  <div className="flex items-center gap-2 mb-3 md:mb-4">
                    <span className="text-base md:text-lg font-bold text-neutral-900">
                      ₹{applicableUnitPrice.toLocaleString('en-IN')}
                    </span>
                    {(hasDiscount || isTieredApplied) && (
                      <span className="text-xs md:text-sm text-neutral-500 line-through">
                        ₹{mrp > displayPrice ? mrp.toLocaleString('en-IN') : displayPrice.toLocaleString('en-IN')}
                      </span>
                    )}
                    {isTieredApplied && (
                         <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                           Bulk Price
                         </span>
                    )}
                  </div>

                  {/* Quantity Controls */}
                  {isFreeGift ? (
                      <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                              Qty: 1 (Free Gift) 🎁
                          </span>
                      </div>
                  ) : (
                  <div className="flex items-center gap-3 md:gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variant, item.product.pack)}
                      className="w-8 h-8 md:w-10 md:h-10 p-0 border-neutral-300 text-neutral-600 hover:border-green-600 hover:text-green-600 md:text-lg"
                    >
                      −
                    </Button>
                    <span className="text-base md:text-lg font-semibold text-neutral-900 min-w-[2rem] md:min-w-[2.5rem] text-center">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant, item.product.pack)}
                      className="w-8 h-8 md:w-10 md:h-10 p-0 border-neutral-300 text-neutral-600 hover:border-green-600 hover:text-green-600 md:text-lg"
                    >
                      +
                    </Button>
                    <div className="ml-auto text-right">
                      <div className="text-sm md:text-base font-bold text-neutral-900">
                        ₹{(applicableUnitPrice * item.quantity).toFixed(0)}
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* Remove Button */}
                {!isFreeGift && (
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-neutral-400 hover:text-red-600 transition-colors self-start"
                  aria-label="Remove item"
                >
                  ✕
                </button>
                )}
                {isFreeGift && (
                    <div className="self-start text-green-500" title="Cannot remove free gift">
                        🔒
                    </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Summary */}
      <div className="px-4 md:px-6 lg:px-8 mb-24 md:mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-4 md:p-6 shadow-sm md:max-w-md md:ml-auto">
          <h2 className="text-lg md:text-xl font-bold text-neutral-900 mb-4 md:mb-6">Order Summary</h2>
          <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>Subtotal</span>
              <span className="font-medium">₹{cart.total.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>Platform Fee</span>
              <span className="font-medium">₹{platformFee.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>Delivery Charges</span>
              <span className={`font-medium ${deliveryFee === 0 ? 'text-green-600' : ''}`}>
                {deliveryFee === 0 ? 'Free' : `₹${deliveryFee.toLocaleString('en-IN')}`}
              </span>
            </div>
            {cart.total < appConfig.freeDeliveryThreshold && (
              <div className="text-xs md:text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                Add ₹{(appConfig.freeDeliveryThreshold - cart.total).toLocaleString('en-IN')} more for free delivery
              </div>
            )}
          </div>
          <div className="border-t border-neutral-200 pt-4 md:pt-6">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <span className="text-lg md:text-xl font-bold text-neutral-900">Total</span>
              <span className="text-xl md:text-2xl font-bold text-neutral-900">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <Button
              variant="default"
              size="lg"
              onClick={handleCheckout}
              className="w-full md:py-3 md:text-lg"
            >
              Proceed to Checkout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

