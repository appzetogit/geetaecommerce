
import React, { useState, useEffect } from 'react';

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
  // Dynamic attribute values
  [key: string]: any;
}

interface VariationEditorProps {
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  variations: any[]; // Incoming variations
  selectedAttributes: string[]; // e.g. ["Color", "Size"]
  onSave: (newVariations: any[]) => void;
}

const VariationEditor: React.FC<VariationEditorProps> = ({
  productName,
  isOpen,
  onClose,
  variations,
  selectedAttributes,
  onSave,
}) => {
  const [localVariations, setLocalVariations] = useState<Variation[]>([]);

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

      if (mapped.length === 0) {
          // Initialize one empty row if no variations
          const empty: Variation = { id: 'new-1', price: '', stock: '' };
          setLocalVariations([empty]);
      } else {
          setLocalVariations(mapped);
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

        {/* Info */}
        <div className="bg-blue-50 px-6 py-2 text-xs text-blue-700 border-b border-blue-100 flex items-center gap-2">
            <span className="font-bold">Attributes:</span>
            {selectedAttributes.length > 0 ? (
                <div className="flex gap-1">
                    {selectedAttributes.map(attr => (
                        <span key={attr} className="bg-blue-100 px-2 py-0.5 rounded border border-blue-200">{attr}</span>
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
                {selectedAttributes.length === 0 && <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200 min-w-[120px]">Value</th>}
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
                            <input
                                type="text"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] text-sm"
                                placeholder={`Enter ${attr}`}
                                value={v[attr] || ''}
                                onChange={(e) => handleChange(index, attr, e.target.value)}
                            />
                        </td>
                    ))}
                    {selectedAttributes.length === 0 && (
                        <td className="p-2">
                             <input
                                type="text"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] text-sm"
                                placeholder="Value"
                                value={v.value || ''}
                                onChange={(e) => handleChange(index, 'value', e.target.value)}
                            />
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
                            <div className="flex flex-wrap gap-1">
                                {(v.barcode || []).map(b => (
                                    <span key={b} className="bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded text-[10px] border border-pink-100 flex items-center gap-1">
                                        {b}
                                        <button onClick={() => {
                                            const newBarcodes = (v.barcode || []).filter(item => item !== b);
                                            handleChange(index, 'barcode', newBarcodes);
                                        }} className="text-pink-400 hover:text-red-500">&times;</button>
                                    </span>
                                ))}
                            </div>
                            <input
                                type="text"
                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                placeholder="Add barcode"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = (e.currentTarget as HTMLInputElement).value.trim();
                                        if (val && !(v.barcode || []).includes(val)) {
                                            handleChange(index, 'barcode', [...(v.barcode || []), val]);
                                            (e.currentTarget as HTMLInputElement).value = '';
                                        }
                                    }
                                }}
                            />
                        </div>
                    </td>
                    <td className="p-2 text-center">
                        <button onClick={() => removeRow(index)} className="text-gray-400 hover:text-red-600 transition-colors p-1" title="Remove Variation">
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
    </div>
  );
};

export default VariationEditor;
