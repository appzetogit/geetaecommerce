import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createSeller } from "../../../services/api/admin/adminSellerService";
import { getCategories, Category } from "../../../services/api/admin/adminProductService";
import { toast } from "react-hot-toast";
import GoogleLocationPickerMap from "../components/GoogleLocationPickerMap";
import GoogleMapsAutocomplete from "../../../components/GoogleMapsAutocomplete";

type CommissionSlabInput = {
  minPrice: string;
  maxPrice: string; // empty => no upper limit
  commission: string; // percentage
};

const COMMISSION_SLABS_STORAGE_KEY = "admin_seller_commission_slabs_v1";

const readCommissionSlabsStore = (): Record<string, { minPrice: number; maxPrice: number | null; commission: number }[]> => {
  try {
    const raw = localStorage.getItem(COMMISSION_SLABS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
};

const writeCommissionSlabsStore = (store: Record<string, { minPrice: number; maxPrice: number | null; commission: number }[]>) => {
  try {
    localStorage.setItem(COMMISSION_SLABS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors (private mode/quota)
  }
};

interface FormData {
  // Seller Info
  sellerName: string;
  email: string;
  password: string;
  mobile: string;

  // Store Info
  storeName: string;
  selectCategory: string;
  address: string;
  panCard: string;
  taxName: string;
  taxNumber: string;

  // Store Location Info
  city: string;
  serviceableArea: string;
  searchLocation: string;
  latitude: string;
  longitude: string;

  // Payment Details
  accountName: string;
  bankName: string;
  branch: string;
  accountNumber: string;
  ifsc: string;

  // Document Section
  profile: File | null;
  idProof: File | null;
  addressProof: File | null;

  // Other Info
  requireProductApproval: string;
  viewCustomerDetails: string;
  commission: string;
}

export default function AdminAddSeller() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [useCommissionSlabs, setUseCommissionSlabs] = useState(false);
  const [commissionSlabs, setCommissionSlabs] = useState<CommissionSlabInput[]>([
    { minPrice: "0", maxPrice: "", commission: "" },
  ]);
  const [formData, setFormData] = useState<FormData>({
    sellerName: "",
    email: "",
    password: "",
    mobile: "",
    storeName: "",
    selectCategory: "",
    address: "",
    panCard: "",
    taxName: "",
    taxNumber: "",
    city: "",
    serviceableArea: "",
    searchLocation: "",
    latitude: "",
    longitude: "",
    accountName: "",
    bankName: "",
    branch: "",
    accountNumber: "",
    ifsc: "",
    profile: null,
    idProof: null,
    addressProof: null,
    requireProductApproval: "No",
    viewCustomerDetails: "No",
    commission: ""
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await getCategories({ status: 'Active' });
      if (res && res.data) {
        setCategories(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Mobile Validation (Numbers only, max 10)
    if (name === "mobile") {
      const numericValue = value.replace(/\D/g, "");
      if (numericValue.length <= 10) {
        setFormData(prev => ({ ...prev, [name]: numericValue }));
      }
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'profile' | 'idProof' | 'addressProof') => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({
      ...prev,
      [fieldName]: file
    }));
  };

  const [loadingLocation, setLoadingLocation] = useState(false);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6)
    }));

    // Reverse Geocoding to get address (Using Nominatim for now as fallback,
    // but ideally should use Google Geocoding if key allows)
    try {
        setLoadingLocation(true);
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.display_name) {
             setFormData(prev => ({
                ...prev,
                searchLocation: data.display_name
             }));
        }
    } catch (error) {
        console.error("Failed to fetch address", error);
    } finally {
        setLoadingLocation(false);
    }
  };

  const handleAutocompleteChange = (address: string, lat: number, lng: number, placeName: string, components?: { city?: string; state?: string }) => {
      setFormData(prev => ({
          ...prev,
          searchLocation: address,
          latitude: lat ? lat.toFixed(6) : prev.latitude,
          longitude: lng ? lng.toFixed(6) : prev.longitude,
          // Optional: Auto-select city if it matches our list
          // city: components?.city || prev.city
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.sellerName || !formData.email || !formData.mobile || !formData.storeName || !formData.selectCategory) {
      toast.error("Please fill all required fields!");
      return;
    }

    if (formData.mobile.length !== 10) {
      toast.error("Mobile number must be exactly 10 digits");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!formData.profile) {
      toast.error("Profile image is required!");
      return;
    }

    // Validate Lat/Long
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
        toast.error("Invalid Latitude. Must be between -90 and 90.");
        return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
        toast.error("Invalid Longitude. Must be between -180 and 180.");
        return;
    }

    setLoading(true);
    try {
      const data = new FormData();

      // Append all text fields
      Object.keys(formData).forEach(key => {
        const value = formData[key as keyof FormData];
        if (key === "commission") return;
        if (value !== null && typeof value !== 'object') {
          data.append(key, value as string);
        }
      });

      // Commission (required by backend)
      let commissionForApi = formData.commission;
      if (useCommissionSlabs) {
        const firstValid = commissionSlabs
          .map(s => parseFloat(s.commission))
          .find(v => !Number.isNaN(v) && v >= 0 && v <= 100);
        commissionForApi = (firstValid ?? 0).toString();
      }
      data.append("commission", commissionForApi || "0");

      // Append files
      if (formData.profile) data.append("profile", formData.profile);
      if (formData.idProof) data.append("idProof", formData.idProof);
      if (formData.addressProof) data.append("addressProof", formData.addressProof);

      const res = await createSeller(data);

      if (res.success) {
        if (useCommissionSlabs) {
          const normalized = commissionSlabs
            .map((s) => {
              const minPrice = parseFloat(s.minPrice || "0");
              const maxPriceRaw = s.maxPrice === "" ? null : parseFloat(s.maxPrice);
              const commission = parseFloat(s.commission || "0");
              return {
                minPrice: Number.isNaN(minPrice) ? 0 : minPrice,
                maxPrice: maxPriceRaw === null || Number.isNaN(maxPriceRaw) ? null : maxPriceRaw,
                commission: Number.isNaN(commission) ? 0 : commission,
              };
            })
            .filter((s) => s.commission >= 0 && s.commission <= 100)
            .sort((a, b) => a.minPrice - b.minPrice);

          const sellerKey = (res.data as any)?._id || formData.email;
          if (sellerKey && normalized.length > 0) {
            const store = readCommissionSlabsStore();
            store[String(sellerKey)] = normalized;
            writeCommissionSlabsStore(store);
          }
        }
        toast.success("Seller added successfully!");
        navigate("/admin/manage-seller-list");
      } else {
        toast.error(res.message || "Failed to add seller");
      }
    } catch (error: any) {
      console.error("Error creating seller:", error);
      toast.error(error.response?.data?.message || "Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">Add Seller</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seller Info */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Seller Info</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Seller Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="sellerName"
                  value={formData.sellerName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Seller Name"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Password"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Mobile <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  required
                  maxLength={10}
                  pattern="[0-9]{10}"
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="10 digit mobile"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Store Info */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Store Info</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="storeName"
                  value={formData.storeName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Store Name"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Select Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="selectCategory"
                  value={formData.selectCategory}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                >
                  <option value="">Select Categories</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Address"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Pan Card
                </label>
                <input
                  type="text"
                  name="panCard"
                  value={formData.panCard}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm uppercase"
                  placeholder="Enter PAN"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Tax Name/ GST Name
                </label>
                <input
                  type="text"
                  name="taxName"
                  value={formData.taxName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Tax Name"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Tax Number/ GST Number
                </label>
                <input
                  type="text"
                  name="taxNumber"
                  value={formData.taxNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm uppercase"
                  placeholder="Enter Tax Number"
                  maxLength={15}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Store Location Info */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Store Location Info</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <GoogleMapsAutocomplete
                    value={formData.city}
                    onChange={(address, lat, lng, placeName) => {
                       setFormData(prev => ({
                         ...prev,
                         city: placeName || address,
                         latitude: lat ? lat.toFixed(6) : prev.latitude,
                         longitude: lng ? lng.toFixed(6) : prev.longitude
                       }));
                    }}
                    placeholder="Search City"
                    types={['(cities)']}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Serviceable Area <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <GoogleMapsAutocomplete
                    value={formData.serviceableArea}
                    onChange={(address, lat, lng, placeName) => {
                       setFormData(prev => ({
                         ...prev,
                         serviceableArea: placeName || address,
                         latitude: lat ? lat.toFixed(6) : prev.latitude,
                         longitude: lng ? lng.toFixed(6) : prev.longitude
                       }));
                    }}
                    placeholder="Search Area"
                    types={['(regions)']}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="relative">
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Search Location
                </label>
                <GoogleMapsAutocomplete
                    value={formData.searchLocation}
                    onChange={handleAutocompleteChange}
                    placeholder="Search for a location"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Latitude
                </label>
                <input
                  type="text"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Latitude"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Longitude
                </label>
                <input
                  type="text"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Longitude"
                />
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="h-[400px] w-full bg-neutral-100 rounded border border-neutral-300 overflow-hidden relative">
               {loadingLocation && (
                  <div className="absolute inset-0 bg-white/50 z-[1000] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
               )}
                <GoogleLocationPickerMap
                    latitude={parseFloat(formData.latitude)}
                    longitude={parseFloat(formData.longitude)}
                    onLocationSelect={handleLocationSelect}
                />
            </div>
            <p className="text-xs text-neutral-500 mt-2">Click and drag the pin to adjust location.</p>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Payment Details</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Account Name
                </label>
                <input
                  type="text"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Account Name"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Bank Name
                </label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Bank Name"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Branch
                </label>
                <input
                  type="text"
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Branch"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Account Number"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  IFSC
                </label>
                <input
                  type="text"
                  name="ifsc"
                  value={formData.ifsc}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm uppercase"
                  placeholder="Enter IFSC"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Document Section */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Document Section</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Profile <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => handleFileChange(e, 'profile')}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  accept="image/*"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Id Proof
                </label>
                <input
                  type="file"
                  onChange={(e) => handleFileChange(e, 'idProof')}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  accept="image/*,.pdf"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Address Proof
                </label>
                <input
                  type="file"
                  onChange={(e) => handleFileChange(e, 'addressProof')}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  accept="image/*,.pdf"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Other Info */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Other Info</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Require Product's Approval? <span className="text-red-500">*</span>
                </label>
                <select
                  name="requireProductApproval"
                  value={formData.requireProductApproval}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  View Customer's Details? <span className="text-red-500">*</span>
                </label>
                <select
                  name="viewCustomerDetails"
                  value={formData.viewCustomerDetails}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Commission % <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="commission"
                  value={formData.commission}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Commission"
                  min="0"
                  max="100"
                  step="0.01"
                />

                <div className="mt-3 flex items-center justify-between gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 select-none">
                    <input
                      type="checkbox"
                      checked={useCommissionSlabs}
                      onChange={(e) => setUseCommissionSlabs(e.target.checked)}
                      className="h-4 w-4 accent-[var(--primary-color)]"
                    />
                    Use price-wise commission slabs
                  </label>
                  <span className="text-xs text-neutral-500">
                    Frontend only (saved in this browser)
                  </span>
                </div>

                {useCommissionSlabs && (
                  <div className="mt-3 border border-neutral-200 rounded-lg overflow-hidden">
                    <div className="bg-[var(--primary-color)]/10 px-4 py-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-neutral-800">
                        Commission Slabs (by product price)
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setCommissionSlabs((prev) => [
                            ...prev,
                            { minPrice: "", maxPrice: "", commission: "" },
                          ])
                        }
                        className="px-3 py-1.5 bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white rounded text-xs font-bold transition-colors"
                      >
                        + Add Slab
                      </button>
                    </div>

                    <div className="p-4 space-y-3">
                      {commissionSlabs.map((slab, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 md:grid-cols-10 gap-3 items-end"
                        >
                          <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-neutral-500 mb-1">
                              Min Price (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={slab.minPrice}
                              onChange={(e) =>
                                setCommissionSlabs((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], minPrice: e.target.value };
                                  return next;
                                })
                              }
                              className="w-full px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                              placeholder="0"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-neutral-500 mb-1">
                              Max Price (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={slab.maxPrice}
                              onChange={(e) =>
                                setCommissionSlabs((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], maxPrice: e.target.value };
                                  return next;
                                })
                              }
                              className="w-full px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                              placeholder="(blank = no limit)"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-neutral-500 mb-1">
                              Commission %
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={slab.commission}
                              onChange={(e) =>
                                setCommissionSlabs((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], commission: e.target.value };
                                  return next;
                                })
                              }
                              className="w-full px-3 py-2 border border-neutral-300 rounded outline-none text-sm"
                              placeholder="e.g. 2.5"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setCommissionSlabs((prev) => prev.filter((_, i) => i !== idx))
                              }
                              disabled={commissionSlabs.length === 1}
                              className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove slab"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-neutral-500">
                        Example: 0–100 = 5%, 100–500 = 3%, 500+ = 2%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={`px-8 py-3 text-white font-bold rounded transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            style={{ background: 'var(--primary-color)' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--primary-dark)')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'var(--primary-color)')}
          >
            {loading ? 'Adding Seller...' : 'Add Seller'}
          </button>
        </div>
      </form>
    </div>
  );
}
