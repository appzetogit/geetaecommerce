import { useEffect, useState } from "react";
import { getAllSellers, Seller } from "../../../services/api/sellerService";

export default function AdminSellerUserLimit() {
  const [limitInput, setLimitInput] = useState("3");
  const [savedLimit, setSavedLimit] = useState(3);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  const handleSave = () => {
    const value = Number(limitInput);
    if (!Number.isFinite(value) || value < 1) return;
    setSavedLimit(Math.floor(value));
  };

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        setLoading(true);
        const response = await getAllSellers();
        if (response.success && response.data) {
          setSellers(response.data);
        }
      } catch (error) {
        setSellers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSellers();
  }, []);

  const activeSellers = sellers.filter(
    (seller) => seller.status === "Approved" && seller.isEnabled !== false
  );

  return (
    <div className="min-h-[calc(100vh-90px)] bg-neutral-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-bold text-neutral-900">
            Seller Panel User Limitation
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Choose how many users can use seller panel.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Set Seller Panel User Limit
            </label>
            <input
              type="number"
              min={1}
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)]"
              placeholder="Enter user limit"
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">
              Current saved limit:{" "}
              <span className="font-semibold text-neutral-900">{savedLimit}</span>
            </p>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-[var(--primary-color)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)]"
            >
              Save
            </button>
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-900">
                Sellers Using Panel
              </h2>
              <span className="text-sm text-neutral-600">
                {activeSellers.length} active
              </span>
            </div>

            {loading ? (
              <p className="text-sm text-neutral-500">Loading sellers...</p>
            ) : activeSellers.length === 0 ? (
              <p className="text-sm text-neutral-500">No active seller found.</p>
            ) : (
              <div className="space-y-2">
                {activeSellers.map((seller) => (
                  <div
                    key={seller._id}
                    className="rounded-lg border border-neutral-200 px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-neutral-800">
                      {seller.sellerName || "-"}
                    </p>
                    <p className="text-xs text-neutral-600">
                      Store: {seller.storeName || "-"} | Mobile:{" "}
                      {seller.mobile || "-"} | Email: {seller.email || "-"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
