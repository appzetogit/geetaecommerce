import { useState, useEffect } from 'react';
import { bannerService } from '../../../services/bannerService';
import { getProducts } from '../../../services/api/admin/adminProductService';
import { Product } from '../../../types/domain';

export default function AdminDealOfTheDay() {
  const [config, setConfig] = useState<any>({ dealOfTheDayProductIds: [] });
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]); // Store full objects for display
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Initial load
  useEffect(() => {
    const init = async () => {
        try {
            const data = await bannerService.getDealsConfig();
            setConfig(data);

            const ids = data.dealOfTheDayProductIds || [];
            // Support legacy single ID if no array
            // if (ids.length === 0 && data.dealOfTheDayProductId) {
            //      ids.push(data.dealOfTheDayProductId);
            // }

            if (ids.length > 0) {
                 const res = await getProducts({ limit: 100 });
                 if (res.success && res.data) {
                     const allProducts = (res.data as any).products || res.data;
                     const found = allProducts.filter((p: any) => ids.includes(p._id || p.id));
                     setSelectedProducts(found);
                 }
            }
        } catch (error) {
            console.error("Error initializing Deal of the Day:", error);
        }
    };
    init();
  }, []);

  // Fetch product list for dropdown/search
  useEffect(() => {
    const fetchProducts = async () => {
        try {
            const res = await getProducts({ limit: 50, search: search });
            if (res.success && res.data && (res.data as any).products) {
                setProducts((res.data as any).products);
            } else if (Array.isArray(res.data)) {
                setProducts(res.data as any[]);
            }
        } catch (e) {
            console.error(e);
        }
    };
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle Adding a Product
  const handleAddProduct = (product: Product) => {
      const currentIds = config.dealOfTheDayProductIds || [];
      const productId = product._id || product.id;

      if (!currentIds.includes(productId)) {
          const newIds = [...currentIds, productId];
          setConfig({ ...config, dealOfTheDayProductIds: newIds });
          setSelectedProducts([...selectedProducts, product]);
      }
  };

  const handleRemoveProduct = (productId: string) => {
      const currentIds = config.dealOfTheDayProductIds || [];
      const newIds = currentIds.filter(id => id !== productId);
      setConfig({ ...config, dealOfTheDayProductIds: newIds });
      setSelectedProducts(selectedProducts.filter(p => (p._id || p.id) !== productId));
  };

  const handleSave = () => {
    setLoading(true);
    bannerService.updateDealsConfig({
        dealOfTheDayProductIds: config.dealOfTheDayProductIds,
        dealOfTheDayProductId: undefined // Clear legacy single ID to avoid confusion
    });

    setTimeout(() => {
        setLoading(false);
        setMessage('Deal of the Day updated successfully!');
        setTimeout(() => setMessage(''), 3000);
    }, 500);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold text-gray-800">Deal of the Day</h1>
           <div className="text-sm text-gray-500">Promotion / Deal of the Day</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Selection Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 h-[600px] flex flex-col">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Add Products</h2>
            <div className="relative mb-4">
                 <input
                    type="text"
                    placeholder="Search products to add..."
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-[#E65100]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg custom-scrollbar">
                {products.length > 0 ? (
                    products.map(p => {
                        const isSelected = (config.dealOfTheDayProductIds || []).includes(p._id || p.id);
                        return (
                            <div
                                key={p._id || p.id}
                                onClick={() => !isSelected && handleAddProduct(p)}
                                className={`p-3 border-b flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-orange-50 opacity-70 cursor-not-allowed' : 'hover:bg-orange-50'}`}
                            >
                                <img src={p.mainImage || p.imageUrl || 'https://via.placeholder.com/40'} className="w-12 h-12 object-cover rounded bg-white border" alt="" />
                                <div className="flex-1">
                                    <p className="font-medium text-sm text-gray-800 line-clamp-1">{p.productName || p.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs font-bold text-gray-900">₹{(p as any).salePrice || p.price}</span>
                                    </div>
                                </div>
                                {isSelected ? (
                                    <span className="text-xs text-orange-600 font-medium border border-orange-200 px-2 py-0.5 rounded-full">Added</span>
                                ) : (
                                    <button className="text-xs bg-[#E65100] text-white px-3 py-1.5 rounded-full hover:bg-orange-700">Add</button>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <p>No products found</p>
                    </div>
                )}
            </div>
          </div>

          {/* List/Preview Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 flex flex-col h-[600px]">
             <h2 className="text-lg font-semibold mb-4 text-gray-700">Active Deals ({selectedProducts.length})</h2>

             <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg custom-scrollbar p-2 bg-gray-50">
                 {selectedProducts.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {selectedProducts.map((p, index) => (
                             <div key={(p._id || p.id) + index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center relative group">
                                  <button
                                    onClick={() => handleRemoveProduct(p._id || p.id)}
                                    className="absolute top-2 right-2 p-1.5 bg-gray-100 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                                  >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>

                                  <div className="w-32 h-32 mb-4">
                                     <img src={p.mainImage || p.imageUrl} className="w-full h-full object-contain" alt="" />
                                  </div>

                                  <h3 className="font-bold text-gray-800 text-center line-clamp-2 px-2 text-sm h-10">{p.productName || p.name}</h3>
                                  <p className="text-[#E65100] font-bold text-xl mt-2">₹{(p as any).salePrice || p.price}</p>
                                  <span className="mt-2 inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Active Deal</span>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg m-2">
                         <span className="mb-2 text-3xl">🔥</span>
                         <p>No deals selected yet</p>
                     </div>
                 )}
             </div>

             <div className="mt-4 pt-4 border-t">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-[#E65100] text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-70 shadow-sm transition-transform active:scale-[0.99]"
                >
                    {loading ? 'Saving Changes...' : 'Save Deal of the Day'}
                </button>
                {message && (
                    <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm text-center border border-green-100 animate-in fade-in">
                        {message}
                    </div>
                )}
            </div>
          </div>
      </div>
    </div>
  );
}
