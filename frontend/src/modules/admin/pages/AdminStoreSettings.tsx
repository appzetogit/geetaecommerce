import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    ArrowLeft,
    Camera,
    Save,
    MapPin,
    Mail,
    Phone,
    Globe,
    Instagram,
    Youtube,
    Facebook,
    Plus,
    Trash2,
    Loader2
} from 'lucide-react';
import { uploadImage } from '../../../services/api/uploadService';
import { useAppContext } from '../../../context/AppContext';
import { getAdminAppSettings, updateAdminAppSettings } from '../../../services/api/adminAppSettingsService';

export default function AdminStoreSettings() {
    const navigate = useNavigate();
    const { refreshConfig } = useAppContext();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingFavicon, setUploadingFavicon] = useState(false);

    const [formData, setFormData] = useState({
        appName: '',
        appLogo: '',
        appFavicon: '',
        contactPhone: '',
        contactEmail: '',
        address: '',
        socialMediaLinks: {
            facebook: '',
            youtube: '',
            instagram: ''
        },
        invoiceSettings: {
            notes: {
                text: 'Thank you for your business',
                enabled: true
            },
            terms: {
                text: 'Goods once sold will not be taken back.',
                enabled: true
            },
            gst: {
                text: '',
                enabled: false
            },
            fssai: {
                text: '',
                enabled: false
            }
        }
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await getAdminAppSettings();
            if (response.success && response.data) {
                const data = response.data;
                setFormData({
                    appName: data.appName || '',
                    appLogo: data.appLogo || '',
                    appFavicon: data.appFavicon || '',
                    contactPhone: data.contactPhone || '',
                    contactEmail: data.contactEmail || '',
                    address: data.address || '',
                    socialMediaLinks: {
                        facebook: data.socialMediaLinks?.facebook || '',
                        youtube: data.socialMediaLinks?.youtube || '',
                        instagram: data.socialMediaLinks?.instagram || ''
                    },
                    invoiceSettings: {
                        notes: {
                            text: data.invoiceSettings?.notes?.text || 'Thank you for your business',
                            enabled: data.invoiceSettings?.notes?.enabled ?? true
                        },
                        terms: {
                            text: data.invoiceSettings?.terms?.text || 'Goods once sold will not be taken back.',
                            enabled: data.invoiceSettings?.terms?.enabled ?? true
                        },
                        gst: {
                            text: data.invoiceSettings?.gst?.text || '',
                            enabled: data.invoiceSettings?.gst?.enabled ?? false
                        },
                        fssai: {
                            text: data.invoiceSettings?.fssai?.text || '',
                            enabled: data.invoiceSettings?.fssai?.enabled ?? false
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name.includes('.')) {
            const parts = name.split('.');
            if (parts.length === 2) {
                const [parent, child] = parts;
                setFormData(prev => ({
                    ...prev,
                    [parent]: {
                        ...(prev[parent as keyof typeof prev] as any),
                        [child]: value
                    }
                }));
            } else if (parts.length === 3) {
                const [grandParent, parent, child] = parts;
                setFormData(prev => ({
                    ...prev,
                    [grandParent]: {
                        ...(prev[grandParent as keyof typeof prev] as any),
                        [parent]: {
                            ...((prev[grandParent as keyof typeof prev] as any)[parent]),
                            [child]: value
                        }
                    }
                }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleToggleInvoiceSetting = (section: 'notes' | 'terms' | 'gst' | 'fssai') => {
        setFormData(prev => ({
            ...prev,
            invoiceSettings: {
                ...prev.invoiceSettings,
                [section]: {
                    ...prev.invoiceSettings[section],
                    enabled: !prev.invoiceSettings[section].enabled
                }
            }
        }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            if (type === 'logo') setUploadingLogo(true);
            else setUploadingFavicon(true);

            const result = await uploadImage(file, 'app-settings');
            setFormData(prev => ({
                ...prev,
                [type === 'logo' ? 'appLogo' : 'appFavicon']: result.secureUrl
            }));
            toast.success(`${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully`);
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Upload failed');
        } finally {
            if (type === 'logo') setUploadingLogo(false);
            else setUploadingFavicon(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const response = await updateAdminAppSettings(formData);
            if (response.success) {
                toast.success('Settings updated successfully');
                await refreshConfig();
            } else {
                toast.error(response.message || 'Failed to update settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8F9FB] pb-12">
            {/* Header */}
            <div className="flex items-center justify-between bg-white px-4 py-4 border-b border-neutral-200 md:px-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="rounded-full p-2 hover:bg-neutral-100 transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6 text-neutral-700" />
                    </button>
                    <h1 className="text-xl font-bold text-neutral-800">Brand Settings</h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 py-2.5 font-semibold text-white shadow-lg shadow-[var(--primary-color)]/20 hover:bg-[var(--primary-dark)] transition-all disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    <span>Save Changes</span>
                </button>
            </div>

            <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
                {/* Visual Identity Section */}
                <div className="rounded-3xl bg-white p-8 shadow-sm border border-neutral-100">
                    <h2 className="text-lg font-bold text-neutral-800 mb-6 flex items-center gap-2">
                        <Camera className="h-5 w-5 text-[var(--primary-color)]" />
                        App Visuals
                    </h2>

                    <div className="flex flex-wrap items-center gap-12">
                        {/* App Logo */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="group relative h-32 w-32 flex items-center justify-center rounded-[2rem] border-2 border-dashed border-neutral-200 bg-neutral-50 shadow-inner transition-all hover:border-[var(--primary-color)]/50 hover:bg-[var(--primary-color)]/5 overflow-hidden">
                                {formData.appLogo ? (
                                    <img src={formData.appLogo} alt="App Logo" className="h-20 w-20 object-contain transition-transform group-hover:scale-110" />
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-neutral-400">
                                        <Globe className="h-8 w-8" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-10 w-10 flex items-center justify-center rounded-full bg-white shadow-lg text-[var(--primary-color)] scale-90 group-hover:scale-100 transition-transform"
                                    >
                                        {uploadingLogo ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                                    </button>
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, 'logo')}
                            />
                            <div className="text-center">
                                <span className="block text-sm font-bold text-neutral-800">App Logo</span>
                                <span className="text-[10px] text-neutral-500 font-medium">Recommended: 512x512 PNG</span>
                            </div>
                        </div>

                        {/* Favicon */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="group relative h-24 w-24 flex items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 shadow-inner transition-all hover:border-[var(--primary-color)]/50 hover:bg-[var(--primary-color)]/5 overflow-hidden">
                                {formData.appFavicon ? (
                                    <img src={formData.appFavicon} alt="Favicon" className="h-12 w-12 object-contain" />
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-neutral-400">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                        onClick={() => faviconInputRef.current?.click()}
                                        className="h-8 w-8 flex items-center justify-center rounded-full bg-white shadow-lg text-[var(--primary-color)]"
                                    >
                                        {uploadingFavicon ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={faviconInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, 'favicon')}
                            />
                            <div className="text-center">
                                <span className="block text-sm font-bold text-neutral-800">Favicon</span>
                                <span className="text-[10px] text-neutral-500 font-medium">32x32 or 64x64 .ico/.png</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Core Settings Info Card */}
                <div className="rounded-3xl bg-white p-8 shadow-sm border border-neutral-100 space-y-6">
                    <h2 className="text-base font-bold text-neutral-800 border-b border-neutral-50 pb-4">Essential Information</h2>

                    <div className="grid gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-neutral-600 ml-1">App / Brand Name</label>
                            <input
                                type="text"
                                name="appName"
                                value={formData.appName}
                                onChange={handleInputChange}
                                placeholder="e.g. Geeta Stores"
                                className="w-full rounded-2xl border-neutral-200 bg-neutral-50/30 px-5 py-4 text-neutral-800 font-medium placeholder:text-neutral-400 focus:border-[var(--primary-color)] focus:ring-4 focus:ring-[var(--primary-color)]/5 transition-all outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-neutral-600 ml-1">Customer Support Phone</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-xl bg-white shadow-sm border border-neutral-100 text-neutral-400 group-focus-within:text-[var(--primary-color)] transition-colors">
                                        <Phone className="h-4 w-4" />
                                    </div>
                                    <input
                                        type="tel"
                                        name="contactPhone"
                                        value={formData.contactPhone}
                                        onChange={handleInputChange}
                                        placeholder="Mobile Number"
                                        className="w-full rounded-2xl border-neutral-200 bg-neutral-50/30 pl-16 pr-4 py-4 text-neutral-800 font-medium placeholder:text-neutral-400 focus:border-[var(--primary-color)] focus:ring-4 focus:ring-[var(--primary-color)]/5 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-neutral-600 ml-1">Official Email Address</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-xl bg-white shadow-sm border border-neutral-100 text-neutral-400 group-focus-within:text-[var(--primary-color)] transition-colors">
                                        <Mail className="h-4 w-4" />
                                    </div>
                                    <input
                                        type="email"
                                        name="contactEmail"
                                        value={formData.contactEmail}
                                        onChange={handleInputChange}
                                        placeholder="Email Address"
                                        className="w-full rounded-2xl border-neutral-200 bg-neutral-50/30 pl-16 pr-4 py-4 text-neutral-800 font-medium placeholder:text-neutral-400 focus:border-[var(--primary-color)] focus:ring-4 focus:ring-[var(--primary-color)]/5 transition-all outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-neutral-600 ml-1 flex items-center justify-between">
                                Store Address
                                <span className="text-[10px] text-neutral-400 font-normal uppercase italic tracking-widest">(Used for Deliveries)</span>
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-4 h-10 w-10 flex items-center justify-center rounded-xl bg-white shadow-sm border border-neutral-100 text-[var(--primary-color)]">
                                    <MapPin className="h-4 w-4" />
                                </div>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    rows={3}
                                    placeholder="Full store address..."
                                    className="w-full rounded-2xl border-neutral-200 bg-neutral-50/30 pl-16 pr-4 py-4 text-neutral-800 font-medium placeholder:text-neutral-400 focus:border-[var(--primary-color)] focus:ring-4 focus:ring-[var(--primary-color)]/5 transition-all outline-none resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Social Media Links Card */}
                <div className="rounded-3xl bg-white p-8 shadow-sm border border-neutral-100">
                    <h2 className="text-base font-bold text-neutral-800 mb-6">Social Connections</h2>

                    <div className="grid gap-5">
                        {/* Facebook */}
                        <div className="group flex items-center gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/20 p-3 pr-5 focus-within:border-blue-200 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] border border-blue-100">
                                <Facebook className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <input
                                    type="url"
                                    name="socialMediaLinks.facebook"
                                    value={formData.socialMediaLinks.facebook}
                                    onChange={handleInputChange}
                                    placeholder="Facebook Page URL"
                                    className="w-full bg-transparent text-sm font-semibold text-neutral-800 placeholder:text-neutral-400 outline-none"
                                />
                            </div>
                            <button onClick={() => setFormData(p => ({...p, socialMediaLinks: {...p.socialMediaLinks, facebook: ''}}))} className="text-neutral-300 hover:text-red-500 transition-colors">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        {/* YouTube */}
                        <div className="group flex items-center gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/20 p-3 pr-5 focus-within:border-red-200 focus-within:ring-4 focus-within:ring-red-50 transition-all">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100">
                                <Youtube className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <input
                                    type="url"
                                    name="socialMediaLinks.youtube"
                                    value={formData.socialMediaLinks.youtube}
                                    onChange={handleInputChange}
                                    placeholder="YouTube Channel URL"
                                    className="w-full bg-transparent text-sm font-semibold text-neutral-800 placeholder:text-neutral-400 outline-none"
                                />
                            </div>
                            <button onClick={() => setFormData(p => ({...p, socialMediaLinks: {...p.socialMediaLinks, youtube: ''}}))} className="text-neutral-300 hover:text-red-500 transition-colors">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Instagram */}
                        <div className="group flex items-center gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/20 p-3 pr-5 focus-within:border-pink-200 focus-within:ring-4 focus-within:ring-pink-50 transition-all">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50 text-pink-600 border border-pink-100">
                                <Instagram className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <input
                                    type="url"
                                    name="socialMediaLinks.instagram"
                                    value={formData.socialMediaLinks.instagram}
                                    onChange={handleInputChange}
                                    placeholder="Instagram URL (@handle)"
                                    className="w-full bg-transparent text-sm font-semibold text-neutral-800 placeholder:text-neutral-400 outline-none"
                                />
                            </div>
                            <button onClick={() => setFormData(p => ({...p, socialMediaLinks: {...p.socialMediaLinks, instagram: ''}}))} className="text-neutral-300 hover:text-red-500 transition-colors">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        <button className="flex items-center gap-2 text-xs font-bold text-[var(--primary-color)] hover:underline transition-all mt-2 ml-1">
                            <Plus className="h-3 w-3" />
                            Add More Connections
                        </button>
                    </div>
                </div>

                {/* Invoice Settings (Notes & Terms) */}
                <div className="rounded-3xl bg-white p-8 shadow-sm border border-neutral-100">
                    <h2 className="text-base font-bold text-neutral-800 mb-6">Notes, Term & Conditions</h2>
                    <div className="space-y-8">
                        {/* Notes */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-neutral-800">Notes</h3>
                                    <p className="text-xs text-neutral-500 mt-1">Shown just below invoice total (e.g. "Thank you for shopping with us.")</p>
                                </div>
                                <button
                                    onClick={() => handleToggleInvoiceSetting('notes')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.invoiceSettings.notes.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.invoiceSettings.notes.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {formData.invoiceSettings.notes.enabled && (
                                <div className="relative group">
                                    <input
                                        type="text"
                                        name="invoiceSettings.notes.text"
                                        value={formData.invoiceSettings.notes.text}
                                        onChange={handleInputChange}
                                        placeholder="Enter note..."
                                        className="w-full rounded-2xl border-neutral-200 bg-neutral-50/30 px-5 py-4 text-neutral-800 font-medium placeholder:text-neutral-400 focus:border-[var(--primary-color)] focus:ring-4 focus:ring-[var(--primary-color)]/5 transition-all outline-none"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                                        <Save className="h-4 w-4" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Terms & Conditions */}
                        <div className="space-y-4 pt-4 border-t border-neutral-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-neutral-800">Terms and Conditions</h3>
                                    <p className="text-xs text-neutral-500 mt-1">Shown in small text at bottom of invoice.</p>
                                </div>
                                <button
                                    onClick={() => handleToggleInvoiceSetting('terms')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.invoiceSettings.terms.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.invoiceSettings.terms.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {formData.invoiceSettings.terms.enabled && (
                                <div className="relative group">
                                    <textarea
                                        name="invoiceSettings.terms.text"
                                        value={formData.invoiceSettings.terms.text}
                                        onChange={handleInputChange}
                                        placeholder="Enter terms and conditions..."
                                        rows={3}
                                        className="w-full rounded-2xl border-neutral-200 bg-neutral-50/30 px-5 py-4 text-neutral-800 font-medium placeholder:text-neutral-400 focus:border-[var(--primary-color)] focus:ring-4 focus:ring-[var(--primary-color)]/5 transition-all outline-none resize-none"
                                    />
                                    <div className="absolute right-4 top-4 text-neutral-400">
                                        <Save className="h-4 w-4" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* GST Details */}
                        <div className="space-y-4 pt-4 border-t border-neutral-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-neutral-800">GST Details (Optional)</h3>
                                    <p className="text-xs text-neutral-500 mt-1">Shown on invoice if enabled.</p>
                                </div>
                                <button
                                    onClick={() => handleToggleInvoiceSetting('gst')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.invoiceSettings.gst?.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.invoiceSettings.gst?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {formData.invoiceSettings.gst?.enabled && (
                                <div className="relative group">
                                    <input
                                        type="text"
                                        name="invoiceSettings.gst.text"
                                        value={formData.invoiceSettings.gst?.text || ''}
                                        onChange={handleInputChange}
                                        placeholder="Enter GST Number"
                                        className="w-full rounded-2xl border-neutral-200 bg-neutral-50/30 px-5 py-4 text-neutral-800 font-medium placeholder:text-neutral-400 focus:border-[var(--primary-color)] focus:ring-4 focus:ring-[var(--primary-color)]/5 transition-all outline-none"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                                        <Save className="h-4 w-4" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* FSSAI Number */}
                        <div className="space-y-4 pt-4 border-t border-neutral-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-neutral-800">FSSAI Number (Optional)</h3>
                                    <p className="text-xs text-neutral-500 mt-1">Shown on invoice if enabled.</p>
                                </div>
                                <button
                                    onClick={() => handleToggleInvoiceSetting('fssai')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.invoiceSettings.fssai?.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.invoiceSettings.fssai?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {formData.invoiceSettings.fssai?.enabled && (
                                <div className="relative group">
                                    <input
                                        type="text"
                                        name="invoiceSettings.fssai.text"
                                        value={formData.invoiceSettings.fssai?.text || ''}
                                        onChange={handleInputChange}
                                        placeholder="Enter FSSAI Number"
                                        className="w-full rounded-2xl border-neutral-200 bg-neutral-50/30 px-5 py-4 text-neutral-800 font-medium placeholder:text-neutral-400 focus:border-[var(--primary-color)] focus:ring-4 focus:ring-[var(--primary-color)]/5 transition-all outline-none"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                                        <Save className="h-4 w-4" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
