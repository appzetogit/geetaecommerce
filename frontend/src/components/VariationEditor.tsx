
import React, { useState, useEffect, useRef } from 'react';
import QRScannerModal from "./QRScannerModal";
import { openBarcodeScanner } from '../utils/scannerPlatform';
import { getVariationTypes } from "../services/api/admin/adminVariationTypeService";
import api from "../services/api/config";

export interface Variation {
  id?: string; // Internal ID for tracking in this editor
  _id?: string; // Backend ID
  name?: string; // Attribute Name (e.g. Color)
  value?: string; // Attribute Value (e.g. Red)
  // For multiple attributes, we might need a composite key or just dynamic fields
  // Currently mapping "Unit Value" to 'value' in the prompt
  sku?: string;
  price: number | string; // Selling Price, allowing empty string for input
  mrp?: number | string; // MRP
  offerPrice?: number | string; // Offer Price
  wholesalePrice?: number | string; // Wholesale Price
  barcode?: string[]; // Multiple barcodes
  stock: number | string;
  colorCode?: string;
  // Dynamic attribute values
  [key: string]: any;
}

interface VariationEditorProps {
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  variations: any[]; // Incoming variations
  selectedAttributes: string[]; // e.g. ["Color", "Size"]
  variationName: string;
  onVariationNameChange: (name: string) => void;
  onSave: (newVariations: any[]) => void;
}

