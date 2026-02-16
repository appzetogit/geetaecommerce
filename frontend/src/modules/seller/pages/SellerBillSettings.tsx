import React, { useState, useEffect } from "react";
import { useToast } from "../../../context/ToastContext";

interface BillSettings {
  shopName: string;
  address: string;
  phone: string;
}

const SellerBillSettings = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<BillSettings>({
    shopName: "",
    address: "",
    phone: "",
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem("seller_bill_settings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to parse bill settings", e);
      }
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Phone validation: must be exactly 10 digits
    if (!/^\d{10}$/.test(settings.phone)) {
      showToast("Phone number must be exactly 10 digits", "error");
      return;
    }

    localStorage.setItem("seller_bill_settings", JSON.stringify(settings));
    showToast("Bill settings saved successfully", "success");
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[#f187b5] focus:border-[#f187b5]"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[#f187b5] focus:border-[#f187b5]"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[#f187b5] focus:border-[#f187b5]"
              placeholder="Enter contact number"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="px-6 py-2 bg-[#f187b5] text-white rounded-md hover:bg-[#e076a5] transition-colors font-medium"
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
