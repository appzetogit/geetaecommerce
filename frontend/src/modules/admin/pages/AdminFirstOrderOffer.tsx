import { useEffect, useMemo, useState } from "react";

type FirstOrderOfferConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
  discountAmount: number;
  minOrderAmount: number;
  ctaText: string;
  updatedAt?: string;
};

const STORAGE_KEY = "first_order_offer_v1";

const migrateToEnglishIfHindiDefaults = (cfg: Partial<FirstOrderOfferConfig>) => {
  const title = (cfg.title ?? "").trim();
  const subtitle = (cfg.subtitle ?? "").trim();
  const ctaText = (cfg.ctaText ?? "").trim();

  const migrated: Partial<FirstOrderOfferConfig> = { ...cfg };
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

const defaultConfig: FirstOrderOfferConfig = {
  enabled: false,
  title: "On your first order",
  subtitle: "OFF",
  discountAmount: 60,
  minOrderAmount: 0,
  ctaText: "Claim",
};

export default function AdminFirstOrderOffer() {
  const [config, setConfig] = useState<FirstOrderOfferConfig>(defaultConfig);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(true);

  const notifyOfferChanged = () => {
    window.dispatchEvent(new CustomEvent("first_order_offer_changed"));
  };


  const loadSavedConfig = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<FirstOrderOfferConfig>;
      const { migrated, changed } = migrateToEnglishIfHindiDefaults(parsed);
      const next = { ...defaultConfig, ...migrated };
      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    } catch (e) {
      console.error("Failed to parse first order offer config", e);
      return null;
    }
  };

  useEffect(() => {
    const next = loadSavedConfig();
    if (!next) return;
    setConfig(next);
    setIsEditing(false);
  }, []);

  const previewText = useMemo(() => {
    const amount = Number.isFinite(config.discountAmount) ? config.discountAmount : 0;
    return {
      line1: config.title?.trim() || "On your first order",
      amount: `₹${amount}`,
      line2: config.subtitle?.trim() || "OFF",
    };
  }, [config.discountAmount, config.subtitle, config.title]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    const discountAmount = Number(config.discountAmount);
    const minOrderAmount = Number(config.minOrderAmount);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      setError("Discount amount must be a valid number.");
      return;
    }
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      setError("Min order amount must be a valid number.");
      return;
    }

    const payload: FirstOrderOfferConfig = {
      ...config,
      discountAmount,
      minOrderAmount,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSuccess("First Order Offer saved successfully.");
    setIsEditing(false);
    notifyOfferChanged();
  };

  const handleEdit = () => {
    setSuccess(null);
    setError(null);
    setIsEditing(true);
    const next = loadSavedConfig();
    if (next) setConfig(next);
  };

  const handleDelete = () => {
    if (!window.confirm("Delete First Order Offer?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setConfig(defaultConfig);
    setIsEditing(true);
    setSuccess("First Order Offer deleted.");
    setError(null);
    notifyOfferChanged();
  };

  const handleReset = () => {
    if (!window.confirm("Reset First Order Offer to default?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setConfig(defaultConfig);
    setIsEditing(true);
    setSuccess("Reset done.");
    setError(null);
    notifyOfferChanged();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-6 pb-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800">First Order Offer</h1>
          <div className="text-sm text-[#f187b5]">
            <span className="text-[#f187b5] hover:underline cursor-pointer">Home</span>{" "}
            <span className="text-neutral-400">/</span> Offers &amp; Deals{" "}
            <span className="text-neutral-400">/</span> First Order Offer
          </div>
        </div>
      </div>

      {(success || error) && (
        <div className="px-6">
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 px-3 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-neutral-800">Offer Settings</h2>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="submit"
                      form="first-order-offer-form"
                      className="px-4 py-2 rounded text-white bg-[#f187b5] hover:bg-[#e076a5] transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-4 py-2 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Reset
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="px-4 py-2 rounded text-white bg-[#f187b5] hover:bg-[#e076a5] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-4 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            <form
              key={isEditing ? "edit" : "view"}
              id="first-order-offer-form"
              onSubmit={handleSave}
              className="space-y-4 flex-1 overflow-y-auto"
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4 accent-[#f187b5]"
                />
                <span className="text-sm font-medium text-neutral-700">Enable offer</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Discount Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={config.discountAmount}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, discountAmount: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] outline-none"
                    min={0}
                    step="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Min Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={config.minOrderAmount}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, minOrderAmount: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] outline-none"
                    min={0}
                    step="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Title</label>
                <input
                  value={config.title}
                  onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] outline-none"
                  placeholder="e.g., On your first order"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Subtitle</label>
                <input
                  value={config.subtitle}
                  onChange={(e) => setConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] outline-none"
                  placeholder="e.g., OFF"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Button Text</label>
                <input
                  value={config.ctaText}
                  onChange={(e) => setConfig((prev) => ({ ...prev, ctaText: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] outline-none"
                  placeholder="e.g., Claim"
                />
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-800 mb-4">Preview (User App)</h2>
            <div className="max-w-xl">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs text-emerald-900">{previewText.line1}</div>
                    <div className="text-lg font-extrabold text-emerald-900">
                      {previewText.amount} <span className="text-xs font-semibold">{previewText.line2}</span>
                    </div>
                    {config.minOrderAmount > 0 && (
                      <div className="text-[11px] text-emerald-800">
                        Min order ₹{config.minOrderAmount}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-sm font-semibold"
                  >
                    {config.ctaText || "Claim"}
                  </button>
                </div>
              </div>
              <div className="text-xs text-neutral-500 mt-3">
                Note: This is frontend-only and saved in this browser (LocalStorage).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
