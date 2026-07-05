import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import Button from '../../components/ui/button';
import { appConfig } from '../../services/configService';
import { calculateProductPrice, getCartItemVariantSelector, getCartLineUnitPrice } from '../../utils/priceUtils';

export default function Cart() {
  const { cart, updateQuantity, removeFromCart, clearCart, freeGiftRules: activeRules, loading } = useCart();
  const navigate = useNavigate();


  const deliveryFee = (cart.total || 0) >= (appConfig.freeDeliveryThreshold || 500) ? 0 : (appConfig.deliveryFee || 40);
  const platformFee = appConfig.platformFee || 0;
  const totalAmount = (cart.total || 0) + deliveryFee + platformFee;

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
              className="text-sm md:text-base text-[var(--customer-primary-dark)] font-medium hover:text-red-700 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        <p className="text-xs md:text-sm text-neutral-600">Delivered in {appConfig.estimatedDeliveryTime}</p>

        {/* Free Gift Progress Bar (Multi-Tier) */}
        {(() => {
            if (activeRules.length === 0) return null;

            const currentTotal = cart.total || 0;
            if (activeRules.length === 0) return null;
            const highestRule = activeRules[activeRules.length - 1];
            const maxTarget = highestRule.minCartValue || 1000;

            // Find next milestone
            const nextRule = activeRules.find(r => r.minCartValue > currentTotal);

            return (
              <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                 {nextRule ? (
                     <div className="text-center mb-4 text-sm text-gray-700">
                         Add <span className="font-bold text-[var(--customer-primary-dark)]">₹{(nextRule.minCartValue - currentTotal).toLocaleString('en-IN')}</span> more to unlock <span className="font-bold">{nextRule.giftProduct?.productName || 'Gift'}</span> 🎁
                     </div>
                 ) : (
                     <div className="text-[var(--customer-primary-dark)] font-medium text-center mb-4 flex items-center justify-center gap-2">
                         <span className="text-lg">🎉</span> All Free Gifts Unlocked!
                     </div>
                 )}

                 {/* Milestone Bar Container */}
                 <div className="relative h-12 mb-2 px-2">
                     {/* Background Line */}
                     <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-gray-100 rounded-full -translate-y-1/2 z-0"></div>

                     {/* Progress Line */}
                     <div
                        className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-[var(--customer-primary-light)] to-[var(--customer-primary)] rounded-full -translate-y-1/2 z-0 transition-all duration-700 ease-out"
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
                                 <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white transition-all duration-300 ${isUnlocked ? 'border-[var(--customer-primary)] text-[var(--customer-primary)] shadow-md scale-110' : 'border-gray-300 text-gray-300'}`}>
                                     {isUnlocked ? (
                                         <span className="text-sm font-bold">✓</span>
                                     ) : (
                                         <span className="text-[10px]">🎁</span>
                                     )}
                                 </div>

                                 {/* Label */}
                                 <div className="absolute top-9 w-24 text-center">
                                     <span className={`text-[10px] font-bold block ${isUnlocked ? 'text-[var(--customer-primary-dark)]' : 'text-gray-400'}`}>
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
          const prod = item.product;
          if (!prod) return null;

          const qty = item.quantity ?? 0;
          const variantSelector = getCartItemVariantSelector(item);
          const applicableUnitPrice = getCartLineUnitPrice(item);
          const { displayPrice, mrp, hasDiscount } = calculateProductPrice(prod, variantSelector);
          const isTieredApplied = applicableUnitPrice < displayPrice;
          const isFreeGift = item.isFreeGift;

          const prodId = prod.id || prod._id || '';
          const lineKey = item.id || `${prodId}-${item.variantId || item.variation || item.variant || 'default'}`;

          return (
            <div
              key={lineKey}
              className="bg-white rounded-lg border border-neutral-200 p-4 md:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 md:gap-6">
                {/* Product Image */}
                <div className="w-20 h-20 md:w-24 md:h-24 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-2xl text-neutral-400">
                      {(prod.name || 'P').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-neutral-900 mb-1 md:mb-2 line-clamp-2 md:text-lg">
                    {prod.name}
                  </h3>
                  <div className="text-sm text-neutral-500 mb-2 md:mb-3">
                    {item.variation || item.variant ? `Variant: ${item.variation || item.variant}` : (prod.pack || '')}
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900 text-base md:text-lg">
                          ₹{applicableUnitPrice.toLocaleString('en-IN')}
                        </span>
                        {mrp > applicableUnitPrice && (
                          <span className="text-xs md:text-sm text-neutral-400 line-through">
                            ₹{mrp.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      {hasDiscount && (
                        <span className="text-xs text-[var(--customer-primary-dark)] font-medium">
                          {Math.round(((mrp - applicableUnitPrice) / mrp) * 100)}% OFF
                        </span>
                      )}
                      {isTieredApplied && (
                         <span className="text-[10px] text-[var(--customer-primary-dark)] font-medium bg-[var(--customer-primary-alpha-10)] px-1.5 py-0.5 rounded">
                           Bulk Price Applied
                         </span>
                      )}
                    </div>

                    {!isFreeGift ? (
                    <div className="flex items-center gap-3 bg-neutral-100 rounded-lg p-1">
                      <button
                        onClick={() => {
                           const vId = item.variantId || (prod as any).variantId || (prod as any).selectedVariant?._id || item.variant;
                           const vTitle = item.variation || (prod as any).variantTitle || (prod as any).pack;
                           updateQuantity(prodId, qty - 1, vId, vTitle);
                        }}
                        className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-neutral-600 hover:text-[var(--customer-primary)] disabled:opacity-50 transition-colors"
                        disabled={loading}
                      >
                        -
                      </button>
                      <span className="w-6 md:w-8 text-center font-medium text-sm md:text-base">{qty}</span>
                      <button
                        onClick={() => {
                           const vId = item.variantId || (prod as any).variantId || (prod as any).selectedVariant?._id || item.variant;
                           const vTitle = item.variation || (prod as any).variantTitle || (prod as any).pack;
                           updateQuantity(prodId, qty + 1, vId, vTitle);
                        }}
                        className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-neutral-600 hover:text-[var(--customer-primary-dark)] disabled:opacity-50 transition-colors"
                        disabled={loading}
                      >
                        +
                      </button>
                    </div>
                    ) : (
                        <div className="text-xs font-bold text-[var(--customer-primary-dark)] bg-[var(--customer-primary-alpha-10)] px-2 py-1 rounded">
                            FREE GIFT
                        </div>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                {!isFreeGift && (
                <button
                  onClick={() => removeFromCart(prodId)}
                  className="text-neutral-400 hover:text-[var(--customer-primary)] p-1 md:p-2 transition-colors self-start"
                  disabled={loading}
                  aria-label="Remove item"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
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
              <span className="font-medium">₹{(cart.total || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>Platform Fee</span>
              <span className="font-medium">₹{(platformFee || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>Delivery Charges</span>
              <span className={`font-medium ${deliveryFee === 0 ? 'text-[var(--customer-primary-dark)]' : ''}`}>
                {deliveryFee === 0 ? 'Free' : `₹${deliveryFee.toLocaleString('en-IN')}`}
              </span>
            </div>
            {(cart.total || 0) < (appConfig.freeDeliveryThreshold || 500) && (
              <div className="text-xs md:text-sm text-[var(--customer-primary-dark)] bg-[var(--customer-primary-alpha-10)] px-2 py-1 rounded">
                Add ₹{((appConfig.freeDeliveryThreshold || 500) - (cart.total || 0)).toLocaleString('en-IN')} more for free delivery
              </div>
            )}
          </div>
          <div className="border-t border-neutral-200 pt-4 md:pt-6">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <span className="text-lg md:text-xl font-bold text-neutral-900">Total</span>
              <span className="text-xl md:text-2xl font-bold text-neutral-900">
                ₹{(totalAmount || 0).toLocaleString('en-IN')}
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

