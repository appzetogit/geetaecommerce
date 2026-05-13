import React, { useState, useEffect } from "react";
import {
  createVariationType,
  getVariationTypes,
  updateVariationType,
  deleteVariationType,
} from "../../../services/api/seller/sellerVariationTypeService";
import { useToast } from "../../../context/ToastContext";
import { useConfirmation } from "../../../context/ConfirmationContext";

const SellerVariationTypeSetup = () => {
  const [variationTypes, setVariationTypes] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { showToast } = useToast();
  const confirmation = useConfirmation();

  const fetchVariationTypes = async () => {
    try {
      const res = await getVariationTypes(search);
      if (res.success) {
        setVariationTypes(res.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchVariationTypes();
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
        showToast("Please enter Variation Type Name", "error");
        return;
    }

    setLoading(true);
    try {
      const payload = { name };

      if (editId) {
        await updateVariationType(editId, payload);
        showToast("Variation Type updated successfully", "success");
      } else {
        await createVariationType(payload);
        showToast("Variation Type added successfully", "success");
      }
      setName("");
      setEditId(null);
      fetchVariationTypes();
    } catch (error: any) {
      showToast(error.message || "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (type: any) => {
    setName(type.name);
    setEditId(type._id || type.id);
  };

  const handleDelete = async (id: string) => {
    confirmation.openConfirmation({
      title: "Confirm Deletion",
      message: "Are you sure you want to delete this variation type?",
      onConfirm: async () => {
        try {
          await deleteVariationType(id);
          showToast("Variation Type deleted successfully", "success");
          fetchVariationTypes();
        } catch (error: any) {
            showToast(error.message || "Failed to delete variation type", "error");
        }
      },
      confirmText: "Delete",
      confirmButtonClass: "bg-red-600 hover:bg-red-700 text-white",
    });
  };

  const handleReset = () => {
      setName("");
      setEditId(null);
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-[var(--primary-color)]/10 p-2 rounded-full">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 13H8" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17H8" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 9H8" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-800">Variation Type Setup</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="bg-white rounded-lg shadow p-6 h-fit">
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Variation Type Name*
                    </label>
                    <input
                        type="text"
                        placeholder="Enter Variation Type Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                    />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                    >
                        Reset
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-[var(--primary-color)] text-white rounded hover:bg-[var(--primary-dark)] transition-colors"
                    >
                        {loading ? "Submitting..." : (editId ? "Update" : "Submit")}
                    </button>
                </div>
            </form>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Variation Type list</h2>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-semibold">{variationTypes.length}</span>
            </div>

            <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Search by Variation Type Name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <button className="px-6 py-2 bg-[var(--primary-color)] text-white rounded hover:bg-[var(--primary-dark)] transition-colors font-medium">
                    Search
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-600 font-medium text-sm">
                        <tr>
                            <th className="px-4 py-3 rounded-l-lg">SL</th>
                            <th className="px-4 py-3">Variation Type Name</th>
                            <th className="px-4 py-3 text-center rounded-r-lg">Action</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {variationTypes.length > 0 ? (
                            variationTypes.map((type, index) => (
                                <tr key={type._id || type.id} className="border-b last:border-none hover:bg-gray-50">
                                    <td className="px-4 py-3">{index + 1}</td>
                                    <td className="px-4 py-3 text-gray-800">{type.name}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleEdit(type)}
                                                className="w-8 h-8 flex items-center justify-center rounded border border-[var(--primary-color)]/20 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 transition-colors"
                                                title="Edit"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(type._id || type.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                                title="Delete"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                                    No variation types found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SellerVariationTypeSetup;
