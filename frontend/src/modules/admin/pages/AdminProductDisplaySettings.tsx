import { useState, useEffect } from 'react';
import { getAppSettings, updateAppSettings } from '../../../services/api/admin/adminSettingsService';
import { useToast } from '../../../context/ToastContext';

interface SettingField {
  id: string;
  label: string;
  description?: string;
  isEnabled: boolean;
  type?: string;
  canDelete?: boolean;
}

interface SettingSection {
  id: string;
  title: string;
  description?: string;
  fields: SettingField[];
}

const DEFAULT_SECTIONS: SettingSection[] = [
  {
    id: 'basic',
    title: 'Basic Details',
    description: 'Control what appears on your product page.',
    fields: [
      {
         id: 'pack',
         label: 'Pack / Unit Size',
         description: 'e.g. 1kg, 500ml',
         isEnabled: true,
      },
      {
         id: 'item_code',
         label: 'Item Code (SKU)',
         description: 'Stock Keeping Unit',
         isEnabled: true,
      },
      {
         id: 'rack_number',
         label: 'Rack Number',
         description: 'Storage Location',
         isEnabled: true,
      },
      {
        id: 'header_category',
        label: 'Header Category',
        description: 'Top level classification',
        isEnabled: true,
      },
      {
        id: 'category',
        label: 'Category',
        description: 'Product Category Information',
        isEnabled: true,
      },
      {
         id: 'subcategory',
         label: 'Sub-Category',
         description: 'Detailed Classification',
         isEnabled: true,
      },
      {
         id: 'sub_subcategory',
         label: 'Sub-Sub-Category',
         description: 'Deep Classification',
         isEnabled: true,
      },
      {
        id: 'brand',
        label: 'Brand',
        description: 'Product Brand Information',
        isEnabled: true,
      },
      {
         id: 'tags',
         label: 'Tags',
         description: 'Search keywords/tags',
         isEnabled: true,
      },
      {
        id: 'summary',
        label: 'Summary',
        description: 'Short description (Small Description)',
        isEnabled: true,
      },
      {
        id: 'description',
        label: 'Description',
        description: 'Detailed product description',
        isEnabled: true,
      },
      {
        id: 'video',
        label: 'Product Video',
        description: 'Specify product youtube video link',
        isEnabled: false,
      },
      {
         id: 'manufacturer',
         label: 'Manufacturer',
         description: 'Product Manufacturer',
         isEnabled: true,
      },
      {
         id: 'made_in',
         label: 'Made In',
         description: 'Country of Origin',
         isEnabled: true,
      },
      {
         id: 'fssai',
         label: 'FSSAI License',
         description: 'Food license number',
         isEnabled: true,
      },
      {
         id: 'is_returnable',
         label: 'Return Policy',
         description: 'Returnable status and max days',
         isEnabled: true,
      },
      {
         id: 'total_allowed_quantity',
         label: 'Max Quantity',
         description: 'Max qty allowed per order',
         isEnabled: true,
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Visibility & Stores',
    description: 'Control where the product is visible.',
    fields: [
      {
        id: 'shop_by_store_only',
        label: 'Show in Shop by Store only?',
        description: 'Restricts visibility to a specific store page',
        isEnabled: true,
      },
      {
        id: 'select_store',
        label: 'Select Store dropdown',
        description: 'Allow assigning product to a specific store',
        isEnabled: true,
      },
    ],
  },
  {
      id: 'seo',
      title: 'SEO Settings',
      description: 'Search Engine Optimization',
      fields: [
          { id: 'seo_title', label: 'SEO Title', isEnabled: true },
          { id: 'seo_keywords', label: 'SEO Keywords', isEnabled: true },
          { id: 'seo_description', label: 'SEO Description', isEnabled: true },
          { id: 'seo_image_alt', label: 'SEO Image Alt', isEnabled: true },
      ]
  },
  {
    id: 'pricing',
    title: 'Pricing & Tax',
    fields: [
      {
        id: 'tax',
        label: 'Tax',
        description: 'Tax related info',
        isEnabled: true,
      },
      {
         id: 'hsn_code',
         label: 'HSN Code',
         description: 'Harmonized System Nomenclature',
         isEnabled: true,
      },
      {
        id: 'purchase_price',
        label: 'Purchase Price',
        description: 'Purchase price of goods (visible only to you)',
        isEnabled: true,
      },
       {
         id: 'delivery_time',
         label: 'Delivery Time',
         description: 'Estimated delivery days',
         isEnabled: true,
      },
    ],
  },
  {
    id: 'variants',
    title: 'Variant Fields',
    description: 'Add variants for products having more than one option',
    fields: [
      {
        id: 'size',
        label: 'Size',
        description: 'Product variant',
        isEnabled: true,
        canDelete: true,
      },
      {
        id: 'color',
        label: 'Color',
        description: 'Product variant',
        isEnabled: true,
        canDelete: true,
      },
      {
        id: 'online_offer_price',
        label: 'Online Offer Price',
        description: 'Product variant',
        isEnabled: false,
        canDelete: true,
      },
    ],
  },
];

export default function AdminProductDisplaySettings() {
  const [sections, setSections] = useState<SettingSection[]>(DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const [barcodeSize, setBarcodeSize] = useState('medium');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newVariantName, setNewVariantName] = useState("");
  const [targetSectionId, setTargetSectionId] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<{sectionId: string, fieldId: string} | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('barcode_print_size');
    if (saved === 'small' || saved === 'medium' || saved === 'large') {
      setBarcodeSize(saved);
    }
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await getAppSettings();
      if (response.success && response.data.productDisplaySettings && response.data.productDisplaySettings.length > 0) {
        // Merge backend settings with DEFAULT_SECTIONS to ensure new fields are added
        const mergedSettings = DEFAULT_SECTIONS.map(defaultSection => {
            const backendSection = response.data.productDisplaySettings?.find((s: any) => s.id === defaultSection.id);
            if (!backendSection) return defaultSection;

            // Merge Fields
            const mergedFields = defaultSection.fields.map(defaultField => {
                const backendField = backendSection.fields.find((f: any) => f.id === defaultField.id);
                if (backendField) {
                    return {
                        ...defaultField, // Keep default props like label/desc in case code updated
                        isEnabled: backendField.isEnabled, // Use saved value
                        canDelete: backendField.canDelete || defaultField.canDelete,
                        type: backendField.type || defaultField.type
                    };
                }
                return defaultField; // Use default if new field not in DB
            });

            // Also include custom fields added by user (e.g. variants) that are NOT in default
            if (backendSection.id === 'variants') {
                const customFields = backendSection.fields.filter((f: any) =>
                    !defaultSection.fields.some(df => df.id === f.id)
                );
                return {
                    ...defaultSection,
                    fields: [...mergedFields, ...customFields]
                };
            }

            return {
                ...defaultSection,
                fields: mergedFields
            };
        });

        setSections(mergedSettings);
      } else {
        // If no settings exist on backend, use defaults
         setSections(DEFAULT_SECTIONS);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await updateAppSettings({
        productDisplaySettings: sections,
      });

      if (response.success) {
        showToast('Settings saved successfully', 'success');
      } else {
         showToast(response.message || 'Failed to save settings', 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (sectionId: string, fieldId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((field) =>
                field.id === fieldId ? { ...field, isEnabled: !field.isEnabled } : field
              ),
            }
          : section
      )
    );
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    setFieldToDelete({ sectionId, fieldId });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!fieldToDelete) return;

    const { sectionId, fieldId } = fieldToDelete;

    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.filter((field) => field.id !== fieldId),
            }
          : section
      )
    );

    setIsDeleteModalOpen(false);
    setFieldToDelete(null);
  };

  const addField = (sectionId: string) => {
    setTargetSectionId(sectionId);
    setNewVariantName("");
    setIsModalOpen(true);
  };

  const handleConfirmAdd = () => {
    if (!newVariantName.trim()) {
      showToast('Please enter a name', 'error');
      return;
    }

    const label = newVariantName.trim();
    const id = label.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Check if duplicate
    const section = sections.find(s => s.id === targetSectionId);
    if (section && section.fields.some(f => f.id === id)) {
       showToast('Field with this name already exists', 'error');
       return;
    }

    setSections((prev) =>
      prev.map((section) =>
        section.id === targetSectionId
          ? {
              ...section,
              fields: [
                ...section.fields,
                {
                  id,
                  label,
                  description: 'Product variant',
                  isEnabled: true,
                  canDelete: true,
                  type: 'toggle'
                }
              ],
            }
          : section
      )
    );

    setIsModalOpen(false);
    setNewVariantName("");
    setTargetSectionId("");
  };

  if (loading) {
     return (
        <div className="flex items-center justify-center h-full">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
     )
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50 relative">
      {/* Header - Static at top of flex column (outside scroll area) */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200 z-20 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Product Settings</h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-sm text-neutral-600 hidden sm:block mr-2">
                <span className="text-teal-600">Home</span> / <span className="text-neutral-900">Product Settings</span>
             </div>
             <button
               onClick={saveSettings}
               disabled={saving}
               className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
             >
               {saving ? 'Saving...' : 'Save Changes'}
             </button>
          </div>
        </div>
      </div>

      {/* Content Area - Takes remaining space and scrolls */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-6 max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-neutral-800">Barcode Settings</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Set the size for printed barcodes.
                </p>
              </div>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Barcode Size
              </label>
              <select
                value={barcodeSize}
                onChange={(e) => {
                  const value = e.target.value;
                  setBarcodeSize(value);
                  localStorage.setItem('barcode_print_size', value);
                }}
                className="w-full max-w-xs border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-white"
              >
                <option value="small">Small</option>
                <option value="medium">Medium (Default)</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
          {sections.map((section) => (
            <div key={section.id} className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-neutral-800">{section.title}</h2>
                  {section.description && (
                    <p className="text-sm text-neutral-500 mt-1">{section.description}</p>
                  )}
                </div>
                {section.id === 'variants' && (
                  <button
                    onClick={() => addField(section.id)}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium px-3 py-1.5 rounded-md hover:bg-teal-50 transition-colors"
                  >
                    + Add Field
                  </button>
                )}
              </div>

              <div className="p-0">
                {section.fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-800 text-sm sm:text-base">
                          {field.label}
                        </span>
                        {field.id === 'video' && (
                          <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                          </svg>
                        )}
                      </div>
                      {field.description && (
                        <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                          {field.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Toggle Switch */}
                      <button
                        onClick={() => toggleField(section.id, field.id)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 ${
                          field.isEnabled ? 'bg-blue-600' : 'bg-neutral-200'
                        }`}
                        role="switch"
                        aria-checked={field.isEnabled}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            field.isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* Delete Button (Trash Icon) */}
                      {field.canDelete && (
                        <button
                          onClick={() => deleteField(section.id, field.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete field"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}


              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer - Static at bottom of flex column */}
      <div className="bg-white border-t border-neutral-200 p-4 flex justify-end z-20 flex-shrink-0">
        <button
           onClick={saveSettings}
           disabled={saving}
           className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-6 rounded-lg shadow-sm transition-colors text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Custom Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">Add New Variant Field</h3>
            <p className="text-sm text-neutral-500 mb-4">Enter the name for the new variant (e.g., "Material", "Fabric").</p>

            <input
              type="text"
              value={newVariantName}
              onChange={(e) => setNewVariantName(e.target.value)}
              placeholder="Variant Name"
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 mb-6"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmAdd();
                if (e.key === 'Escape') setIsModalOpen(false);
              }}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdd}
                 className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium"
              >
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 transform transition-all">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">Remove Variant Field?</h3>
            <p className="text-sm text-neutral-500 mb-6">Are you sure you want to remove this variant field? This action cannot be undone.</p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
