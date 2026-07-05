import { useState } from "react";
import { ProductVariantForm } from "../types/productForm.types";
import FormField, { inputClass } from "../components/FormField";
import { uploadImage } from "../../../../services/api/uploadService";
import QRScannerModal from "../../../../components/QRScannerModal";
import { openBarcodeScanner } from "../../../../utils/scannerPlatform";
import {
  isBarcodeUsedByOtherVariant,
  normalizeBarcode,
} from "../utils/variantBarcodeUtils";

interface Props {
  index: number;
  variant: ProductVariantForm;
  allVariants: ProductVariantForm[];
  canRemove: boolean;
  onChange: (variant: ProductVariantForm) => void;
  onRemove: () => void;
}

const variantColors = [
  "from-violet-500 to-indigo-500",
  "from-fuchsia-500 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-amber-500",
];

export default function VariantCard({
  index,
  variant,
  allVariants,
  canRemove,
  onChange,
  onRemove,
}: Props) {
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");
  const gradient = variantColors[index % variantColors.length];

  const patch = (p: Partial<ProductVariantForm>) =>
    onChange({ ...variant, ...p });

  const handleMainImage = async (file: File) => {
    setUploadingMain(true);
    try {
      const result = await uploadImage(file, "Geeta Stores/products");
      patch({ mainImage: result.secureUrl });
    } finally {
      setUploadingMain(false);
    }
  };

  const handleGalleryImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingGallery(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadImage(file, "Geeta Stores/products");
        uploaded.push(result.secureUrl);
      }
      patch({
        galleryImages: [...(variant.galleryImages || []), ...uploaded],
      });
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = (url: string) => {
    patch({
      galleryImages: (variant.galleryImages || []).filter((image) => image !== url),
    });
  };

  const addBarcode = (code: string) => {
    const trimmed = normalizeBarcode(code);
    if (!trimmed) return;

    const existing = (variant.barcode || []).map(normalizeBarcode);
    if (existing.includes(trimmed)) {
      setBarcodeError("This barcode is already added to this variant");
      return;
    }

    if (isBarcodeUsedByOtherVariant(allVariants, index, trimmed)) {
      setBarcodeError(
        `Barcode "${trimmed}" is already used on another variant`
      );
      return;
    }

    setBarcodeError("");
    patch({ barcode: [...(variant.barcode || []), trimmed] });
  };

  const removeBarcode = (code: string) => {
    setBarcodeError("");
    patch({ barcode: (variant.barcode || []).filter((b) => b !== code) });
  };

  const handleScanSuccess = (decodedText: string) => {
    addBarcode(decodedText);
    setShowScanner(false);
  };

  const openScanner = () => {
    openBarcodeScanner(() => setShowScanner(true));
  };

  const label =
    variant.value.trim() || variant.variationType.trim()
      ? `${variant.variationType || "Type"} · ${variant.value || "Value"}`
      : `Variant ${index + 1}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`bg-gradient-to-r ${gradient} px-4 py-3 text-white`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-white/80">
              Variant {index + 1}
            </p>
            <h3 className="truncate text-base font-bold">{label}</h3>
          </div>
          <button
            type="button"
            disabled={!canRemove}
            onClick={onRemove}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="space-y-5 p-4 md:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Variant Type" required>
            <input
              className={inputClass}
              value={variant.variationType}
              onChange={(e) => patch({ variationType: e.target.value })}
              placeholder="e.g. Size, Weight, Color"
            />
          </FormField>
          <FormField label="Variant Value" required>
            <input
              className={inputClass}
              value={variant.value}
              onChange={(e) => patch({ value: e.target.value })}
              placeholder="e.g. 1kg, Red, Large"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <FormField label="MRP / Price" required>
            <input
              type="number"
              className={inputClass}
              value={variant.price}
              onChange={(e) => patch({ price: e.target.value })}
              placeholder="0"
            />
          </FormField>
          <FormField label="Offer Price">
            <input
              type="number"
              className={inputClass}
              value={variant.discPrice}
              onChange={(e) => patch({ discPrice: e.target.value })}
              placeholder="0"
            />
          </FormField>
          <FormField label="Wholesale">
            <input
              type="number"
              className={inputClass}
              value={variant.wholesalePrice}
              onChange={(e) => patch({ wholesalePrice: e.target.value })}
            />
          </FormField>
          <FormField label="Purchase">
            <input
              type="number"
              className={inputClass}
              value={variant.purchasePrice}
              onChange={(e) => patch({ purchasePrice: e.target.value })}
            />
          </FormField>
          <FormField label="Stock" required>
            <input
              type="number"
              className={inputClass}
              value={variant.stock}
              onChange={(e) => patch({ stock: e.target.value })}
              placeholder="0"
            />
          </FormField>
        </div>

        <FormField label="SKU / Item Code">
          <input
            className={inputClass}
            value={variant.sku}
            onChange={(e) => patch({ sku: e.target.value })}
          />
        </FormField>

        <FormField label="Barcode" required hint="Each variant must have a unique barcode — scan or type to add">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="Enter barcode"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBarcode((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <button
                type="button"
                onClick={openScanner}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"
                  />
                </svg>
                Scan
              </button>
            </div>
            {barcodeError && (
              <p className="text-xs font-medium text-rose-500">{barcodeError}</p>
            )}
            {(variant.barcode || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(variant.barcode || []).map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-sm font-medium text-violet-800"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => removeBarcode(code)}
                      className="text-violet-400 transition hover:text-rose-500"
                      aria-label={`Remove barcode ${code}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-rose-500">At least one barcode is required</p>
            )}
          </div>
        </FormField>

        <FormField label="Main Image" hint="Upload a clear product image for this variant">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
            {variant.mainImage ? (
              <img
                src={variant.mainImage}
                alt=""
                className="h-24 w-24 rounded-xl border border-white object-cover shadow-md"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-white text-3xl text-violet-300 shadow-inner">
                📷
              </div>
            )}
            <label className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90">
              {uploadingMain ? "Uploading..." : "Choose Image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingMain}
                onChange={(e) =>
                  e.target.files?.[0] && handleMainImage(e.target.files[0])
                }
              />
            </label>
          </div>
        </FormField>

        <FormField
          label="Gallery Images"
          hint="Add multiple extra images for this variant (optional)"
        >
          <div className="space-y-4 rounded-xl border border-dashed border-fuchsia-200 bg-fuchsia-50/40 p-4">
            {(variant.galleryImages || []).length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {(variant.galleryImages || []).map((url) => (
                  <div key={url} className="group relative">
                    <img
                      src={url}
                      alt=""
                      className="h-24 w-full rounded-xl border border-white object-cover shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(url)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-sm font-bold text-white opacity-0 shadow transition group-hover:opacity-100"
                      aria-label="Remove gallery image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-fuchsia-200 bg-white text-sm text-fuchsia-400">
                No gallery images yet
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90">
              {uploadingGallery ? "Uploading..." : "Add Gallery Images"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploadingGallery}
                onChange={(e) => {
                  void handleGalleryImages(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </FormField>
      </div>

      {showScanner && (
        <QRScannerModal
          onClose={() => setShowScanner(false)}
          onScanSuccess={handleScanSuccess}
        />
      )}
    </article>
  );
}
