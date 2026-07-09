import { useEffect, useState } from "react";
import { ProductMainInfoForm } from "../types/productForm.types";
import FormField, { inputClass, selectClass } from "../components/FormField";
import FormSectionCard from "../components/FormSectionCard";
import CategoryCascadeFields from "../components/CategoryCascadeFields";
import { getBrands, Brand } from "../../../../services/api/brandService";
import { getShops, Shop } from "../../../../services/api/productService";

interface Props {
  role: "admin" | "seller";
  mainInfo: ProductMainInfoForm;
  onChange: (patch: Partial<ProductMainInfoForm>) => void;
  showSellerPicker?: boolean;
  isFieldEnabled: (sectionId: string, fieldId: string) => boolean;
}

const yesNoSelect = (
  value: "Yes" | "No",
  onChange: (v: "Yes" | "No") => void
) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as "Yes" | "No")}
    className={selectClass}
  >
    <option value="Yes">Yes</option>
    <option value="No">No</option>
  </select>
);

export default function ProductMainInfoSection({
  role,
  mainInfo,
  onChange,
  showSellerPicker,
  isFieldEnabled,
}: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadBrands = async () => {
      setLoadingBrands(true);
      try {
        const response = await getBrands();
        if (!cancelled && response.success) {
          setBrands(response.data || []);
        }
      } catch {
        if (!cancelled) setBrands([]);
      } finally {
        if (!cancelled) setLoadingBrands(false);
      }
    };
    void loadBrands();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (isFieldEnabled("visibility", "select_store")) {
      const fetchShopsData = async () => {
        try {
          const res = await getShops();
          if (res.success) {
            setShops(res.data || []);
          }
        } catch (err) {
          console.error("Error fetching shops:", err);
        }
      };
      fetchShopsData();
    }
  }, [isFieldEnabled]);

  const showSummary = isFieldEnabled("basic", "summary");
  const showDescription = isFieldEnabled("basic", "description");
  const showPack = isFieldEnabled("basic", "pack");
  const showVideo = isFieldEnabled("basic", "video");

  const showHeaderCategory = isFieldEnabled("basic", "header_category");
  const showCategory = isFieldEnabled("basic", "category");
  const showSubcategory = isFieldEnabled("basic", "subcategory");
  const showBrand = isFieldEnabled("basic", "brand");

  const showTax = isFieldEnabled("pricing", "tax");
  const showHsn = isFieldEnabled("pricing", "hsn_code");
  const showDeliveryTime = isFieldEnabled("pricing", "delivery_time");
  const showMfgDate = isFieldEnabled("pricing", "mfg_date");
  const showExpiryDate = isFieldEnabled("pricing", "expiry_date");

  const showCategoryBrandSection = showHeaderCategory || showCategory || showSubcategory || showBrand;
  const showTaxSection = showTax || showHsn || showDeliveryTime || showMfgDate || showExpiryDate;

  const showVisibilitySection = isFieldEnabled("visibility", "shop_by_store_only") || isFieldEnabled("visibility", "select_store");

  return (
    <div className="space-y-6">
      <FormSectionCard
        title="Basic Details"
        subtitle="Name, descriptions, and visibility flags"
        accent="sky"
        icon={<span className="text-lg">📦</span>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Product Name" required className="md:col-span-2">
            <input
              className={inputClass}
              value={mainInfo.productName}
              onChange={(e) => onChange({ productName: e.target.value })}
              placeholder="Enter product name"
              required
            />
          </FormField>

          {showSummary && (
            <FormField label="Short Description" className="md:col-span-2">
              <textarea
                className={inputClass}
                rows={2}
                value={mainInfo.smallDescription}
                onChange={(e) => onChange({ smallDescription: e.target.value })}
                placeholder="Brief summary for listings"
              />
            </FormField>
          )}

          {showDescription && (
            <FormField label="Full Description" className="md:col-span-2">
              <textarea
                className={inputClass}
                rows={4}
                value={mainInfo.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Detailed product information"
              />
            </FormField>
          )}

          {showPack && (
            <FormField label="Pack / Unit Size">
              <input
                className={inputClass}
                value={mainInfo.pack}
                onChange={(e) => onChange({ pack: e.target.value })}
                placeholder="e.g. 1kg, 500ml"
              />
            </FormField>
          )}

          {showVideo && (
            <FormField label="Product Video">
              <input
                className={inputClass}
                value={mainInfo.video || ""}
                onChange={(e) => onChange({ video: e.target.value })}
                placeholder="Specify product youtube video link"
              />
            </FormField>
          )}

          <FormField label="Publish">
            {yesNoSelect(mainInfo.publish, (v) => onChange({ publish: v }))}
          </FormField>
          <FormField label="Popular">
            {yesNoSelect(mainInfo.popular, (v) => onChange({ popular: v }))}
          </FormField>
          <FormField label="Deal of the Day">
            {yesNoSelect(mainInfo.dealOfDay, (v) => onChange({ dealOfDay: v }))}
          </FormField>
          {showSellerPicker && (
            <FormField label="Seller ID">
              <input
                className={inputClass}
                value={mainInfo.seller}
                onChange={(e) => onChange({ seller: e.target.value })}
                placeholder="Seller ObjectId"
              />
            </FormField>
          )}
        </div>
      </FormSectionCard>

      {showCategoryBrandSection && (
        <FormSectionCard
          title="Category & Brand"
          subtitle="Organize product in your catalog hierarchy"
          accent="amber"
          icon={<span className="text-lg">🏷️</span>}
        >
          <CategoryCascadeFields
            role={role}
            headerCategoryId={mainInfo.headerCategory}
            categoryId={mainInfo.category}
            subcategoryId={mainInfo.subcategory}
            onChange={(patch) => onChange(patch)}
            isFieldEnabled={isFieldEnabled}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {showBrand && (
              <FormField label="Brand Name">
                <select
                  className={selectClass}
                  value={mainInfo.brand}
                  onChange={(e) => onChange({ brand: e.target.value })}
                  disabled={loadingBrands}
                >
                  <option value="">
                    {loadingBrands ? "Loading brands..." : "Select brand (optional)"}
                  </option>
                  {brands.map((brand) => (
                    <option key={brand._id} value={brand._id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </div>
        </FormSectionCard>
      )}

      {showTaxSection && (
        <FormSectionCard
          title="Tax & Compliance"
          subtitle="GST, HSN, and tax configuration"
          accent="emerald"
          icon={<span className="text-lg">💰</span>}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {showTax && (
              <>
                <FormField label="GST %">
                  <input
                    type="number"
                    className={inputClass}
                    value={mainInfo.gst}
                    onChange={(e) => onChange({ gst: e.target.value })}
                  />
                </FormField>
                <FormField label="Tax Info">
                  <input
                    className={inputClass}
                    value={mainInfo.tax}
                    onChange={(e) => onChange({ tax: e.target.value })}
                    placeholder="e.g. Tax category or details"
                  />
                </FormField>
              </>
            )}
            {showHsn && (
              <FormField label="HSN Code">
                <input
                  className={inputClass}
                  value={mainInfo.hsnCode}
                  onChange={(e) => onChange({ hsnCode: e.target.value })}
                />
              </FormField>
            )}
            {showDeliveryTime && (
              <FormField label="Delivery Time">
                <input
                  className={inputClass}
                  value={mainInfo.deliveryTime}
                  onChange={(e) => onChange({ deliveryTime: e.target.value })}
                  placeholder="e.g. 2-3 Days"
                />
              </FormField>
            )}
            {showMfgDate && (
              <FormField label="Mfg Date">
                <input
                  className={inputClass}
                  type="date"
                  value={mainInfo.mfgDate}
                  onChange={(e) => onChange({ mfgDate: e.target.value })}
                />
              </FormField>
            )}
            {showExpiryDate && (
              <FormField label="Expiry Date">
                <input
                  className={inputClass}
                  type="date"
                  value={mainInfo.expiryDate}
                  onChange={(e) => onChange({ expiryDate: e.target.value })}
                />
              </FormField>
            )}
          </div>
        </FormSectionCard>
      )}

      {showVisibilitySection && (
        <FormSectionCard
          title="Visibility & Store"
          subtitle="Configure product visibility for specific store"
          accent="indigo"
          icon={<span className="text-lg">👁️</span>}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {isFieldEnabled("visibility", "shop_by_store_only") && (
              <FormField label="Show in Shop by Store only?">
                {yesNoSelect(mainInfo.isShopByStoreOnly, (v) =>
                  onChange({ isShopByStoreOnly: v })
                )}
              </FormField>
            )}

            {isFieldEnabled("visibility", "select_store") && mainInfo.isShopByStoreOnly === "Yes" && (
              <FormField label="Select Store">
                <select
                  className={selectClass}
                  value={mainInfo.shopId}
                  onChange={(e) => onChange({ shopId: e.target.value })}
                >
                  <option value="">Select a store</option>
                  {shops.map((shop) => (
                    <option key={shop._id} value={shop._id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </div>
        </FormSectionCard>
      )}
    </div>
  );
}
