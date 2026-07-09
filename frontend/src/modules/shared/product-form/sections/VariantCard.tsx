import { useState, useEffect, useRef } from "react";
import { ProductVariantForm } from "../types/productForm.types";
import FormField, { inputClass, selectClass } from "../components/FormField";
import { uploadImage } from "../../../../services/api/uploadService";
import QRScannerModal from "../../../../components/QRScannerModal";
import { openBarcodeScanner } from "../../../../utils/scannerPlatform";
import {
  isBarcodeUsedByOtherVariant,
  normalizeBarcode,
} from "../utils/variantBarcodeUtils";
import api from "../../../../services/api/config";

interface Props {
  index: number;
  variant: ProductVariantForm;
  allVariants: ProductVariantForm[];
  canRemove: boolean;
  onChange: (variant: ProductVariantForm) => void;
  onRemove: () => void;
  isFieldEnabled: (sectionId: string, fieldId: string) => boolean;
  productName: string;
  enabledVariantTypes: Array<{id: string, label: string}>;
}

const variantColors = [
  "from-violet-500 to-indigo-500",
  "from-fuchsia-500 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-amber-500",
];

// Helper to render Barcode preview using JsBarcode from CDN
const BarcodePreview = ({ value }: { value: string }) => {
  const elementRef = useRef<SVGSVGElement | null>(null);
  const [loaded, setLoaded] = useState(window.hasOwnProperty("JsBarcode"));

  useEffect(() => {
    if (window.hasOwnProperty("JsBarcode")) {
      setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js";
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (loaded && elementRef.current) {
      try {
        (window as any).JsBarcode(elementRef.current, value, {
          format: "CODE128",
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 0,
        });
      } catch (err) {
        console.error("Failed to render barcode preview", err);
      }
    }
  }, [loaded, value]);

  return <svg ref={elementRef} className="mx-auto block" />;
};

export default function VariantCard({
  index,
  variant,
  allVariants,
  canRemove,
  onChange,
  onRemove,
  isFieldEnabled,
  productName,
  enabledVariantTypes,
}: Props) {
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");
  const gradient = variantColors[index % variantColors.length];

  const patch = (p: Partial<ProductVariantForm>) =>
    onChange({ ...variant, ...p });

  const [generatingBarcode, setGeneratingBarcode] = useState(false);

  const [inputValue, setInputValue] = useState(() => variant.barcode?.[0] || "");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (variant.barcode && variant.barcode[0] !== inputValue) {
      setInputValue(variant.barcode[0] || "");
    }
  }, [variant.barcode]);

  const handleGenerateBarcode = async () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      // Validate manually entered barcode uniqueness
      setGeneratingBarcode(true);
      try {
        const isAdmin = window.location.pathname.includes("/admin");
        const endpoint = isAdmin ? "/admin/products/check-barcode" : "/products/check-barcode";
        
        const pathParts = window.location.pathname.split("/");
        const productId = pathParts[pathParts.length - 1];

        if (isBarcodeUsedByOtherVariant(allVariants, index, trimmed)) {
          setBarcodeError(`Barcode "${trimmed}" is already used on another variant`);
          setShowPreview(false);
          return;
        }

        const response = await api.get(endpoint, {
          params: {
            barcode: trimmed,
            productId: /^[a-fA-F0-9]{24}$/.test(productId) ? productId : undefined
          }
        });

        if (response.data.success && !response.data.isUnique) {
          setBarcodeError(response.data.message || `Barcode "${trimmed}" is already in use`);
          setShowPreview(false);
          return;
        }

        setBarcodeError("");
        setShowPreview(true);
      } catch (err: any) {
        console.error("Failed to verify barcode uniqueness", err);
      } finally {
        setGeneratingBarcode(false);
      }
    } else {
      // Generate new unique barcode
      if (!productName.trim()) {
        alert("Please enter a product name first");
        return;
      }
      setGeneratingBarcode(true);
      try {
        const isAdmin = window.location.pathname.includes("/admin");
        const endpoint = isAdmin ? "/admin/products/generate-barcode" : "/products/generate-barcode";
        
        const otherBarcodes = allVariants.flatMap((v, idx) => {
          if (idx === index) return [];
          return v.barcode || [];
        });

        const response = await api.get(endpoint, {
          params: {
            productName: productName.trim(),
            variationValue: variant.value.trim(),
            excludeBarcodes: otherBarcodes.join(","),
          }
        });

        if (response.data.success && response.data.barcode) {
          const generated = normalizeBarcode(response.data.barcode);
          if (generated) {
            setBarcodeError("");
            setInputValue(generated);
            patch({ barcode: [generated] });
            setShowPreview(true);
          }
        } else {
          alert(response.data.message || "Failed to generate barcode");
        }
      } catch (err: any) {
        console.error("Error generating barcode:", err);
      } finally {
        setGeneratingBarcode(false);
      }
    }
  };

  const handlePrintBarcode = () => {
    const value = variant.barcode?.[0]; // Print the first barcode
    if (!value) {
      alert("No barcode found to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print barcodes");
      return;
    }

    const savedSize = localStorage.getItem('barcode_print_size') || 'medium';
    const customSettingsRaw = localStorage.getItem('barcode_printer_settings');
    const customSettings = customSettingsRaw ? JSON.parse(customSettingsRaw) : null;

    let containerWidth = 250;
    let barcodeHeight = 55;
    let fontSize = 14;
    let productNameSize = 14;
    let barcodeTextSize = 12;
    let barcodeModuleWidth = 2;
    let pageWidthMm = 50;
    let pageHeightMm = 30;
    let showName = true;
    let showPrice = true;
    let isCustom = false;

    if (customSettings) {
      isCustom = true;
      barcodeHeight = customSettings.barcodeHeight;
      fontSize = customSettings.fontSize;
      productNameSize = customSettings.productNameSize;
      if (typeof customSettings.barcodeWidth === 'number') {
        barcodeModuleWidth = customSettings.barcodeWidth;
      }
      showName = customSettings.showName ?? true;
      showPrice = customSettings.showPrice ?? true;
      pageWidthMm = customSettings.width;
      pageHeightMm = customSettings.height;
    }

    if (!isCustom) {
      if (savedSize === 'small') {
        containerWidth = 200;
        pageWidthMm = 45;
        pageHeightMm = 25;
        barcodeHeight = 32;
        fontSize = 10;
        productNameSize = 10;
        barcodeModuleWidth = 1.5;
      } else if (savedSize === 'large') {
        containerWidth = 320;
        pageWidthMm = 60;
        pageHeightMm = 35;
        barcodeHeight = 42;
        fontSize = 11;
        productNameSize = 12;
        barcodeModuleWidth = 2;
      } else {
        pageWidthMm = 50;
        pageHeightMm = 30;
        barcodeHeight = 36;
        fontSize = 10;
        productNameSize = 11;
        barcodeModuleWidth = 1.7;
      }
    }

    barcodeTextSize = Math.max(9, Math.min(12, Math.round(fontSize * 1.0)));
    if (isCustom) {
      if (typeof customSettings?.barcodeWidth === 'number') {
        barcodeModuleWidth = customSettings.barcodeWidth;
      } else if (customSettings?.width) {
        barcodeModuleWidth = customSettings.width <= 50 ? 1.7 : 2;
      }
    }

    let styleContent = '';
    if (isCustom && customSettings) {
      styleContent = `
        @page {
          size: ${customSettings.width}mm ${customSettings.height}mm;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          width: ${customSettings.width}mm;
        }
        .barcode-container {
          width: ${customSettings.width}mm;
          height: ${customSettings.height}mm;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          text-align: left;
          overflow: hidden;
          page-break-after: always;
          box-sizing: border-box;
          padding: 2mm;
          gap: 1px;
        }
      `;
    } else {
      styleContent = `
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; width: ${pageWidthMm}mm; }
        .barcode-grid { display: block; }
        .barcode-container {
          text-align: left;
          border: 0;
          padding: 2mm;
          page-break-inside: avoid;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          width: ${pageWidthMm}mm;
          height: ${pageHeightMm}mm;
          background: white;
          box-sizing: border-box;
          border-radius: 0;
          overflow: hidden;
          gap: 1px;
        }
      `;
    }

    const safeName = productName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeBarcode = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const mrp = Number(variant.price || 0);
    const sp = Number(variant.discPrice || 0);

    const htmlContent = `
      <html>
        <head>
          <title>Print Barcode</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; }
            ${styleContent}
            .product-name {
              font-size: ${productNameSize}px;
              font-weight: 600;
              margin: 0 0 1px 0;
              color: #000;
              line-height: 1.05;
              text-transform: none;
              max-width: 100%;
              word-wrap: break-word;
              display: ${showName ? 'block' : 'none'};
            }
            .price-row {
              display: ${showPrice ? 'flex' : 'none'};
              gap: 6px;
              margin-top: 1px;
              font-size: ${fontSize}px;
              font-weight: 700;
              color: #000;
              justify-content: space-between;
              align-items: baseline;
              white-space: nowrap;
              width: 100%;
            }
            .price-item { white-space: nowrap; }
            svg.barcode {
              width: auto;
              height: ${barcodeHeight}px;
              max-width: 100%;
              display: block;
              align-self: center;
              margin: 0 auto;
              shape-rendering: crispEdges;
            }
            svg.barcode * { shape-rendering: crispEdges; }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
          <div class="${isCustom ? '' : 'barcode-grid'}">
            <div class="barcode-container">
              <div class="product-name">${safeName}</div>
              <svg class="barcode"
                jsbarcode-format="CODE128"
                jsbarcode-value="${safeBarcode}"
                jsbarcode-width="${barcodeModuleWidth}"
                jsbarcode-height="${barcodeHeight}"
                jsbarcode-textmargin="1"
                jsbarcode-fontoptions="bold"
                jsbarcode-displayValue="true"
                jsbarcode-fontSize="${barcodeTextSize}"
                jsbarcode-margin="0"
                jsbarcode-marginBottom="0"
                jsbarcode-marginTop="0">
              </svg>
              <div class="price-row">
                ${customSettings?.mrpLabel ? `<div class="price-item">${customSettings.mrpLabel}:${mrp}</div>` : mrp ? `<div class="price-item">MRP:${mrp}</div>` : ''}
                ${customSettings?.spLabel ? `<div class="price-item">${customSettings.spLabel}:${sp}</div>` : sp ? `<div class="price-item">SP:${sp}</div>` : ''}
              </div>
            </div>
          </div>
          <script>
            JsBarcode(".barcode").init();
            setTimeout(() => {
              window.print();
              window.close();
            }, 800);
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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

  const handleScanSuccess = async (decodedText: string) => {
    const trimmed = normalizeBarcode(decodedText);
    if (trimmed) {
      setInputValue(trimmed);
      patch({ barcode: [trimmed] });
      setShowPreview(false);

      setGeneratingBarcode(true);
      try {
        const isAdmin = window.location.pathname.includes("/admin");
        const endpoint = isAdmin ? "/admin/products/check-barcode" : "/products/check-barcode";
        
        const pathParts = window.location.pathname.split("/");
        const productId = pathParts[pathParts.length - 1];

        if (isBarcodeUsedByOtherVariant(allVariants, index, trimmed)) {
          setBarcodeError(`Barcode "${trimmed}" is already used on another variant`);
          return;
        }

        const response = await api.get(endpoint, {
          params: {
            barcode: trimmed,
            productId: /^[a-fA-F0-9]{24}$/.test(productId) ? productId : undefined
          }
        });

        if (response.data.success && !response.data.isUnique) {
          setBarcodeError(response.data.message || `Barcode "${trimmed}" is already in use`);
          return;
        }

        setBarcodeError("");
      } catch (err: any) {
        console.error("Failed to verify scanned barcode uniqueness", err);
      } finally {
        setGeneratingBarcode(false);
      }
    }
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
              required
            />
          </FormField>
          <FormField label="Variant Value" required>
            <input
              className={inputClass}
              value={variant.value}
              onChange={(e) => patch({ value: e.target.value })}
              placeholder="e.g. 1kg, Red, Large"
              required
            />
          </FormField>
          {enabledVariantTypes && enabledVariantTypes.length > 0 && (
            enabledVariantTypes.map((vt) => (
              <FormField key={vt.id} label={vt.label}>
                <input
                  className={inputClass}
                  value={variant.attributes?.[vt.id] || ""}
                  onChange={(e) => {
                    const newAttrs = { ...(variant.attributes || {}), [vt.id]: e.target.value };
                    patch({ attributes: newAttrs });
                  }}
                  placeholder={`Enter ${vt.label}`}
                />
              </FormField>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <FormField label="MRP / Price" required>
            <input
              type="number"
              className={inputClass}
              value={variant.compareAtPrice}
              onChange={(e) => patch({ compareAtPrice: e.target.value })}
              placeholder="0"
            />
          </FormField>
          <FormField label="Selling Price" required>
            <input
              type="number"
              className={inputClass}
              value={variant.price}
              onChange={(e) => patch({ price: e.target.value })}
              placeholder="0"
            />
          </FormField>
          {isFieldEnabled("variants", "online_offer_price") && (
            <FormField label="Offer Price">
              <input
                type="number"
                className={inputClass}
                value={variant.discPrice}
                onChange={(e) => patch({ discPrice: e.target.value })}
                placeholder="0"
              />
            </FormField>
          )}
          <FormField label="Wholesale">
            <input
              type="number"
              className={inputClass}
              value={variant.wholesalePrice}
              onChange={(e) => patch({ wholesalePrice: e.target.value })}
            />
          </FormField>
          {isFieldEnabled("pricing", "purchase_price") && (
            <FormField label="Purchase">
              <input
                type="number"
                className={inputClass}
                value={variant.purchasePrice}
                onChange={(e) => patch({ purchasePrice: e.target.value })}
              />
            </FormField>
          )}
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

        {isFieldEnabled("basic", "item_code") && (
          <FormField label="SKU / Item Code">
            <input
              className={inputClass}
              value={variant.sku}
              onChange={(e) => patch({ sku: e.target.value })}
            />
          </FormField>
        )}

        {isFieldEnabled("basic", "rack_number") && (
          <FormField label="Rack Number">
            <input
              className={inputClass}
              value={variant.rackNumber}
              onChange={(e) => patch({ rackNumber: e.target.value })}
              placeholder="e.g. A1, Shelf 3"
            />
          </FormField>
        )}

        <FormField label="Barcode" required hint="Each variant must have a unique barcode — scan or generate/verify to add">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="Enter barcode"
                value={inputValue}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputValue(val);
                  patch({ barcode: val.trim() ? [val.trim()] : [] });
                  setShowPreview(false);
                  setBarcodeError("");
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
            {!inputValue.trim() && (
              <p className="text-xs text-rose-500">At least one barcode is required</p>
            )}

            {/* Generate & Print Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleGenerateBarcode}
                disabled={generatingBarcode}
                className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-violet-700 transition disabled:opacity-50"
              >
                {generatingBarcode ? "Generating..." : "Generate Barcode"}
              </button>
              <button
                type="button"
                onClick={handlePrintBarcode}
                disabled={!inputValue.trim()}
                className="inline-flex items-center justify-center rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Print Barcode
              </button>
            </div>

            {showPreview && inputValue.trim() && (
              <div className="mt-3 p-3 bg-white rounded-xl border border-violet-100 flex flex-col items-center justify-center shadow-inner">
                <BarcodePreview value={inputValue.trim()} />
              </div>
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
