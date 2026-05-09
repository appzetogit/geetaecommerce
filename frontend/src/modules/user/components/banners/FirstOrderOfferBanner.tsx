import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../../../../context/AppContext";
import { useAuth } from "../../../../context/AuthContext";

const SEEN_STORAGE_KEY = "first_order_offer_user_seen_v2";

type SeenState = {
  offerUpdatedAt: string | null;
  seenAt: string;
};

export default function FirstOrderOfferBanner() {
  const { config } = useAppContext();
  const { user, isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  const offer = config?.firstOrderOffer;

  useEffect(() => {
    // 1. Basic checks: is the offer enabled?
    if (!offer || !offer.enabled) {
      setIsVisible(false);
      return;
    }

    // 2. Strict check: Is this a first-time user?
    // If logged in, we check the order count.
    // If not logged in, we assume they are a potential first-time user.
    if (isAuthenticated && user && Number(user.totalOrders || 0) > 0) {
      setIsVisible(false);
      return;
    }

    // 3. Persistence check: Has the user already seen/dismissed this version?
    const rawSeen = localStorage.getItem(SEEN_STORAGE_KEY);
    const offerUpdatedAt = offer.updatedAt ? String(offer.updatedAt) : null;

    if (rawSeen) {
      try {
        const seenState: SeenState = JSON.parse(rawSeen);
        if (seenState.offerUpdatedAt === offerUpdatedAt) {
          setIsVisible(false);
          return;
        }
      } catch (e) {
        console.error("Failed to parse seen state", e);
      }
    }

    setIsVisible(true);
  }, [offer, user, isAuthenticated]);

  const view = useMemo(() => {
    return {
      discountAmount: Number(offer?.discountAmount ?? 0),
      title: (offer?.title || "On your first order").trim(),
      subtitle: (offer?.subtitle || "OFF").trim(),
      ctaText: (offer?.ctaText || "Claim").trim(),
      minOrderAmount: Number(offer?.minOrderAmount ?? 0),
    };
  }, [offer]);

  if (!isVisible || !offer) return null;

  const markAsSeen = () => {
    const offerUpdatedAt = offer.updatedAt ? String(offer.updatedAt) : null;
    const seenPayload: SeenState = { 
      offerUpdatedAt, 
      seenAt: new Date().toISOString() 
    };
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seenPayload));
    setIsVisible(false);
  };

  const handleClose = () => {
    markAsSeen();
  };

  const handleCta = () => {
    // In a real flow, this might navigate to a specific collection or apply a coupon
    markAsSeen();
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-7 w-7 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[11px] text-emerald-900 truncate">{view.title}</div>
            <div className="text-base font-extrabold text-emerald-900">
              ₹{view.discountAmount} <span className="text-[11px] font-semibold">{view.subtitle}</span>
            </div>
            {view.minOrderAmount > 0 && (
              <div className="text-[10px] text-emerald-800">Min order ₹{view.minOrderAmount}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCta}
            className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-sm font-semibold"
          >
            {view.ctaText}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-emerald-100 text-emerald-900"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
