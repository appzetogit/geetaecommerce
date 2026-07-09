import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../../../context/AppContext";
import { useAuth } from "../../../../context/AuthContext";

const SEEN_STORAGE_KEY = "first_order_offer_user_seen_v2";

type SeenState = {
  offerUpdatedAt: string | null;
  seenAt: string;
};

export default function FirstOrderOfferBanner() {
  const navigate = useNavigate();
  const { config } = useAppContext();
  const { user, isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  const offer = config?.firstOrderOffer;

  useEffect(() => {
    if (!offer || !offer.enabled) {
      setIsVisible(false);
      return;
    }

    if (isAuthenticated && user && Number(user.totalOrders || 0) > 0) {
      setIsVisible(false);
      return;
    }

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
      seenAt: new Date().toISOString(),
    };
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seenPayload));
    setIsVisible(false);
  };

  const handleClose = () => {
    markAsSeen();
  };

  const handleCta = () => {
    navigate('/checkout');
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-3">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl"
        style={{
          background:
            "linear-gradient(145deg, #f0fdf9 0%, #d1fae5 38%, #a7f3d0 72%, #6ee7b7 100%)",
          boxShadow:
            "0 10px 28px rgba(5, 150, 105, 0.22), 0 4px 10px rgba(16, 185, 129, 0.14), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -3px 8px rgba(5, 150, 105, 0.08)",
          border: "1px solid rgba(110, 231, 183, 0.55)",
        }}
      >
        {/* Gloss + depth overlays */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/55 via-white/10 to-emerald-900/5" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-300/25 blur-2xl" />
        <div className="pointer-events-none absolute -left-6 -bottom-8 h-20 w-20 rounded-full bg-white/35 blur-xl" />

        {/* Subtle confetti dots */}
        <div className="pointer-events-none absolute right-24 top-3 h-1.5 w-1.5 rounded-full bg-white/70 shadow-sm" />
        <div className="pointer-events-none absolute right-32 top-7 h-1 w-1 rounded-full bg-emerald-700/20" />
        <div className="pointer-events-none absolute left-[42%] top-2 h-1 w-1 rounded-full bg-white/60" />

        <div className="relative flex items-center justify-between gap-3 px-3.5 py-3 md:px-4 md:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {/* 3D badge icon */}
            <div
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(145deg, #34d399 0%, #059669 55%, #047857 100%)",
                boxShadow:
                  "0 6px 16px rgba(5, 150, 105, 0.42), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 5px rgba(0,0,0,0.12)",
              }}
            >
              <div className="absolute inset-[2px] rounded-[14px] bg-gradient-to-b from-white/20 to-transparent" />
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative z-10 drop-shadow-sm"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <div className="min-w-0 leading-tight">
              <div className="truncate text-[11px] font-semibold tracking-wide text-emerald-900/80">
                {view.title}
              </div>
              <div
                className="text-[1.35rem] font-black leading-none text-emerald-950"
                style={{
                  textShadow: "0 1px 0 rgba(255,255,255,0.65), 0 2px 8px rgba(5,150,105,0.15)",
                }}
              >
                ₹{view.discountAmount}{" "}
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  {view.subtitle}
                </span>
              </div>
              {view.minOrderAmount > 0 && (
                <div className="mt-0.5 inline-flex items-center rounded-full bg-white/45 px-2 py-0.5 text-[10px] font-semibold text-emerald-900/75 shadow-sm backdrop-blur-sm">
                  Min order ₹{view.minOrderAmount}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <motion.button
              type="button"
              onClick={handleCta}
              whileTap={{ scale: 0.96 }}
              className="rounded-full px-4 py-2 text-sm font-bold text-white transition-shadow"
              style={{
                background: "linear-gradient(180deg, #10b981 0%, #047857 100%)",
                boxShadow:
                  "0 5px 14px rgba(5, 150, 105, 0.45), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 4px rgba(0,0,0,0.1)",
              }}
            >
              {view.ctaText}
            </motion.button>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-900/70 transition-colors hover:bg-white/50 hover:text-emerald-950"
              style={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
              }}
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
