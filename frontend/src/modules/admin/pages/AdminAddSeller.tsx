import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
    latitude: "28.6139",
    longitude: "77.2090",
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.sellerName || !formData.email || !formData.mobile || !formData.storeName) {
      alert("Please fill all required fields!");
      return;
    }

    console.log("Form Data:", formData);
    alert("Seller added successfully! (Frontend only - no backend integration)");
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
          <div className="p-4 border-b border-neutral-200" style={{ background: '#e91e63' }}>
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
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Enter Mobile"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Store Info */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: '#e91e63' }}>
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
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                >
                  <option value="">Select Categories</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Grocery">Grocery</option>
                  <option value="Home">Home & Kitchen</option>
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
          <div className="p-4 border-b border-neutral-200" style={{ background: '#e91e63' }}>
            <h2 className="text-lg font-bold text-white">Store Location Info</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <select
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                >
                  <option value="">Select City</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Bangalore">Bangalore</option>
                  <option value="Kolkata">Kolkata</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Serviceable Area <span className="text-red-500">*</span>
                </label>
                <select
                  name="serviceableArea"
                  value={formData.serviceableArea}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                >
                  <option value="">Select Serviceable Area</option>
                  <option value="North Delhi">North Delhi</option>
                  <option value="South Delhi">South Delhi</option>
                  <option value="East Delhi">East Delhi</option>
                  <option value="West Delhi">West Delhi</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-neutral-800 mb-2">
                  Search Location
                </label>
                <input
                  type="text"
                  name="searchLocation"
                  value={formData.searchLocation}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded outline-none text-sm"
                  placeholder="Search Location"
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
            <div className="h-[300px] bg-neutral-100 rounded border border-neutral-300 flex items-center justify-center">
              <p className="text-neutral-500 text-sm">Map will be displayed here (Google Maps integration)</p>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200" style={{ background: '#e91e63' }}>
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
          <div className="p-4 border-b border-neutral-200" style={{ background: '#e91e63' }}>
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
          <div className="p-4 border-b border-neutral-200" style={{ background: '#e91e63' }}>
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
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-8 py-3 text-white font-bold rounded transition-colors"
            style={{ background: '#e91e63' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#c2185b'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#e91e63'}
          >
            Add Seller
          </button>
        </div>
      </form>
    </div>
  );
}