const VariationEditor: React.FC<VariationEditorProps> = ({
  productName,
  isOpen,
  onClose,
  variations,
  selectedAttributes,
  variationName,
  onVariationNameChange,
  onSave,
}) => {
  const [localVariations, setLocalVariations] = useState<Variation[]>([]);
  const [variationType, setVariationType] = useState<string>('');
  const [availableVariationTypes, setAvailableVariationTypes] = useState<any[]>([]);
  const [selectedColors, setSelectedColors] = useState<{name: string, code: string}[]>([]);
  const [colorInput, setColorInput] = useState<{name: string, code: string}>({ name: "", code: "#000000" });
  const [isScanning, setIsScanning] = useState(false);
  const [scanIndex, setScanIndex] = useState<number | null>(null);

  const startScanning = (index: number) => {
    setScanIndex(index);
    openBarcodeScanner(() => setIsScanning(true));
  };

  const onScanSuccess = (decodedText: string) => {
    if (scanIndex !== null) {
      const currentBarcodes = localVariations[scanIndex].barcode || [];
      if (!currentBarcodes.includes(decodedText)) {
        handleChange(scanIndex, 'barcode', [...currentBarcodes, decodedText]);
      }
    }
    setIsScanning(false);
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  const handleAutoGenerateBarcode = async (index: number) => {
    if (!productName.trim()) {
      alert("Please enter a product name first");
      return;
    }
    try {
      const isAdmin = window.location.pathname.includes("/admin");
      const endpoint = isAdmin ? "/admin/products/generate-barcode" : "/products/generate-barcode";
      
      const otherBarcodes = localVariations.flatMap((varItem, idx) => {
        if (idx === index) return [];
        return varItem.barcode || [];
      });

      const response = await api.get(endpoint, {
        params: {
          productName: productName.trim(),
          variationValue: localVariations[index]?.value || "Default",
          excludeBarcodes: otherBarcodes.join(","),
        }
      });

      if (response.data.success && response.data.barcode) {
        const generated = response.data.barcode.trim();
        const currentBarcodes = localVariations[index].barcode || [];
        if (!currentBarcodes.includes(generated)) {
          handleChange(index, 'barcode', [...currentBarcodes, generated]);
        }
      } else {
        alert(response.data.message || "Failed to generate barcode");
      }
    } catch (err: any) {
      console.error("Error generating barcode:", err);
      alert(err.response?.data?.message || err.message || "Failed to generate barcode");
    }
  };

  useEffect(() => {
    const fetchTypes = async () => {
        try {
            const res = await getVariationTypes();
            if (res.success) setAvailableVariationTypes(res.data);
        } catch (err) { console.error(err); }
    };
    if (isOpen) fetchTypes();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Map existing variations to local structure
      const mapped = variations.map((v, index) => {
        const item: Variation = {
          id: v._id || `temp-${index}`,
          _id: v._id,
          sku: v.sku || v.itemCode || '',
          price: v.price || '',
          mrp: v.compareAtPrice || '',
          offerPrice: v.discPrice || v.offerPrice || '',
          wholesalePrice: v.wholesalePrice || '',
          barcode: Array.isArray(v.barcode) ? v.barcode : v.barcode ? [v.barcode] : [],
          stock: v.stock || 0,
          // Map attribute values if possible
          // Current backend: name="Color", value="Red"
          // We try to fill the columns corresponding to selected attributes
        };

        // Heuristic to fill attribute columns from existing data
        if (v.name && v.value) {
            // If v.name matches one of the selected attributes, set it
            if (selectedAttributes.some(attr => attr.toLowerCase() === (v.name || '').toLowerCase())) {
                 // Try to match case insensitive
                 const match = selectedAttributes.find(attr => attr.toLowerCase() === (v.name || '').toLowerCase());
                 if (match) item[match] = v.value;
            } else {
                // If simple 'name'/'value' pair, just put it in the first selected attribute or fallback
                if(selectedAttributes.length > 0) {
                     item[selectedAttributes[0]] = v.value;
                }
            }
        }

        // If we have 'size' or 'color' specific fields in the variation object from backend (sometimes inconsistent)
        // We can try to use them
        return item;
      });
      setLocalVariations(mapped.length > 0 ? mapped : [{ id: 'new-1', price: '', stock: '' }]);

      // Initial state for variationType
      if (variations.length > 0) {
          const first = variations[0];
          if (first.name) {
              setVariationType(first.name);
              if (first.name.toLowerCase() === 'color') {
                  const colors: {name: string, code: string}[] = [];
                  variations.forEach(v => {
                      if (v.name?.toLowerCase() === 'color' && v.value && !colors.some(c => c.name === v.value)) {
                          colors.push({ name: v.value, code: v.colorCode || '#000000' });
                      }
                  });
                  setSelectedColors(colors);
              }
          }
      } else if (selectedAttributes.length > 0) {
          setVariationType(selectedAttributes[0]);
      }
    }
  }, [isOpen, variations, selectedAttributes]);

  const handleChange = (index: number, field: string, value: any) => {
    const newVars = [...localVariations];
    newVars[index] = { ...newVars[index], [field]: value };
    setLocalVariations(newVars);

    // Auto-generate SKU if needed? (User didn't ask)
  };

  const addRow = () => {
    setLocalVariations([...localVariations, { id: `new-${Date.now()}`, price: '', stock: '' }]);
  };

  const removeRow = (index: number) => {
    setLocalVariations(localVariations.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const allBarcodes: string[] = [];
    for (const v of localVariations) {
      for (const b of v.barcode || []) {
        const trimmed = b.trim();
        if (trimmed) allBarcodes.push(trimmed);
      }
    }
    const duplicates = allBarcodes.filter((b, idx) => allBarcodes.indexOf(b) !== idx);
    if (duplicates.length > 0) {
      alert(`Duplicate barcode(s) found across variations: ${Array.from(new Set(duplicates)).join(", ")}. Each variant must have a unique barcode.`);
      return;
    }

    // Map back to backend structure
    const validVariations = localVariations.map(v => {
        // Construct 'name' and 'value' for backend
        // If multiple attributes selected, we might need to combine them or pick one
        // For now, let's join them if multiple: "Color/Size" and "Red/M"

        let finalName = "";
        let finalValue = "";

        if (selectedAttributes.length > 0) {
            finalName = selectedAttributes.join('/');
            finalValue = selectedAttributes.map(attr => v[attr] || '-').join('/');
        } else {
            // Fallback if no attributes selected but variations exist
            finalName = "Variation";
            finalValue = v.value || "Default";
        }

        return {
            _id: v._id, // Preserve ID if editing existing
            name: finalName,
            value: finalValue,
            title: finalValue, // Frontend often uses title
            price: Number(v.price) || 0,
            compareAtPrice: Number(v.mrp) || 0,
            discPrice: Number(v.offerPrice) || 0,
            wholesalePrice: Number(v.wholesalePrice) || 0,
            stock: Number(v.stock) || 0,
            sku: v.sku,
            barcode: v.barcode || [],
            colorCode: v.colorCode,
            status: Number(v.stock) > 0 ? "In stock" : "Sold out"
        };
    });

    onSave(validVariations);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#f187b5] text-white px-6 py-4 flex justify-between items-center">
            <div>
                <h3 className="text-lg font-bold">Edit Variations</h3>
                <p className="text-xs opacity-90 text-pink-50">{productName}</p>
            </div>
            <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>

        {/* Variation Type Selection */}
        <div className="bg-white px-6 py-4 border-b border-gray-100 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 max-w-xs">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Variation Type</label>
                    <div className="relative">
                        <select
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm appearance-none outline-none focus:border-[#f187b5] focus:ring-1 focus:ring-[#f187b5]/20 cursor-pointer"
                            value={variationType}
                            onChange={(e) => setVariationType(e.target.value)}
                        >
                            <option value="">Select Variation Type</option>
                            {availableVariationTypes.map((vt: any) => (
                                <option key={vt._id || vt.id} value={vt.name}>{vt.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                             <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                <div className="flex-1 max-w-xs">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Variation Name</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-[#f187b5] focus:ring-1 focus:ring-[#f187b5]/20"
                        value={variationName}
                        onChange={(e) => onVariationNameChange(e.target.value)}
                        placeholder="e.g. Scent Name, Material"
                    />
                </div>
            </div>

            {variationType.toLowerCase() === 'color' && (
                <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Select Colors</label>
                    <div className="flex flex-col sm:flex-row gap-2 mb-3 max-w-lg items-center">
                        <input
                            type="color"
                            className="w-10 h-10 p-1 border border-neutral-300 rounded cursor-pointer shrink-0"
                            value={colorInput.code}
                            onChange={(e) => setColorInput(prev => ({...prev, code: e.target.value}))}
                        />
                        <input
                            type="text"
                            placeholder="Color Name (e.g. Red, Forest Green)"
                            className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[#f187b5]"
                            value={colorInput.name}
                            onChange={(e) => {
                                const name = e.target.value;
                                setColorInput(prev => ({ ...prev, name }));
                                if (name.trim()) {
                                    const s = new Option().style;
                                    s.color = name.trim().toLowerCase();
                                    if (s.color) {
                                        // A simple check to see if the color is valid
                                        // We can use a canvas to get the hex code
                                        const ctx = document.createElement('canvas').getContext('2d');
                                        if (ctx) {
                                            ctx.fillStyle = name.trim().toLowerCase();
                                            const hex = ctx.fillStyle;
                                            if (hex && hex.startsWith('#')) {
                                                setColorInput(prev => ({ ...prev, code: hex }));
                                            }
                                        }
                                    }
                                }
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                if(!colorInput.name.trim()) return;
                                if(!selectedColors.some(c => c.name === colorInput.name.trim())) {
                                    const newName = colorInput.name.trim();
                                    const newCode = colorInput.code;
                                    setSelectedColors([...selectedColors, { name: newName, code: newCode }]);

                                    // Add to table if not exists
                                    if (!localVariations.some(v => v.value === newName || v[variationType] === newName || v.Color === newName)) {
                                        setLocalVariations([...localVariations, {
                                            id: `new-${Date.now()}`,
                                            Color: newName,
                                            value: newName,
                                            name: 'Color',
                                            colorCode: newCode,
                                            price: '',
                                            stock: ''
                                        }]);
                                    }
                                    setColorInput({ name: "", code: "#000000" });
                                }
                            }}
                            className="px-4 py-2 bg-[#f187b5]/10 text-[#f187b5] border border-[#f187b5]/20 rounded hover:bg-[#f187b5]/20 text-sm font-medium transition-all"
                        >Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedColors.map((color: any) => (
                            <span key={color.name} className="px-3 py-1 bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-full text-xs font-medium flex items-center gap-2 shadow-sm">
                                <span className="w-3 h-3 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: color.code }}></span>
                                {color.name}
                                <button type="button" onClick={() => setSelectedColors((prev: any) => prev.filter((c: any) => c.name !== color.name))} className="text-neutral-400 hover:text-[var(--customer-primary)] font-bold focus:outline-none tracking-tighter">&times;</button>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Info */}
        <div className="bg-[var(--customer-primary-alpha-10)] px-6 py-2 text-xs text-blue-700 border-b border-blue-100 flex items-center gap-2">
            <span className="font-bold">Attributes:</span>
            {selectedAttributes.length > 0 ? (
                <div className="flex gap-1">
                    {selectedAttributes.map(attr => (
                        <span key={attr} className="bg-[var(--customer-primary-alpha-20)] px-2 py-0.5 rounded border border-blue-200">{attr}</span>
                    ))}
                </div>
            ) : (
                <span className="italic text-gray-500">No attributes selected (Default variation)</span>
            )}
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                {selectedAttributes.map(attr => (
                    <th key={attr} className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 min-w-[120px]">{attr}</th>
                ))}
                {selectedAttributes.length === 0 && <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 min-w-[120px]">{variationName || "Value"}</th>}
                <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-24">MRP</th>
                <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-24">Selling Price</th>
                <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-24">Online Offer Price</th>
                <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-24">Wholesale Price</th>
                <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-20">Stock</th>
                <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 w-32">SKU</th>
                <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 min-w-[150px]">Barcodes</th>
                <th className="p-3 text-center border-b border-gray-200 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {localVariations.map((v, index) => (
                <tr key={v.id} className="group hover:bg-gray-50 border-b border-gray-100 last:border-none duration-150">
                    {/* Attribute Inputs */}
                    {selectedAttributes.map(attr => (
                        <td key={attr} className="p-2">
                            <div className="flex items-center gap-2">
                                {attr.toLowerCase() === 'color' && v.colorCode && (
                                    <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: v.colorCode }} />
                                )}
                                <input
                                    type="text"
                                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] text-sm"
                                    placeholder={`Enter ${attr}`}
                                    value={v[attr] || ''}
                                    onChange={(e) => {
                                        handleChange(index, attr, e.target.value);
                                        if (attr.toLowerCase() === 'color') handleChange(index, 'value', e.target.value);
                                    }}
                                />
                            </div>
                        </td>
                    ))}
                    {selectedAttributes.length === 0 && (
                        <td className="p-2">
                             <div className="flex items-center gap-2">
                                {variationType.toLowerCase() === 'color' && v.colorCode && (
                                    <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: v.colorCode }} />
                                )}
                                <input
                                    type="text"
                                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] text-sm"
                                    placeholder="Value"
                                    value={v.value || ''}
                                    onChange={(e) => handleChange(index, 'value', e.target.value)}
                                />
                             </div>
                        </td>
                    )}

                    {/* Standard Fields */}
                    <td className="p-2">
                        <input type="number" className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] text-sm" value={v.mrp} onChange={(e) => handleChange(index, 'mrp', e.target.value)} placeholder="0" />
                    </td>
                    <td className="p-2">
                        <input type="number" className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] text-sm font-medium" value={v.price} onChange={(e) => handleChange(index, 'price', e.target.value)} placeholder="0" />
                    </td>
                    <td className="p-2">
                         <input type="number" className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] text-sm" value={v.offerPrice} onChange={(e) => handleChange(index, 'offerPrice', e.target.value)} placeholder="0" />
                    </td>
                    <td className="p-2">
                         <input type="number" className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] text-sm" value={v.wholesalePrice} onChange={(e) => handleChange(index, 'wholesalePrice', e.target.value)} placeholder="0" />
                    </td>
                    <td className="p-2">
                         <input type="number" className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] text-sm" value={v.stock} onChange={(e) => handleChange(index, 'stock', e.target.value)} placeholder="0" />
                    </td>
                    <td className="p-2">
                         <input type="text" className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] text-sm" value={v.sku} onChange={(e) => handleChange(index, 'sku', e.target.value)} placeholder="SKU" />
                    </td>
                    <td className="p-2">
                        <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap gap-1 mb-1">
                                {(v.barcode || []).map(b => (
                                    <span key={b} className="bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded text-[10px] border border-pink-100 flex items-center gap-1 group/chip">
                                        {b}
                                        <button onClick={() => {
                                            const newBarcodes = (v.barcode || []).filter(item => item !== b);
                                            handleChange(index, 'barcode', newBarcodes);
                                        }} className="text-pink-400 hover:text-[var(--customer-primary)] transition-colors">&times;</button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-1">
                                <input
                                    type="text"
                                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#f187b5] focus:outline-none"
                                    placeholder="Add barcode"
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = (e.currentTarget as HTMLInputElement).value.trim();
                                            if (!val) return;

                                            if ((v.barcode || []).includes(val)) {
                                                alert("This barcode is already added to this variant");
                                                return;
                                            }

                                            const otherBarcodes = localVariations.flatMap((varItem, idx) => {
                                                if (idx === index) return [];
                                                return varItem.barcode || [];
                                            });
                                            if (otherBarcodes.includes(val)) {
                                                alert(`Barcode "${val}" is already used on another variant in this editor`);
                                                return;
                                            }

                                            try {
                                                const isAdmin = window.location.pathname.includes("/admin");
                                                const endpoint = isAdmin ? "/admin/products/check-barcode" : "/products/check-barcode";
                                                
                                                const pathParts = window.location.pathname.split("/");
                                                const productId = pathParts[pathParts.length - 1];

                                                const response = await api.get(endpoint, {
                                                    params: {
                                                        barcode: val,
                                                        productId: /^[a-fA-F0-9]{24}$/.test(productId) ? productId : undefined
                                                    }
                                                });

                                                if (response.data.success && !response.data.isUnique) {
                                                    alert(response.data.message || `Barcode "${val}" is already in use`);
                                                    return;
                                                }
                                            } catch (err: any) {
                                                console.error("Failed to verify barcode uniqueness", err);
                                            }

                                            handleChange(index, 'barcode', [...(v.barcode || []), val]);
                                            (e.currentTarget as HTMLInputElement).value = '';
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => handleAutoGenerateBarcode(index)}
                                    className="p-1.5 bg-pink-50 border border-pink-100 rounded text-[#f187b5] hover:bg-pink-100 transition-colors"
                                    title="Auto Generate"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                </button>
                                <button
                                    onClick={() => startScanning(index)}
                                    className="p-1.5 bg-pink-50 border border-pink-100 rounded text-[#f187b5] hover:bg-pink-100 transition-colors"
                                    title="Scan Barcode"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"></path></svg>
                                </button>
                            </div>
                        </div>
                    </td>
                    <td className="p-2 text-center">
                        <button onClick={() => removeRow(index)} className="text-gray-400 hover:text-[var(--customer-primary-dark)] transition-colors p-1" title="Remove Variation">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={addRow} className="mt-4 flex items-center gap-2 text-[#f187b5] font-semibold text-sm hover:bg-pink-50 px-3 py-2 rounded transition-colors">
            <span className="text-lg leading-none">+</span> Add Variation
          </button>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button onClick={onClose} className="px-5 py-2 text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100 font-medium transition-colors text-sm">Cancel</button>
          <button onClick={handleSave} className="px-5 py-2 bg-[#f187b5] text-white rounded hover:bg-[#e076a5] font-medium shadow-sm transition-colors text-sm">Save Variations</button>
        </div>
      </div>
      {isScanning && (
        <QRScannerModal
            onClose={stopScanning}
            onScanSuccess={onScanSuccess}
        />
      )}
    </div>
  );
};

export default VariationEditor;
