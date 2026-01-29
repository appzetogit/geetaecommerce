import React, { useState, useEffect } from 'react';
import { getProducts, Product } from '../../../services/api/admin/adminProductService';
import {
  FreeGiftRule,
  getFreeGiftRules,
  createFreeGiftRule,
  updateFreeGiftRule,
  deleteFreeGiftRule
} from '../../../services/api/admin/freeGiftService';

export default function AdminFreeGiftRules() {
  const [rules, setRules] = useState<FreeGiftRule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FreeGiftRule | null>(null);

  // Form State
  const [minCartValue, setMinCartValue] = useState<number>(0);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  // Data for Dropdown
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRules();
    loadProducts();
  }, []);

  const loadRules = async () => {
    try {
      const res = await getFreeGiftRules();
      if (res.success) {
        setRules(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    try {
        const response = await getProducts({ limit: 1000, status: 'Active' });
        if (response.success && response.data) {
            setProducts(response.data);
        }
    } catch (error) {
        console.error("Failed to load products for dropdown", error);
    }
  };

  const handleOpenModal = (rule?: FreeGiftRule) => {
    if (rule) {
      setEditingRule(rule);
      setMinCartValue(rule.minCartValue);
      setSelectedProductId(rule.giftProductId);
      setStatus(rule.status);
    } else {
      setEditingRule(null);
      setMinCartValue(0);
      setSelectedProductId('');
      setStatus('Active');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedProductId || minCartValue <= 0) {
        alert("Please select a product and enter a valid minimum cart value.");
        return;
    }

    const selectedProduct = products.find(p => p._id === selectedProductId);
    if (!selectedProduct) {
        alert("Invalid product selected.");
        return;
    }

    const ruleData = {
        minCartValue,
        giftProductId: selectedProductId,
        giftProduct: selectedProduct, // Pass specific fields if backend needs simplification, but mostly id is enough for ref
        status
    };

    try {
      if (editingRule) {
          await updateFreeGiftRule(editingRule._id || editingRule.id, ruleData);
      } else {
          await createFreeGiftRule(ruleData);
      }
      loadRules();
      setIsModalOpen(false);
    } catch (e) {
      alert("Failed to save rule");
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
      if (confirm("Are you sure you want to delete this rule?")) {
          try {
            await deleteFreeGiftRule(id);
            loadRules();
          } catch(e) {
            console.error(e);
            alert("Failed to delete");
          }
      }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Free Gift Rules</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 transition flex items-center gap-2"
        >
          <span>+</span> Add New Rule
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Min Cart Value</th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Gift Product</th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Status</th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rules.length === 0 ? (
                <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No rules found. Add one to get started.</td>
                </tr>
            ) : (
                rules.map((rule) => (
                    <tr key={rule._id || rule.id} className="hover:bg-gray-50">
                        <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-900 whitespace-nowrap">₹{rule.minCartValue}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-gray-700">
                            <div className="flex items-center gap-3 min-w-max">
                                {(rule.giftProduct as any)?.mainImage && (
                                    <img src={(rule.giftProduct as any).mainImage} alt="" className="w-10 h-10 object-cover rounded" />
                                )}
                                <span className="truncate max-w-[150px] md:max-w-xs block">{(rule.giftProduct as any)?.productName || 'Unknown Product'}</span>
                            </div>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${rule.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {rule.status}
                            </span>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-sm whitespace-nowrap">
                            <button onClick={() => handleOpenModal(rule)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                            <button onClick={() => handleDelete(rule._id || rule.id)} className="text-red-600 hover:text-red-800">Delete</button>
                        </td>
                    </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">{editingRule ? 'Edit Rule' : 'Add Free Gift Rule'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">&times;</button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Cart Value (₹)</label>
                        <input
                            type="number"
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                            value={minCartValue}
                            onChange={(e) => setMinCartValue(parseFloat(e.target.value))}
                            placeholder="e.g. 500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Free Gift Product</label>
                        <select
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                        >
                            <option value="">-- Select Product --</option>
                            {products.map(p => (
                                <option key={p._id} value={p._id}>{p.productName} (₹{p.price})</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Product price will be treated as ₹0 automatically.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                        >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>

                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
                    >
                        Save Rule
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
