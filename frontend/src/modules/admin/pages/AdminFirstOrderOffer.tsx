import { useEffect, useMemo, useState } from "react";
import { getAppSettings, updateAppSettings } from "../../../services/api/admin/adminSettingsService";

type FirstOrderOfferConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
  discountAmount: number;
  minOrderAmount: number;
  ctaText: string;
  updatedAt?: string;
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
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await getAppSettings();
      if (res.success && res.data.firstOrderOffer) {
        setConfig(res.data.firstOrderOffer);
      } else {
        setConfig(defaultConfig);
      }
    } catch (err) {
      console.error("Failed to fetch first order offer config", err);
      setError("Failed to load configuration from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const previewText = useMemo(() => {
    const amount = Number.isFinite(config.discountAmount) ? config.discountAmount : 0;
    return {
      line1: config.title?.trim() || "On your first order",
      amount: `₹${amount}`,
      line2: config.subtitle?.trim() || "OFF",
    };
  }, [config.discountAmount, config.subtitle, config.title]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

    try {
      const res = await updateAppSettings({
        firstOrderOffer: {
          ...config,
          discountAmount,
          minOrderAmount,
          updatedAt: new Date().toISOString(),
        }
      });

      if (res.success) {
        setSuccess("First Order Offer saved successfully.");
        if (res.data.firstOrderOffer) {
          setConfig(res.data.firstOrderOffer);
        }
      } else {
        setError(res.message || "Failed to save configuration.");
      }
    } catch (err) {
      console.error("Failed to save first order offer config", err);
      setError("An error occurred while saving.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Disable First Order Offer?")) return;
    try {
      const res = await updateAppSettings({
        firstOrderOffer: {
          ...config,
          enabled: false,
          updatedAt: new Date().toISOString(),
        }
      });
      if (res.success) {
        setConfig(prev => ({ ...prev, enabled: false }));
        setSuccess("First Order Offer disabled.");
      }
    } catch (err) {
      setError("Failed to disable offer.");
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Loading settings...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-6 pb-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800">First Order Offer</h1>
          <div className="text-sm text-[var(--primary-color)]">
            <span className="text-[var(--primary-color)] hover:underline cursor-pointer">Home</span>{" "}
            <span className="text-neutral-400">/</span> Offers &amp; Deals{" "}
            <span className="text-neutral-400">/</span> First Order Offer
          </div>
        </div>
      </div>

      {(success || error) && (
        <div className="px-6">
          {success && (
            <div className="bg-[var(--primary-alpha-10)] border border-green-200 text-[var(--primary-darker)] px-4 py-3 rounded mb-4">
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
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-lg font-semibold text-neutral-800">Offer Settings</h2>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
              >
                Disable Offer
              </button>
            </div>

            <form
              id="first-order-offer-form"
              onSubmit={handleSave}
              className="space-y-4 flex-1"
            >
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="h-5 w-5 accent-[var(--primary-color)] rounded"
                />
                <span className="text-sm font-semibold text-neutral-700">Enable First Order Offer</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
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
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg bg-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] outline-none transition-all"
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
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg bg-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] outline-none transition-all"
                    min={0}
                    step="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Banner Title</label>
                <input
                  value={config.title}
                  onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg bg-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] outline-none transition-all"
                  placeholder="e.g., On your first order"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Banner Subtitle</label>
                <input
                  value={config.subtitle}
                  onChange={(e) => setConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg bg-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] outline-none transition-all"
                  placeholder="e.g., OFF"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Button Text</label>
                <input
                  value={config.ctaText}
                  onChange={(e) => setConfig((prev) => ({ ...prev, ctaText: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg bg-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] outline-none transition-all"
                  placeholder="e.g., Claim"
                />
              </div>

              <div className="pt-4 mt-6 border-t border-gray-100">
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg text-white font-bold bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] shadow-lg shadow-pink-100 transition-all active:scale-[0.98]"
                >
                  Save All Changes
                </button>
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
                Note: These settings are now persistent in the database and visible to all users.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
