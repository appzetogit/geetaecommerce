import { useState, useEffect } from 'react';
import { useToast } from '../../../context/ToastContext';
import { getAppSettings, updateAppSettings } from '../../../services/api/admin/adminSettingsService';

interface DeliverySettingSection {
  id: string;
  title: string;
  fields: DeliverySettingField[];
}

interface DeliverySettingField {
  id: string;
  label: string;
  description: string;
  type: 'number' | 'select' | 'text';
  value: string | number;
  options?: string[]; // For select type
  suffix?: string;    // e.g. "Kms" or "₹"
}

export default function AdminDeliverySettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<DeliverySettingSection[]>([
    {
      id: 'delivery_config',
      title: 'Delivery Configuration',
      fields: [
        {
          id: 'delivery_radius',
          label: 'Allow Order Within',
          description: 'Set the maximum distance for delivery.',
          type: 'number',
          value: 0,
          suffix: 'Kms'
        },
        {
          id: 'delivery_fee',
          label: 'Delivery Fee',
          description: 'Applicable delivery charge for orders.',
          type: 'number',
          value: 0,
          suffix: '₹'
        },
        {
          id: 'free_delivery_above',
          label: 'Free Shipping Above',
          description: 'Free shipping for orders above this amount.',
          type: 'number',
          value: 0,
          suffix: '₹'
        },
        {
          id: 'service_type',
          label: 'Service Type',
          description: 'Choose how customers receive their orders.',
          type: 'select',
          value: 'Delivery + Pickup',
          options: ['Delivery', 'Pickup', 'Delivery + Pickup']
        }
      ]
    },
    {
      id: 'payment_discount',
      title: 'Online Payment Discount',
      fields: [
        {
          id: 'discount_enabled',
          label: 'Enable Discount',
          description: 'Enable discount for online payments (Razorpay/Cashfree).',
          type: 'select',
          value: 'No',
          options: ['Yes', 'No']
        },
        {
          id: 'discount_percentage',
          label: 'Discount Percentage',
          description: 'Set the discount percentage for online payments.',
          type: 'number',
          value: 0,
          suffix: '%'
        }
      ]
    }
  ]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await getAppSettings();
      if (response.success && response.data) {
        const settings = response.data;
        setSections(prev => prev.map(section => {
          if (section.id === 'delivery_config') {
            return {
              ...section,
              fields: section.fields.map(field => {
                switch (field.id) {
                  case 'delivery_radius':
                    return { ...field, value: settings.deliveryRadius || 0 };
                  case 'delivery_fee':
                    return { ...field, value: settings.deliveryCharges || 0 };
                  case 'free_delivery_above':
                    return { ...field, value: settings.freeDeliveryThreshold || 0 };
                  case 'service_type':
                    return { ...field, value: settings.serviceType || 'Delivery + Pickup' };
                  default:
                    return field;
                }
              })
            };
          }
          if (section.id === 'payment_discount') {
            return {
              ...section,
              fields: section.fields.map(field => {
                switch (field.id) {
                  case 'discount_enabled':
                    return { ...field, value: settings.onlinePaymentDiscount?.enabled ? 'Yes' : 'No' };
                  case 'discount_percentage':
                    return { ...field, value: settings.onlinePaymentDiscount?.percentage || 0 };
                  default:
                    return field;
                }
              })
            };
          }
          return section;
        }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (sectionId: string, fieldId: string, newValue: string | number) => {
    setSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map(field =>
                field.id === fieldId ? { ...field, value: newValue } : field
              )
            }
          : section
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Extract values from state
      const fields = sections[0].fields;
      const getFieldValue = (id: string, sId: string = 'delivery_config') =>
        sections.find(s => s.id === sId)?.fields.find(f => f.id === id)?.value;

      const updateData = {
        deliveryRadius: Number(getFieldValue('delivery_radius')),
        deliveryCharges: Number(getFieldValue('delivery_fee')),
        freeDeliveryThreshold: Number(getFieldValue('free_delivery_above')),
        serviceType: String(getFieldValue('service_type')),
        onlinePaymentDiscount: {
          enabled: getFieldValue('discount_enabled', 'payment_discount') === 'Yes',
          percentage: Number(getFieldValue('discount_percentage', 'payment_discount'))
        }
      };

      const response = await updateAppSettings(updateData);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50 relative">
      {/* Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200 z-20 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Delivery Settings</h1>
          </div>
          <div className="text-sm text-neutral-600">
            <span className="text-teal-600">Home</span> / <span className="text-neutral-900">Delivery Settings</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-6 max-w-3xl mx-auto">
          {sections.map((section) => (
            <div key={section.id} className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100">
                <h2 className="text-lg font-bold text-neutral-800">{section.title}</h2>
              </div>

              <div className="p-4 sm:p-6 space-y-6">
                {section.fields.map((field) => (
                  <div key={field.id} className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-neutral-900">
                      {field.label}
                    </label>
                    <div className="relative">
                      {field.type === 'select' ? (
                        <select
                          value={field.value}
                          onChange={(e) => handleFieldChange(section.id, field.id, e.target.value)}
                          className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 appearance-none"
                        >
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="relative flex items-center">
                          {field.suffix === '₹' && (
                             <span className="absolute left-3 text-neutral-500 font-medium">₹</span>
                          )}
                          <input
                            type={field.type}
                            value={field.value}
                            onChange={(e) => handleFieldChange(section.id, field.id, e.target.value)}
                            className={`w-full border border-neutral-300 rounded-lg text-sm bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 px-4 py-2.5 ${field.suffix === '₹' ? 'pl-7' : ''}`}
                          />
                          {field.suffix && field.suffix !== '₹' && (
                             <span className="absolute right-3 text-neutral-500 text-sm font-medium">{field.suffix}</span>
                          )}
                        </div>
                      )}

                      {/* Custom dropdown arrow for Select */}
                      {field.type === 'select' && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">{field.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-neutral-200 p-4 flex justify-end z-20 flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`text-white font-semibold py-2.5 px-6 rounded-lg shadow-sm transition-colors text-sm sm:text-base flex items-center justify-center min-w-[140px] ${
            saving ? 'bg-green-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {saving ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  );
}
