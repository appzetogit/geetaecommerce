import { useEffect, useMemo, useState } from "react";

type FirstOrderOfferConfig = {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  discountAmount?: number;
  minOrderAmount?: number;
  ctaText?: string;
};

const OFFER_STORAGE_KEY = "first_order_offer_v1";
const SEEN_STORAGE_KEY = "first_order_offer_user_seen_v1";

type SeenState =
  | { kind: "wildcard" }
  | { kind: "offer"; offerUpdatedAt: string | null; seenAt: string };

const parseSeenState = (raw: string | null): SeenState | null => {
  if (!raw) return null;
  if (raw === "1") return { kind: "wildcard" }; // legacy: hide always
  try {
    const parsed = JSON.parse(raw) as Partial<SeenState>;
    if (parsed && (parsed as any).kind === "offer") {
      const offerUpdatedAt = (parsed as any).offerUpdatedAt ?? null;
      const seenAt = (parsed as any).seenAt;
      if (typeof seenAt === "string") {
        return { kind: "offer", offerUpdatedAt: typeof offerUpdatedAt === "string" ? offerUpdatedAt : null, seenAt };
      }
    }
    return { kind: "wildcard" };
  } catch {
    return { kind: "wildcard" };
  }
};

const migrateToEnglishIfHindiDefaults = (cfg: FirstOrderOfferConfig) => {
  const title = (cfg.title ?? "").trim();
  const subtitle = (cfg.subtitle ?? "").trim();
  const ctaText = (cfg.ctaText ?? "").trim();

  const migrated: FirstOrderOfferConfig = { ...cfg };
  let changed = false;

  if (title === "पहले ऑर्डर पर") {
    migrated.title = "On your first order";
    changed = true;
  }
  if (subtitle === "की छूट") {
    migrated.subtitle = "OFF";
    changed = true;
  }
  if (ctaText === "लूट लो") {
    migrated.ctaText = "Claim";
    changed = true;
  }

  return { migrated, changed };
};

export default function FirstOrderOfferBanner() {
  const [config, setConfig] = useState<FirstOrderOfferConfig | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const loadOffer = () => {
    const seenState = parseSeenState(localStorage.getItem(SEEN_STORAGE_KEY));
    if (seenState?.kind === "wildcard") {
      setIsVisible(false);
      setConfig(null);
      return;
    }

    const raw = localStorage.getItem(OFFER_STORAGE_KEY);
    if (!raw) {
      setIsVisible(false);
      setConfig(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as FirstOrderOfferConfig;
      if (!parsed?.enabled) {
        setIsVisible(false);
        setConfig(null);
        return;
      }
      const { migrated, changed } = migrateToEnglishIfHindiDefaults(parsed);
      if (changed) {
        localStorage.setItem(OFFER_STORAGE_KEY, JSON.stringify(migrated));
      }

      const offerUpdatedAt = typeof migrated?.updatedAt === "string" ? migrated.updatedAt : null;
      if (seenState?.kind === "offer" && seenState.offerUpdatedAt === offerUpdatedAt) {
        setIsVisible(false);
        setConfig(null);
        return;
      }

      setConfig(migrated);
      setIsVisible(true);
    } catch (e) {
      console.error("Failed to parse first order offer config", e);
      setIsVisible(false);
      setConfig(null);
    }
  };

  useEffect(() => {
    loadOffer();

    const onStorage = (e: StorageEvent) => {
      if (e.key !== OFFER_STORAGE_KEY && e.key !== SEEN_STORAGE_KEY) return;
      loadOffer();
    };
    const onOfferChanged = () => loadOffer();

    window.addEventListener("storage", onStorage);
    window.addEventListener("first_order_offer_changed", onOfferChanged as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("first_order_offer_changed", onOfferChanged as EventListener);
    };
  }, []);

  const view = useMemo(() => {
    const discountAmount = Number(config?.discountAmount ?? 0);
    const title = (config?.title || "On your first order").trim();
    const subtitle = (config?.subtitle || "OFF").trim();
    const ctaText = (config?.ctaText || "Claim").trim();
    const minOrderAmount = Number(config?.minOrderAmount ?? 0);
    return { discountAmount, title, subtitle, ctaText, minOrderAmount };
  }, [config]);

  if (!isVisible || !config) return null;

  const handleClose = () => {
    const offerUpdatedAt = typeof config?.updatedAt === "string" ? config.updatedAt : null;
    const seenPayload: SeenState = { kind: "offer", offerUpdatedAt, seenAt: new Date().toISOString() };
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seenPayload));
    setIsVisible(false);
  };

  const handleCta = () => {
    const offerUpdatedAt = typeof config?.updatedAt === "string" ? config.updatedAt : null;
    const seenPayload: SeenState = { kind: "offer", offerUpdatedAt, seenAt: new Date().toISOString() };
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seenPayload));
    setIsVisible(false);
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
