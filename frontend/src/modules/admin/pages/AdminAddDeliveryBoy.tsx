import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDeliveryBoy } from "../../../services/api/admin/adminDeliveryService";
import { toast } from "react-hot-toast";
import GoogleLocationPickerMap from "../components/GoogleLocationPickerMap";
import GoogleMapsAutocomplete from "../../../components/GoogleMapsAutocomplete";

interface DeliveryBoyFormData {
  name: string;
  email: string;
  mobile: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  address: string;
  city: string;
  pincode: string;

  // Banking
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  otherPaymentInformation: string;

  // Commission
  bonusType: string;
  commissionType: "Percentage" | "Fixed";
  commission: string;
  minAmount: string;
  maxAmount: string; // Cash collection limit

  // Location
  latitude: string;
  longitude: string;

  // Files
  drivingLicense: File | null;
  nationalIdentityCard: File | null;
  profileImage: File | null;
}

export default function AdminAddDeliveryBoy() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<DeliveryBoyFormData>({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    address: "",
    city: "",
    pincode: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    ifscCode: "",
    otherPaymentInformation: "",
    bonusType: "",
    commissionType: "Percentage",
    commission: "",
    minAmount: "",
    maxAmount: "",
    latitude: "",
    longitude: "",
    drivingLicense: null,
    nationalIdentityCard: null,
    profileImage: null,
  });

  const [loadingLocation, setLoadingLocation] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === "mobile") {
       const numericValue = value.replace(/\D/g, "").slice(0, 10);
       setFormData(prev => ({ ...prev, mobile: numericValue }));
       return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof DeliveryBoyFormData) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, [fieldName]: file }));
  };

  const handleLocationSelect = async (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6)
    }));

    // Reverse Geocoding fallback
    try {
        setLoadingLocation(true);
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.address) {
             const city = data.address.city || data.address.town || data.address.village || "";
             const postcode = data.address.postcode || "";

             setFormData(prev => ({
                ...prev,
                city: prev.city || city,
                pincode: prev.pincode || postcode,
                address: data.display_name || prev.address
             }));
        }
    } catch (error) {
        console.error("Failed to fetch address details", error);
    } finally {
        setLoadingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Validation
    if (!formData.name || !formData.email || !formData.mobile || !formData.password || !formData.address || !formData.city) {
        toast.error("Please fill all required fields");
        return;
    }

    if (formData.mobile.length !== 10) {
        toast.error("Mobile number must be 10 digits");
        return;
    }

    if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return;
    }

    setLoading(true);
    try {
        // Create FormData
        const data = new FormData();
        Object.keys(formData).forEach(key => {
            const value = formData[key as keyof DeliveryBoyFormData];
            if (value !== null && key !== 'confirmPassword') {
                data.append(key, value as any);
            }
        });

        // Cast to any because the service expects a strict interface but we are sending FormData for file uploads
        await createDeliveryBoy(data as any);
        toast.success("Delivery Boy added successfully");
        navigate("/admin/delivery-boy/manage");
    } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to add delivery boy");
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">Add Delivery Boy</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Delivery Boy Info</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Name <span className="text-red-500">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Name" />
            </div>
            <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Email <span className="text-red-500">*</span></label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Email" />
            </div>
            <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Mobile <span className="text-red-500">*</span></label>
                <input type="text" name="mobile" value={formData.mobile} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Mobile" />
            </div>
             <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Password <span className="text-red-500">*</span></label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Password" />
            </div>
             <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Confirm Password <span className="text-red-500">*</span></label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Confirm Password" />
            </div>
            <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Date of Birth</label>
                <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" />
            </div>
          </div>
        </div>

        {/* Location Info */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Address & Location</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-bold text-neutral-800 mb-2">Address <span className="text-red-500">*</span></label>
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Address" />
                </div>
                <div>
                     <label className="block text-sm font-bold text-neutral-800 mb-2">City <span className="text-red-500">*</span></label>
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
                 <div>
                    <label className="block text-sm font-bold text-neutral-800 mb-2">Pincode</label>
                    <input type="text" name="pincode" value={formData.pincode} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Pincode" />
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
                    latitude={parseFloat(formData.latitude) || 20.5937}
                    longitude={parseFloat(formData.longitude) || 78.9629}
                    onLocationSelect={handleLocationSelect}
                />
            </div>
            <p className="text-xs text-neutral-500 mt-2">Click and drag the pin to adjust location.</p>
          </div>
        </div>

        {/* Banking Info */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
           <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Banking Details</h2>
          </div>
           <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Bank Name <span className="text-red-500">*</span></label>
                <input type="text" name="bankName" value={formData.bankName} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Bank Name" />
            </div>
             <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Account Name <span className="text-red-500">*</span></label>
                <input type="text" name="accountName" value={formData.accountName} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Account Name" />
            </div>
             <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Account Number <span className="text-red-500">*</span></label>
                <input type="text" name="accountNumber" value={formData.accountNumber} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Account Number" />
            </div>
             <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">IFSC Code <span className="text-red-500">*</span></label>
                <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleInputChange} required className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm uppercase" placeholder="Enter IFSC" />
            </div>
           </div>
        </div>

        {/* Financials */}
         <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
           <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Financials</h2>
          </div>
           <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Commission Type</label>
                 <select name="commissionType" value={formData.commissionType} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm">
                    <option value="Percentage">Percentage</option>
                    <option value="Fixed">Fixed</option>
                 </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Commission Value</label>
                <input type="number" name="commission" value={formData.commission} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Value" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Max Cash Collection Limit</label>
                <input type="number" name="maxAmount" value={formData.maxAmount} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" placeholder="Enter Max Limit" />
              </div>
           </div>
        </div>

        {/* Documents */}
         <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
           <div className="p-4 border-b border-neutral-200" style={{ background: 'var(--primary-color)' }}>
            <h2 className="text-lg font-bold text-white">Documents</h2>
          </div>
           <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Profile Image</label>
                <input type="file" onChange={(e) => handleFileChange(e, 'profileImage')} accept="image/*" className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" />
              </div>
               <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">Driving License</label>
                <input type="file" onChange={(e) => handleFileChange(e, 'drivingLicense')} accept="image/*, .pdf" className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" />
              </div>
               <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">National Identity Card</label>
                <input type="file" onChange={(e) => handleFileChange(e, 'nationalIdentityCard')} accept="image/*, .pdf" className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm" />
              </div>
           </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
             <button
            type="submit"
            disabled={loading}
            className={`px-8 py-3 text-white font-bold rounded transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            style={{ background: 'var(--primary-color)' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--primary-dark)')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'var(--primary-color)')}
          >
            {loading ? 'Adding...' : 'Add Delivery Boy'}
          </button>
        </div>

      </form>
    </div>
  );
}
