import { useState, useEffect } from "react";
import {
  Banner,
  BannerPosition,
  BANNER_POSITIONS,
  RedirectType
} from "../../../types/banner";
import { bannerService } from "../../../services/bannerService";

export default function AdminBannerManagement() {
  const [activePosition, setActivePosition] = useState<BannerPosition>('HOME_MAIN_SLIDER');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Banner>>({
    position: 'HOME_MAIN_SLIDER',
    title: '',
    subtitle: '',
    image: '',
    redirectType: 'NONE',
    redirectValue: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
    priority: 1
  });

  useEffect(() => {
    loadBanners();
  }, [activePosition]);

  const loadBanners = async () => {
    try {
      const data = await bannerService.getBannersByPosition(activePosition);
      setBanners(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load banners", error);
      setBanners([]);
    }
  };

  const handleOpenModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        ...banner,
        startDate: typeof banner.startDate === 'string' ? banner.startDate.split('T')[0] : '',
        endDate: typeof banner.endDate === 'string' ? banner.endDate.split('T')[0] : ''
      });
    } else {
      setEditingBanner(null);
      setFormData({
        position: activePosition,
        title: '',
        subtitle: '',
        image: '',
        redirectType: 'NONE',
        redirectValue: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isActive: true,
        priority: banners.length + 1
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title) {
      alert("Title is required");
      return;
    }

    const bannerData = {
      ...formData,
      position: activePosition,
      startDate: new Date(formData.startDate as string).toISOString(),
      endDate: new Date(formData.endDate as string).toISOString(),
    } as any;

    try {
      if (editingBanner) {
        await bannerService.updateBanner(editingBanner.id, bannerData);
      } else {
        await bannerService.addBanner(bannerData);
      }

      setIsModalOpen(false);
      loadBanners();
    } catch (error) {
      console.error("Failed to save banner", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this banner?")) {
      try {
        await bannerService.deleteBanner(id);
        loadBanners();
      } catch (error) {
        console.error("Failed to delete banner", error);
      }
    }
  };

  const handleToggleStatus = async (id: string) => {
    // Assuming there's a toggle method or we update the banner
    // Check if toggleBannerStatus exists in service, if not use update
    // The previous code had toggleBannerStatus, checking service definition again...
    // Service definition at Step 37 does NOT have toggleBannerStatus.
    // So I need to implement it using update.

    // I need to find the banner first
    const banner = banners.find(b => b.id === id);
    if (banner) {
        try {
            await bannerService.updateBanner(id, { isActive: !banner.isActive });
            loadBanners();
        } catch (error) {
            console.error("Failed to toggle status", error);
        }
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Banner Management</h1>
          <p className="text-sm text-gray-600">Manage promotional content and sliders</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add {BANNER_POSITIONS[activePosition]}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 mb-6 gap-2 no-scrollbar">
        {(Object.keys(BANNER_POSITIONS) as BannerPosition[]).map((pos) => (
          <button
            key={pos}
            onClick={() => setActivePosition(pos)}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
              activePosition === pos
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {BANNER_POSITIONS[pos]}
          </button>
        ))}
      </div>

      {/* Banner List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banners.map((banner) => (
          <div key={banner.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group">
            <div className="relative h-40 bg-gray-100">
              {banner.image ? (
                <img
                  src={banner.image}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <span className="text-sm">No Image</span>
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => handleOpenModal(banner)}
                  className="p-1.5 bg-white rounded-full shadow hover:text-blue-600 text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="p-1.5 bg-white rounded-full shadow hover:text-red-600 text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="absolute top-2 left-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  banner.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {banner.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-1">{banner.title}</h3>
              {banner.subtitle && (
                <p className="text-sm text-gray-500 mb-2 truncate">{banner.subtitle}</p>
              )}

              <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
                 <span>Priority: {banner.priority}</span>
                 <button
                  onClick={() => handleToggleStatus(banner.id)}
                  className={`text-sm font-medium ${
                    banner.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                  }`}
                 >
                   {banner.isActive ? 'Deactivate' : 'Activate'}
                 </button>
              </div>
            </div>
          </div>
        ))}

        {banners.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
             <p>No banners here. Add one to see it on the home page!</p>
          </div>
        )}
      </div>

      {/* Modal Reused from previous step */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">
                {editingBanner ? 'Edit Banner' : 'New Banner'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">✕</button>
            </div>
            <div className="p-6 space-y-4">
                {/* Form fields same as before... */}
                <div className="grid grid-cols-1 gap-4">
                    <input type="text" placeholder="Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border p-2 rounded" />
                    <input type="text" placeholder="Subtitle" value={formData.subtitle} onChange={e => setFormData({...formData, subtitle: e.target.value})} className="w-full border p-2 rounded" />
                    <input type="text" placeholder="Image URL (Unsplash works great)" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="w-full border p-2 rounded" />
                    {formData.image && <img src={formData.image} className="h-32 object-cover rounded" />}

                    <div className="grid grid-cols-2 gap-4">
                        <select value={formData.redirectType} onChange={e => setFormData({...formData, redirectType: e.target.value as RedirectType})} className="border p-2 rounded">
                            <option value="NONE">No Redirect</option>
                            <option value="URL">External URL</option>
                        </select>
                        <input type="number" placeholder="Priority" value={formData.priority} onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})} className="border p-2 rounded" />
                    </div>
                </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
