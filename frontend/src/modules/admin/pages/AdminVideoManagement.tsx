import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../../context/ToastContext';
import {
  getVideoFinds,
  createVideoFind,
  updateVideoFind,
  deleteVideoFind,
  uploadVideo,
  VideoFind
} from '../../../services/api/admin/adminVideoService';
import { getProducts, Product } from '../../../services/api/admin/adminProductService';

export default function AdminVideoManagement() {
  const { showToast } = useToast();
  const [videos, setVideos] = useState<VideoFind[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    price: '',
    originalPrice: '',
    videoUrl: '',
    views: '',
    linkedProductId: ''
  });
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ _id: string, productName: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch videos from backend
  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await getVideoFinds();
      if (response.success && response.data) {
        setVideos(response.data);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      showToast('Failed to load videos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
        setProductResults([]);
        return;
    }
    setIsSearchingProducts(true);
    try {
        const response = await getProducts({ search: query, limit: 10 });
        if (response.success && response.data) {
            setProductResults(response.data);
        }
    } catch (error) {
        console.error("Error searching products:", error);
    } finally {
        setIsSearchingProducts(false);
    }
  };

  // Custom debounce implementation
  const debounce = (func: (arg: string) => void, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (arg: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(arg), wait);
    };
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce((query: string) => searchProducts(query), 500), []);

  useEffect(() => {
      if (productSearch && showDropdown) {
          debouncedSearch(productSearch);
      }
  }, [productSearch, showDropdown, debouncedSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProductSelect = (product: Product) => {
      setFormData({
          ...formData,
          linkedProductId: product._id,
          price: product.price.toString(),
          originalPrice: (product.compareAtPrice || product.price).toString()
      });
      setSelectedProduct({ _id: product._id, productName: product.productName });
      setProductSearch(product.productName);
      setShowDropdown(false);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 50 * 1024 * 1024) {
          showToast('File too large. Max 50MB allowed.', 'error');
          return;
      }

      try {
          setUploading(true);
          const response = await uploadVideo(file);
          if (response.success && response.data) {
              setFormData({ ...formData, videoUrl: response.data.url });
              showToast('Video uploaded successfully', 'success');
          } else {
              showToast('Failed to upload video', 'error');
          }
      } catch (error) {
          console.error('Video upload error:', error);
          showToast('Error uploading video', 'error');
      } finally {
          setUploading(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.linkedProductId) {
        showToast('Please select a linked product', 'error');
        return;
    }

    // Map linkedProductId to linkedProduct (backend schema expects linkedProduct)
    const payload: any = {
        title: formData.title,
        price: Number(formData.price),
        originalPrice: Number(formData.originalPrice),
        videoUrl: formData.videoUrl,
        views: formData.views || '0',
        linkedProduct: formData.linkedProductId
    };

    try {
      if (isEditing) {
        const response = await updateVideoFind(isEditing, payload);

        if (response.success) {
          showToast('Video updated successfully', 'success');
          setIsEditing(null);
          resetForm();
          fetchVideos();
        } else {
             showToast('Failed to update video', 'error');
        }
      } else {
        const response = await createVideoFind(payload);

        if (response.success) {
            showToast('Video added successfully', 'success');
            resetForm();
            fetchVideos();
        } else {
            showToast('Failed to add video', 'error');
        }
      }
    } catch (error) {
      console.error('Error saving video:', error);
      showToast('An error occurred', 'error');
    }
  };

  const resetForm = () => {
      setFormData({ title: '', price: '', originalPrice: '', videoUrl: '', views: '', linkedProductId: '' });
      setProductSearch('');
      setSelectedProduct(null);
  }

  const handleEdit = (video: VideoFind) => {
    setFormData({
      title: video.title,
      price: video.price.toString(),
      originalPrice: video.originalPrice.toString(),
      videoUrl: video.videoUrl,
      views: video.views,
      linkedProductId: video.linkedProduct?._id || ''
    });

    if (video.linkedProduct) {
        setSelectedProduct(video.linkedProduct);
        setProductSearch(video.linkedProduct.productName);
    } else {
        setSelectedProduct(null);
        setProductSearch('');
    }

    setIsEditing(video._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      try {
        const response = await deleteVideoFind(id);
        if (response.success || response.data) {
           showToast('Video deleted successfully', 'success');
           fetchVideos();
        }
      } catch (error) {
        console.error('Error deleting video:', error);
        showToast('Failed to delete video', 'error');
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Video Finds Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-4">{isEditing ? 'Edit Video' : 'Add New Video'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Product Title"
                />
              </div>

               {/* Linked Product Search */}
               <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked Product <span className='text-red-500'>*</span></label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Search product to link..."
                />
                {showDropdown && (productSearch.trim().length > 0) && (
                    <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                        {isSearchingProducts ? (
                            <div className="p-3 text-sm text-gray-500">Searching...</div>
                        ) : productResults.length > 0 ? (
                            productResults.map(product => (
                                <div
                                    key={product._id}
                                    className="p-3 hover:bg-blue-50 cursor-pointer text-sm"
                                    onClick={() => handleProductSelect(product)}
                                >
                                    <div className="font-medium">{product.productName}</div>
                                    <div className="text-xs text-gray-500">Price: ₹{product.price}</div>
                                </div>
                            ))
                        ) : (
                            <div className="p-3 text-sm text-gray-500">No products found</div>
                        )}
                        <div
                            className="bg-gray-50 p-2 text-xs text-center text-gray-500 border-t cursor-pointer hover:bg-gray-100"
                            onClick={() => setShowDropdown(false)}
                        >
                            Close
                        </div>
                    </div>
                )}
                {selectedProduct && (
                    <div className="mt-1 text-xs text-green-600 font-medium">
                        Linked: {selectedProduct.productName}
                    </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    readOnly
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none cursor-not-allowed"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    name="originalPrice"
                    value={formData.originalPrice}
                    onChange={handleChange}
                    required
                    readOnly
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none cursor-not-allowed"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video Upload</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors relative">
                    <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={handleVideoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploading}
                    />
                    {uploading ? (
                         <div className="flex flex-col items-center">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                            <span className="text-sm text-gray-500">Uploading Video...</span>
                        </div>
                    ) : formData.videoUrl ? (
                         <div className="flex flex-col items-center">
                            <div className="text-green-500 mb-1">
                                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <span className="text-sm font-medium text-gray-900 truncate max-w-full px-2">Video Uploaded!</span>
                            <span className="text-xs text-gray-500 mt-1 truncate max-w-full px-2">{formData.videoUrl.split('/').pop()}</span>
                            <span className="text-xs text-blue-600 mt-2 font-medium">Click to replace</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="text-gray-400 mb-2">
                                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                            </div>
                            <span className="text-sm text-gray-500">Click to upload video (MP4)</span>
                            <span className="text-xs text-gray-400 mt-1">Max 50MB</span>
                        </div>
                    )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Views Count</label>
                <input
                  type="text"
                  name="views"
                  value={formData.views}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. 1.5K"
                />
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  disabled={loading || uploading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300"
                >
                  {isEditing ? 'Update Video' : 'Add Video'}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                        setIsEditing(null);
                        resetForm();
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-700">Existing Videos ({videos.length})</h3>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {loading ? (
                  <div className="p-8 text-center text-gray-500">Loading videos...</div>
              ) : videos.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No videos added yet.</div>
              ) : (
                  videos.map((video) => (
                    <div key={video._id} className="p-4 flex gap-3 sm:gap-4 hover:bg-gray-50 transition">
                      <div className="w-20 h-28 sm:w-24 sm:h-32 bg-gray-200 rounded-lg overflow-hidden shrink-0 relative group">
                        <video src={video.videoUrl} className="w-full h-full object-cover" muted />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0 self-center">
                        <h4 className="font-semibold text-gray-900 line-clamp-1 text-sm sm:text-base">{video.title}</h4>
                        <div className="flex gap-2 text-xs sm:text-sm mt-1">
                          <span className="font-bold">₹{video.price}</span>
                          <span className="text-gray-400 line-through">₹{video.originalPrice}</span>
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Views: {video.views}</div>
                        {video.linkedProduct && (
                            <div className="text-[10px] sm:text-xs text-blue-600 mt-1 truncate max-w-[180px] sm:max-w-full">
                                🔗 {video.linkedProduct.productName}
                            </div>
                        )}
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate max-w-[150px] sm:max-w-md">{video.videoUrl}</p>
                      </div>
                      <div className="flex flex-col gap-1 sm:gap-2 justify-center shrink-0">
                        <button
                          onClick={() => handleEdit(video)}
                          className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(video._id)}
                          className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
