import React, { useState, useEffect, useCallback } from 'react';
import { getProducts, Product } from '../../../services/api/admin/adminProductService';
import {
  FreeGiftRule,
  FreeGiftDiscountType,
  FreeGiftRuleType,
  getFreeGiftRules,
  createFreeGiftRule,
  updateFreeGiftRule,
  deleteFreeGiftRule
} from '../../../services/api/admin/freeGiftService';
import { getRuleRewardLabel } from '../../../utils/freeGiftRuleUtils';

export default function AdminFreeGiftRules() {
  const [rules, setRules] = useState<FreeGiftRule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FreeGiftRule | null>(null);

  const [minCartValue, setMinCartValue] = useState<number>(0);
  const [ruleType, setRuleType] = useState<FreeGiftRuleType>('free_gift');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductName, setSelectedProductName] = useState<string>('');
  const [discountType, setDiscountType] = useState<FreeGiftDiscountType>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  useEffect(() => {
    loadRules();
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

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setProductResults([]);
      return;
    }
    setIsSearchingProducts(true);
    try {
      const response = await getProducts({ search: query, limit: 20, status: 'Active' });
      if (response.success && response.data) {
        setProductResults(response.data);
      } else {
        setProductResults([]);
      }
    } catch (error) {
      console.error('Failed to search products', error);
      setProductResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const debounce = (func: (arg: string) => void, wait: number) => {
    let timeout: ReturnType<typeof setTimeout>;
    return (arg: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(arg), wait);
    };
  };

  const debouncedSearch = useCallback(debounce((query: string) => searchProducts(query), 400), []);

  useEffect(() => {
    if (isModalOpen && ruleType === 'free_gift') {
      debouncedSearch(productSearchTerm);
    }
  }, [productSearchTerm, isModalOpen, ruleType, debouncedSearch]);

  const resetForm = () => {
    setMinCartValue(0);
    setRuleType('free_gift');
    setSelectedProductId('');
    setSelectedProductName('');
    setDiscountType('fixed');
    setDiscountValue(0);
    setStatus('Active');
    setProductSearchTerm('');
    setProductResults([]);
  };

  const handleOpenModal = (rule?: FreeGiftRule) => {
    if (rule) {
      setEditingRule(rule);
      setMinCartValue(rule.minCartValue);
      setRuleType(rule.ruleType === 'discount' ? 'discount' : 'free_gift');
      setSelectedProductId(rule.giftProductId || '');
      setSelectedProductName(rule.giftProduct?.productName || rule.giftProduct?.name || '');
      setDiscountType(rule.discountType || 'fixed');
      setDiscountValue(Number(rule.discountValue || 0));
      setStatus(rule.status);
      setProductSearchTerm('');
      setProductResults([]);
    } else {
      setEditingRule(null);
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (minCartValue <= 0) {
      alert('Please enter a valid minimum cart value.');
      return;
    }

    if (ruleType === 'free_gift' && !selectedProductId) {
      alert('Please search and select a gift product.');
      return;
    }

    if (ruleType === 'discount') {
      if (!discountValue || discountValue <= 0) {
        alert('Please enter a valid discount value.');
        return;
      }
      if (discountType === 'percentage' && discountValue > 100) {
        alert('Percentage discount cannot exceed 100%.');
        return;
      }
    }

    const ruleData = {
      minCartValue,
      ruleType,
      giftProductId: ruleType === 'free_gift' ? selectedProductId : undefined,
      discountType: ruleType === 'discount' ? discountType : undefined,
      discountValue: ruleType === 'discount' ? discountValue : undefined,
      status,
    };

    try {
      if (editingRule) {
        await updateFreeGiftRule(editingRule._id || editingRule.id, ruleData);
      } else {
        await createFreeGiftRule(ruleData);
      }
      loadRules();
      setIsModalOpen(false);
    } catch (e: any) {
      alert(e?.message || 'Failed to save rule');
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      try {
        await deleteFreeGiftRule(id);
        loadRules();
      } catch (e) {
        console.error(e);
        alert('Failed to delete');
      }
    }
  };

  const renderRewardCell = (rule: FreeGiftRule) => {
    if (rule.ruleType === 'discount') {
      return (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {getRuleRewardLabel(rule)}
        </span>
      );
    }

    return (
      <div className="flex items-center gap-3 min-w-max">
        {rule.giftProduct?.mainImage && (
          <img src={rule.giftProduct.mainImage} alt="" className="w-10 h-10 object-cover rounded" />
        )}
        <span className="truncate max-w-[150px] md:max-w-xs block">
          {rule.giftProduct?.productName || 'Unknown Product'}
        </span>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cart Reward Rules</h1>
          <p className="text-sm text-gray-500 mt-1">Create free gift or discount rewards based on cart value.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[var(--primary-color)] text-white px-4 py-2 rounded hover:bg-[var(--primary-dark)] transition flex items-center gap-2"
        >
          <span>+</span> Add New Rule
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Min Cart Value</th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Rule Type</th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Reward</th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Status</th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No rules found. Add one to get started.</td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule._id || rule.id} className="hover:bg-gray-50">
                  <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-900 whitespace-nowrap">₹{rule.minCartValue}</td>
                  <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-gray-700 capitalize">
                    {rule.ruleType === 'discount' ? 'Discount' : 'Free Gift'}
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-gray-700">{renderRewardCell(rule)}</td>
                  <td className="px-3 md:px-6 py-3 md:py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${rule.status === 'Active' ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'bg-gray-100 text-gray-800'}`}>
                      {rule.status}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 text-sm whitespace-nowrap">
                    <button onClick={() => handleOpenModal(rule)} className="text-[var(--primary-color)] hover:underline mr-3">Edit</button>
                    <button onClick={() => handleDelete(rule._id || rule.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">{editingRule ? 'Edit Cart Reward Rule' : 'Add Cart Reward Rule'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Cart Value (₹)</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                  value={minCartValue || ''}
                  onChange={(e) => setMinCartValue(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Type</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as FreeGiftRuleType)}
                >
                  <option value="free_gift">Free Gift Product</option>
                  <option value="discount">Cart Discount</option>
                </select>
              </div>

              {ruleType === 'free_gift' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Gift Product</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none mb-2"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    placeholder="Type product name, SKU, etc."
                  />
                  <div className="border border-gray-300 rounded max-h-48 overflow-y-auto bg-white">
                    {isSearchingProducts ? (
                      <p className="text-sm text-gray-400 p-3 text-center">Searching...</p>
                    ) : productResults.length === 0 ? (
                      <p className="text-sm text-gray-400 p-3 text-center">
                        {productSearchTerm ? 'No products found' : 'Start typing to search products'}
                      </p>
                    ) : (
                      productResults.map((product) => (
                        <button
                          key={product._id}
                          type="button"
                          onClick={() => {
                            setSelectedProductId(product._id);
                            setSelectedProductName(product.productName);
                            setProductSearchTerm('');
                            setProductResults([]);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                            selectedProductId === product._id ? 'bg-[var(--primary-color)]/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {product.mainImage && (
                              <img src={product.mainImage} alt="" className="w-8 h-8 rounded object-cover" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{product.productName}</div>
                              <div className="text-xs text-gray-500">₹{product.price}</div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  {selectedProductId && (
                    <p className="text-xs text-[var(--primary-color)] mt-2">
                      Selected: {selectedProductName || 'Product selected'}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Gift product price is automatically treated as ₹0 in cart.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                    <select
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as FreeGiftDiscountType)}
                    >
                      <option value="fixed">Flat Amount (₹)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-lg sticky bottom-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[var(--primary-color)] text-white rounded hover:bg-[var(--primary-dark)]"
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
