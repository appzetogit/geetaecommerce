import { useState, useEffect, useRef } from 'react';
import { bannerService } from '../../../services/bannerService';
import { Banner, BannerPosition } from '../../../types/banner';
import { getCategories } from '../../../services/api/categoryService';
import { uploadImage } from '../../../services/api/uploadService';
import { useToast } from '../../../context/ToastContext';

export default function AdminBannerSetup() {
  const { showToast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [bannerType, setBannerType] = useState<BannerPosition>('Main Banner');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);

  useEffect(() => {
    loadBanners();
    fetchCategories();
  }, []);

  const loadBanners = async () => {
    setLoading(true);
    try {
        const allBanners = await bannerService.getAllBanners();
        setBanners(allBanners);
    } catch (error) {
        showToast('Failed to load banners', 'error');
    } finally {
        setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
        const res = await getCategories();
        if (res && res.data) setCategories(res.data);
    } catch (e) { console.error(e); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
          setSelectedFiles(files);
          const urls = files.map(file => URL.createObjectURL(file));
          setPreviewUrls(urls);
      }
  };

  const handleAddBanner = async () => {
    if (!editingBannerId && selectedFiles.length === 0) return showToast("Please select at least one banner image", "error");

    // Limit Main Banner to 5 (only for adding new ones)
    if (!editingBannerId && bannerType === 'Main Banner') {
        const currentMainBanners = banners.filter(b => b.position === 'Main Banner');
        if (currentMainBanners.length + selectedFiles.length > 5) {
            return showToast(`Maximum 5 Main Banners allowed. You currently have ${currentMainBanners.length}.`, "error");
        }
    }

    setLoading(true);

    let resourceId = undefined;
    let resourceName = undefined;
    let resourceType: 'Category' | 'None' = 'None';

    if (selectedCategory) {
        resourceType = 'Category';
        resourceId = selectedCategory;
        const cat = categories.find(c => c._id === selectedCategory);
        resourceName = cat ? cat.name : '';
    } else {
        resourceName = 'No Category Selected';
    }

    try {
        if (editingBannerId) {
            // Handle Update
            let finalImageUrl = banners.find(b => b.id === editingBannerId)?.imageUrl || '';

            if (selectedFiles.length > 0) {
                 const uploadRes = await uploadImage(selectedFiles[0], "banners");
                 finalImageUrl = uploadRes.secureUrl || uploadRes.url;
            }

            await bannerService.updateBanner(editingBannerId, {
                position: bannerType,
                resourceType,
                resourceId,
                resourceName,
                categoryName: resourceName,
                imageUrl: finalImageUrl
            });
            showToast("Banner updated successfully", "success");
            setEditingBannerId(null);
        } else {
            // Handle Add (Multiple)
            for (const file of selectedFiles) {
                const uploadRes = await uploadImage(file, "banners");
                const finalImageUrl = uploadRes.secureUrl || uploadRes.url;

                await bannerService.addBanner({
                    position: bannerType,
                    resourceType,
                    resourceId,
                    resourceName,
                    categoryName: resourceName,
                    imageUrl: finalImageUrl,
                    isActive: true // Default active
                });
            }
            showToast("Banner(s) added successfully", "success");
        }

        // Reset Form
        setSelectedFiles([]);
        setPreviewUrls([]);
        setSelectedCategory('');
        setBannerType('Main Banner');
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Reload List
        loadBanners();
    } catch (e: any) {
        console.error("Error saving banner", e);
        showToast(e.message || "Failed to save banner", "error");
    } finally {
        setLoading(false);
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBannerId(banner.id || null);
    setBannerType(banner.position);
    setSelectedCategory(banner.resourceId || '');
    setPreviewUrls([banner.imageUrl || banner.image || '']);
    setSelectedFiles([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingBannerId(null);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setSelectedCategory('');
    setBannerType('Main Banner');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('Are you sure you want to delete this banner?')) {
        setLoading(true);
        try {
            await bannerService.deleteBanner(id);
            showToast("Banner deleted successfully", "success");
            loadBanners();
        } catch (e) {
            showToast("Failed to delete banner", "error");
            setLoading(false);
        }
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
       <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold text-gray-800">Banner</h1>
           <div className="text-sm text-gray-500">Home / Banner</div>
       </div>

       <div className="flex flex-col lg:flex-row gap-6">

          {/* LEFT: Add Banner Form */}
          <div className="w-full lg:w-1/3">
             <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="bg-[#E65100] text-white px-4 py-3 font-semibold text-lg flex justify-between items-center">
                   {editingBannerId ? 'Edit Banner' : 'Add Banner'}
                   {editingBannerId && (
                       <button onClick={handleCancelEdit} className="text-xs bg-white text-[#E65100] px-2 py-1 rounded hover:bg-gray-100">Cancel</button>
                   )}
                </div>
                <div className="p-6 space-y-5">

                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Banner Type <span className="text-red-500">*</span></label>
                      <select
                        className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:ring-1 focus:ring-[#E65100] bg-white"
                        value={bannerType}
                        onChange={(e) => setBannerType(e.target.value as BannerPosition)}
                      >
                         <option value="Main Banner">Main Banner (Home Slider)</option>
                         <option value="Popup Banner">Popup Banner</option>
                         <option value="Flash Deals">Flash Deals Section Slider</option>
                         <option value="Deal of the Day">Deal of the Day Slider</option>
                         <option value="Main Section Banner">Main Section Banner</option>
                         <option value="Footer Banner">Footer Banner</option>
                      </select>
                   </div>

                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Category</label>
                      <select
                        className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:ring-1 focus:ring-[#E65100] bg-white"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                         <option value="">No Category Selected</option>
                         {categories.map(c => (
                             <option key={c._id} value={c._id}>{c.name}</option>
                         ))}
                      </select>
                   </div>

                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image <span className="text-xs text-gray-400 font-normal ml-1">{bannerType === 'Main Banner' ? '(Max 5 images allowed)' : '(Multiple allowed)'}</span></label>
                      <div className="flex items-center gap-2">
                          <label className={`cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 px-4 py-2 rounded-md transition-colors text-sm font-medium ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                              Choose Files
                              <input
                                  type="file"
                                  ref={fileInputRef}
                                  className="hidden"
                                  accept="image/*"
                                  multiple
                                  onChange={handleFileChange}
                                  disabled={loading}
                              />
                          </label>
                          <span className="text-gray-400 text-sm italic truncate max-w-[150px]">
                              {selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : 'No files chosen'}
                          </span>
                      </div>
                      {previewUrls.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded border">
                              {previewUrls.map((url, idx) => (
                                  <div key={idx} className="relative aspect-video bg-white rounded border overflow-hidden">
                                      <img src={url} alt={`Preview ${idx}`} className="h-full w-full object-contain" />
                                  </div>
                              ))}
                          </div>
                      )}
                   </div>

                   <button
                      onClick={handleAddBanner}
                      disabled={loading}
                      className={`w-full bg-[#E65100] hover:bg-[#EF6C00] text-white font-medium py-2.5 rounded-md transition-colors shadow-sm mt-2 flex justify-center items-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                   >
                      {loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                      ) : (
                          editingBannerId ? 'Update Banner' : 'Add Banner'
                      )}
                   </button>

                </div>
             </div>
          </div>

          {/* RIGHT: View Banner Table */}
          <div className="w-full lg:w-2/3">
             <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                   <h3 className="font-semibold text-gray-700 text-lg">View Banner</h3>
                </div>

                <div className="overflow-x-auto flex-1">
                   {loading && banners.length === 0 ? (
                       <div className="p-8 text-center text-gray-500">Loading banners...</div>
                   ) : (
                       <table className="w-full text-left border-collapse">
                          <thead className="bg-white text-gray-600 text-xs font-bold border-b">
                             <tr>
                                <th className="px-6 py-4">Sr No</th>
                                <th className="px-6 py-4">Category Name</th>
                                <th className="px-6 py-4">Banner Image</th>
                                <th className="px-6 py-4">Action</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                             {banners.map((banner, index) => (
                                 <tr key={banner.id} className="hover:bg-gray-50 group">
                                    <td className="px-6 py-4 text-gray-500 font-medium">{index + 1}</td>
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col">
                                           <span className="text-gray-700 font-medium text-sm">{banner.categoryName || banner.resourceName || 'No Category Selected'}</span>
                                           <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded w-fit mt-1">
                                               {banner.position === 'Main Banner' ? 'Header' :
                                                banner.position === 'Main Section Banner' ? 'Home section' :
                                                banner.position === 'Deal of the Day' ? 'Deal of the day' : banner.position}
                                           </span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="h-12 w-20 bg-gray-50 rounded border overflow-hidden">
                                           <img src={banner.imageUrl || banner.image} alt="" className="h-full w-full object-cover" />
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex items-center gap-2">
                                           <button
                                              onClick={() => handleEdit(banner)}
                                              className="p-1.5 bg-[#E65100] text-white rounded shadow-sm hover:opacity-90"
                                           >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                           </button>
                                           <button
                                              onClick={() => handleDelete(banner.id)}
                                              className="p-1.5 bg-red-600 text-white rounded shadow-sm hover:opacity-90"
                                           >
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                           </button>
                                       </div>
                                    </td>
                                 </tr>
                             ))}
                             {banners.length === 0 && !loading && (
                                 <tr>
                                     <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                         No banners found
                                     </td>
                                 </tr>
                             )}
                          </tbody>
                       </table>
                   )}
                </div>

                {/* Pagination Placeholder */}
                <div className="p-4 border-t text-xs text-gray-500 flex justify-between">
                     <span>Showing 1 to {banners.length} of {banners.length} entries</span>
                     <div className="flex gap-1">
                         <button className="px-2 py-1 border rounded hover:bg-gray-50">Previous</button>
                         <button className="px-2 py-1 border rounded bg-[#E65100] text-white">1</button>
                         <button className="px-2 py-1 border rounded hover:bg-gray-50">Next</button>
                     </div>
                </div>

             </div>
          </div>

       </div>
    </div>
  );
}
