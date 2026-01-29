import { useState, useEffect, useRef } from 'react';
import { bannerService } from '../../../services/bannerService';
import { getProducts } from '../../../services/api/admin/adminProductService';
import { Product } from '../../../types/domain';

export default function AdminFlashDeal() {
  const [config, setConfig] = useState<any>({
    flashDealTargetDate: '',
    isActive: true,
    flashDealProductIds: [] // Flash Deal specific products
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Product Selection States
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchConfig = async () => {
        try {
            const data = await bannerService.getDealsConfig();
            setConfig(data);
            if (data.flashDealImage) {
                setPreviewUrl(data.flashDealImage);
            }

            // Load selected product objects
            const ids = data.flashDealProductIds || [];
            if (ids.length > 0) {
                 const res = await getProducts({ limit: 100 });
                 if (res.success && res.data) {
                     const allProducts = (res.data as any).products || res.data;
                     const found = allProducts.filter((p: any) => ids.includes(p._id || p.id));
                     setSelectedProducts(found);
                 }
            }
        } catch (error) {
            console.error("Error fetching flash deal config:", error);
        }
    };
    fetchConfig();
  }, []);

  // Search Products
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

  const getLocalDate = (isoString: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getLocalTime = (isoString: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleDateChange = (date: string) => {
    const time = getLocalTime(config.flashDealTargetDate) || '00:00';
    if (date) {
        setConfig({ ...config, flashDealTargetDate: new Date(`${date}T${time}`).toISOString() });
    }
  };

  const handleTimeChange = (time: string) => {
    const date = getLocalDate(config.flashDealTargetDate) || getLocalDate(new Date().toISOString());
    if (time) {
        setConfig({ ...config, flashDealTargetDate: new Date(`${date}T${time}`).toISOString() });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
      }
  };

  const handleAddProduct = (product: Product) => {
      const currentIds = config.flashDealProductIds || [];
      const productId = product._id || product.id;

      if (!currentIds.includes(productId)) {
          const newIds = [...currentIds, productId];
          setConfig({ ...config, flashDealProductIds: newIds });
          setSelectedProducts([...selectedProducts, product]);
      }
  };

  const handleRemoveProduct = (productId: string) => {
      const currentIds = config.flashDealProductIds || [];
      const newIds = currentIds.filter((id: string) => id !== productId);
      setConfig({ ...config, flashDealProductIds: newIds });
      setSelectedProducts(selectedProducts.filter(p => (p._id || p.id) !== productId));
  };

  const handleSave = async () => {
    setLoading(true);
    let imageUrl = config.flashDealImage;

    if (selectedFile) {
        // Convert to Base64
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        await new Promise((resolve) => {
            reader.onload = () => {
                imageUrl = reader.result as string;
                resolve(true);
            };
        });
    }

    bannerService.updateDealsConfig({
        flashDealTargetDate: config.flashDealTargetDate,
        flashDealImage: imageUrl,
        isActive: config.isActive,
        flashDealProductIds: config.flashDealProductIds
    });

    setTimeout(() => {
        setLoading(false);
        setMessage('Flash Deal settings updated successfully!');
        setTimeout(() => setMessage(''), 3000);
    }, 500);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-black text-gray-800 tracking-tight">FLASH DEALS SETUP</h1>
           <div className="text-sm font-medium text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm border">Promotion / Flash Deals</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">⚙️</span>
                    General Settings
                </h2>

                <label className="flex items-center gap-3 mb-6 p-4 bg-orange-50/50 border border-orange-100 rounded-xl cursor-pointer hover:bg-orange-100/50 transition-colors">
                    <input
                        type="checkbox"
                        className="w-5 h-5 accent-[#E65100]"
                        checked={config.isActive ?? true}
                        onChange={(e) => setConfig({ ...config, isActive: e.target.checked })}
                    />
                    <span className="text-gray-700 font-bold uppercase tracking-wider text-xs">Enable Flash Deal Section</span>
                </label>

                <div className="space-y-4 mb-6">
                    <label className="block">
                        <span className="text-gray-600 font-bold text-[10px] uppercase tracking-widest mb-1.5 block">End Date</span>
                        <input
                            type="date"
                            className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#E65100]/20 focus:border-[#E65100] outline-none transition-all font-medium"
                            value={getLocalDate(config.flashDealTargetDate)}
                            onChange={(e) => handleDateChange(e.target.value)}
                        />
                    </label>
                    <label className="block">
                        <span className="text-gray-600 font-bold text-[10px] uppercase tracking-widest mb-1.5 block">End Time</span>
                        <input
                            type="time"
                            className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#E65100]/20 focus:border-[#E65100] outline-none transition-all font-medium"
                            value={getLocalTime(config.flashDealTargetDate)}
                            onChange={(e) => handleTimeChange(e.target.value)}
                        />
                    </label>
                </div>

                <div className="mb-6">
                    <span className="text-gray-600 font-bold text-[10px] uppercase tracking-widest mb-1.5 block">Banner Image</span>
                    <div className="space-y-4">
                        <label className="cursor-pointer bg-neutral-50 hover:bg-neutral-100 border-2 border-dashed border-gray-200 text-gray-700 p-6 rounded-2xl block text-center transition-all group overflow-hidden relative">
                             <div className="relative z-10">
                                <span className="block text-2xl mb-2 group-hover:scale-110 transition-transform">🖼️</span>
                                <span className="block text-sm font-bold text-gray-600">Click to upload image</span>
                                <span className="text-[10px] text-gray-400 font-medium">JPG, PNG supported</span>
                             </div>
                             <input
                                 type="file"
                                 ref={fileInputRef}
                                 className="hidden"
                                 accept="image/*"
                                 onChange={handleFileChange}
                             />
                             {previewUrl && (
                                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                             )}
                        </label>
                        {previewUrl && (
                            <div className="relative group aspect-video rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-white text-gray-900 px-4 py-2 rounded-full text-xs font-bold shadow-lg"
                                    >Change Image</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-[#E65100] text-white p-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#EF6C00] disabled:opacity-70 shadow-lg shadow-orange-200 transition-all active:scale-[0.98]"
                >
                    {loading ? 'Saving Settings...' : 'Save All Changes'}
                </button>

                {message && (
                    <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-xl text-xs font-bold text-center border border-green-100 animate-in fade-in slide-in-from-top-2">
                        🎉 {message}
                    </div>
                )}
              </div>
          </div>

          {/* Product Selection Panels */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Library */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 flex flex-col h-[700px]">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">📦</span>
                    Product Library
                </h2>
                <div className="relative mb-4">
                     <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>

                <div className="flex-1 overflow-y-auto border border-neutral-50 rounded-xl scrollbar-hide">
                    {products.length > 0 ? (
                        products.map(p => {
                            const isSelected = (config.flashDealProductIds || []).includes(p._id || p.id);
                            return (
                                <div
                                    key={p._id || p.id}
                                    onClick={() => !isSelected && handleAddProduct(p)}
                                    className={`p-3 border-b border-neutral-50 flex items-center gap-3 cursor-pointer transition-all ${isSelected ? 'bg-neutral-50 opacity-40 cursor-not-allowed' : 'hover:bg-blue-50'}`}
                                >
                                    <div className="w-12 h-12 flex-shrink-0 bg-white border border-neutral-100 rounded-lg overflow-hidden">
                                        <img src={p.mainImage || p.imageUrl || 'https://via.placeholder.com/40'} className="w-full h-full object-contain" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-800 line-clamp-1">{p.productName || p.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs font-black text-gray-900">₹{(p as any).salePrice || p.price}</span>
                                            {(p as any).discount > 0 && <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 rounded">-{(p as any).discount}%</span>}
                                        </div>
                                    </div>
                                    <button
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-neutral-200 text-white' : 'bg-blue-600 text-white shadow-md shadow-blue-100 hover:scale-110 active:scale-90'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                            <span className="text-4xl mb-4">🔍</span>
                            <p className="font-bold text-sm">No products found</p>
                        </div>
                    )}
                </div>
              </div>

              {/* Selected Deals */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 flex flex-col h-[700px]">
                 <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">🔥</span>
                    Selected Deals ({selectedProducts.length})
                </h2>

                 <div className="flex-1 overflow-y-auto border border-neutral-50 rounded-xl p-3 bg-neutral-50/50 scrollbar-hide">
                     {selectedProducts.length > 0 ? (
                         <div className="space-y-3">
                             {selectedProducts.map((p, index) => (
                                 <div key={(p._id || p.id) + index} className="bg-white p-3 rounded-2xl shadow-sm border border-neutral-100 flex items-center gap-4 group relative">
                                      <div className="w-16 h-16 flex-shrink-0 bg-white border border-neutral-100 rounded-xl overflow-hidden p-1">
                                         <img src={p.mainImage || p.imageUrl} className="w-full h-full object-contain" alt="" />
                                      </div>

                                      <div className="flex-1 min-w-0">
                                          <h3 className="font-bold text-gray-800 text-sm line-clamp-1 pr-6">{p.productName || p.name}</h3>
                                          <div className="flex items-center gap-2 mt-1">
                                              <p className="text-[#E65100] font-black text-sm">₹{(p as any).salePrice || p.price}</p>
                                              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                                          </div>
                                      </div>

                                      <button
                                        onClick={() => handleRemoveProduct(p._id || p.id)}
                                        className="absolute -top-2 -right-2 w-7 h-7 bg-white text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full shadow-md border border-neutral-100 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
                                      >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                 </div>
                             ))}
                         </div>
                     ) : (
                         <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-neutral-200 rounded-2xl p-6">
                             <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4 text-3xl">🔥</div>
                             <p className="font-bold text-sm text-center">No deals selected.<br/><span className="text-[11px] font-normal">Add products from the library.</span></p>
                         </div>
                     )}
                 </div>
              </div>
          </div>
      </div>
    </div>
  );
}
