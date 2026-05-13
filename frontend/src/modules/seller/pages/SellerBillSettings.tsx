import React, { useState, useEffect } from "react";
import { useToast } from "../../../context/ToastContext";
import {
  getSellerBillSettings as apiGetSellerBillSettings,
  updateSellerBillSettings as apiUpdateSellerBillSettings,
} from "../../../services/api/seller/sellerPurchaseService";
import { SELLER_BILL_SETTINGS_KEY, SELLER_BILL_SETTINGS_UPDATED_EVENT } from "../../../utils/sellerPosBillSettings";

interface BillSettings {
  shopName: string;
  address: string;
  phone: string;
  notes?: {
      text: string;
      enabled: boolean;
  };
  terms?: {
      text: string;
      enabled: boolean;
  };
  gst?: {
      text: string;
      enabled: boolean;
  };
  fssai?: {
      text: string;
      enabled: boolean;
  };
}

const SellerBillSettings = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<BillSettings>({
    shopName: "",
    address: "",
    phone: "",
    notes: {
        text: "Thank you for your business",
        enabled: true
    },
    terms: {
        text: "Goods once sold will not be taken back.",
        enabled: true
    },
    gst: {
        text: "",
        enabled: false
    },
    fssai: {
        text: "",
        enabled: false
    }
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiGetSellerBillSettings();
        if (res.success && res.data) {
          const parsed = res.data as any;
          setSettings((prev) => ({
            ...prev,
            ...parsed,
            notes: parsed.notes || {
              text: "Thank you for your business",
              enabled: true,
            },
            terms: parsed.terms || {
              text: "Goods once sold will not be taken back.",
              enabled: true,
            },
            gst: parsed.gst || {
              text: "",
              enabled: false,
            },
            fssai: parsed.fssai || {
              text: "",
              enabled: false,
            },
          }));
          localStorage.setItem("seller_bill_settings", JSON.stringify(parsed));
          return;
        }
      } catch {
        // fallback to local cache
      }

      const savedSettings = localStorage.getItem(SELLER_BILL_SETTINGS_KEY);
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings((prev) => ({
            ...prev,
            ...parsed,
            notes: parsed.notes || {
              text: "Thank you for your business",
              enabled: true,
            },
            terms: parsed.terms || {
              text: "Goods once sold will not be taken back.",
              enabled: true,
            },
            gst: parsed.gst || {
              text: "",
              enabled: false,
            },
            fssai: parsed.fssai || {
              text: "",
              enabled: false,
            },
          }));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to parse bill settings", e);
        }
      }
    };
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'phone') {
        // Allow only numbers and max 10 digits
        const numericValue = value.replace(/\D/g, '');
        if (numericValue.length <= 10) {
             setSettings((prev) => ({
                ...prev,
                [name]: numericValue,
              }));
        }
    } else {
        setSettings((prev) => ({
          ...prev,
          [name]: value,
        }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Phone validation: must be exactly 10 digits
    if (!/^\d{10}$/.test(settings.phone)) {
      showToast("Phone number must be exactly 10 digits", "error");
      return;
    }

    try {
      const res = await apiUpdateSellerBillSettings(settings as any);
      if (res.success) {
        localStorage.setItem(SELLER_BILL_SETTINGS_KEY, JSON.stringify(settings));
        window.dispatchEvent(new Event(SELLER_BILL_SETTINGS_UPDATED_EVENT));
        showToast("Bill settings saved successfully", "success");
      } else {
        showToast(res.message || "Failed to save bill settings", "error");
      }
    } catch {
      showToast("Failed to save bill settings", "error");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Bill Settings</h1>
      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shop Name
            </label>
            <input
              type="text"
              name="shopName"
              value={settings.shopName}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
              placeholder="Enter your shop name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              name="address"
              value={settings.address}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
              placeholder="Enter shop address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              name="phone"
              maxLength={10}
              value={settings.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
              placeholder="Enter contact number"
            />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                    Notes
                    <span className="block text-xs text-gray-500 font-normal">Shown at the bottom of the bill</span>
                </label>
                <button
                    type="button"
                    onClick={() => setSettings(prev => ({
                        ...prev,
                        notes: {
                            text: prev.notes?.text || "Thank you for your business",
                            enabled: !prev.notes?.enabled
                        }
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.notes?.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notes?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {settings.notes?.enabled && (
                <textarea
                    name="notes"
                    value={settings.notes?.text || ''}
                    onChange={(e) => setSettings(prev => ({
                        ...prev,
                        notes: {
                            enabled: prev.notes?.enabled ?? true,
                            text: e.target.value
                        }
                    }))}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
                    placeholder="Enter notes (e.g. Thank you for your business)"
                />
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                    Terms & Conditions
                    <span className="block text-xs text-gray-500 font-normal">Shown at the bottom of the bill</span>
                </label>
                <button
                    type="button"
                    onClick={() => setSettings(prev => ({
                        ...prev,
                        terms: {
                            text: prev.terms?.text || "Goods once sold will not be taken back.",
                            enabled: !prev.terms?.enabled
                        }
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.terms?.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.terms?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {settings.terms?.enabled && (
                <textarea
                    name="terms"
                    value={settings.terms?.text || ''}
                    onChange={(e) => setSettings(prev => ({
                        ...prev,
                        terms: {
                            enabled: prev.terms?.enabled ?? true,
                            text: e.target.value
                        }
                    }))}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
                    placeholder="Enter terms and conditions..."
                />
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                    GST Details (Optional)
                    <span className="block text-xs text-gray-500 font-normal">Shown on invoice</span>
                </label>
                <button
                    type="button"
                    onClick={() => setSettings(prev => ({
                        ...prev,
                        gst: {
                            text: prev.gst?.text || "",
                            enabled: !prev.gst?.enabled
                        }
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.gst?.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.gst?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {settings.gst?.enabled && (
                <input
                    type="text"
                    name="gst"
                    value={settings.gst?.text || ''}
                    onChange={(e) => setSettings(prev => ({
                        ...prev,
                        gst: {
                            enabled: prev.gst?.enabled ?? true,
                            text: e.target.value
                        }
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
                    placeholder="Enter GST Number"
                />
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                    FSSAI Number (Optional)
                    <span className="block text-xs text-gray-500 font-normal">Shown on invoice</span>
                </label>
                <button
                    type="button"
                    onClick={() => setSettings(prev => ({
                        ...prev,
                        fssai: {
                            text: prev.fssai?.text || "",
                            enabled: !prev.fssai?.enabled
                        }
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.fssai?.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.fssai?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {settings.fssai?.enabled && (
                <input
                    type="text"
                    name="fssai"
                    value={settings.fssai?.text || ''}
                    onChange={(e) => setSettings(prev => ({
                        ...prev,
                        fssai: {
                            enabled: prev.fssai?.enabled ?? true,
                            text: e.target.value
                        }
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
                    placeholder="Enter FSSAI Number"
                />
            )}
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-md hover:bg-[var(--primary-dark)] transition-colors font-medium"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SellerBillSettings;
