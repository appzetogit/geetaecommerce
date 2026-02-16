import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

// Icons (using simple SVGs to avoid dependency issues if lucide-react etc are not installed,
// matching style from AdminSidebar)
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
);
const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
);
// We can reuse GoogleIcon as placeholder or create specific ones if needed.
// For now, using generic icons to keep it simple and clean.

const tabs = [
    { id: 'mail', label: 'Mail Setting', icon: <MailIcon /> },
    { id: 'google', label: 'Google API / Recaptcha', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg> },
    { id: 'firebase', label: 'Firebase Setting', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> },
    { id: 'notification', label: 'Notification Setting', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> },

    { id: 'social', label: 'Social Links', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg> },
    { id: 'thirdparty', label: '3rd Party API', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> },


    { id: 'other', label: 'Other Setting', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> },
];

export default function AdminAppSettings() {
    const [activeTab, setActiveTab] = useState('mail');
    const [isLoading, setIsLoading] = useState(false);

    // Mock form states
    const [mailForm, setMailForm] = useState({ mailerName: '', host: '', driver: '', port: '', userName: '', emailId: '', encryption: '', password: '' });
    const [googleForm, setGoogleForm] = useState({ analyticsId: '', recaptchaSiteKey: '', recaptchaSecretKey: '', mapApiKey: '' });
    const [firebaseForm, setFirebaseForm] = useState({ apiKey: '', authDomain: '', projectId: '', storageBucket: '', msgSenderId: '', appId: '', measurementId: '' });
    const [notifForm, setNotifForm] = useState({ fcmKey: '', enablePush: true, enableEmail: true });
    const [loginForm, setLoginForm] = useState({ enableGoogle: true, enableFacebook: false, enablePhone: true, enableEmail: true });
    // ... similarly for others. For brevity in this file, I'll use direct state or simplified handler

    const handleUpdate = () => {
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            toast.success('Settings updated successfully!');
        }, 800);
    };

    const renderContent = () => {
        switch(activeTab) {
            case 'mail': return (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Mail Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label="Mailer Name" value={mailForm.mailerName} onChange={e => setMailForm({...mailForm, mailerName: e.target.value})} />
                        <InputGroup label="Host (e.g. smtp.gmail.com)" value={mailForm.host} onChange={e => setMailForm({...mailForm, host: e.target.value})} />
                        <InputGroup label="Driver (e.g. smtp)" value={mailForm.driver} onChange={e => setMailForm({...mailForm, driver: e.target.value})} />
                        <InputGroup label="Port (e.g. 587)" value={mailForm.port} onChange={e => setMailForm({...mailForm, port: e.target.value})} />
                        <InputGroup label="Username" value={mailForm.userName} onChange={e => setMailForm({...mailForm, userName: e.target.value})} />
                        <InputGroup label="Email ID" value={mailForm.emailId} type="email" onChange={e => setMailForm({...mailForm, emailId: e.target.value})} />
                        <InputGroup label="Encryption (e.g. tls)" value={mailForm.encryption} onChange={e => setMailForm({...mailForm, encryption: e.target.value})} />
                        <InputGroup label="Password" type="password" value={mailForm.password} onChange={e => setMailForm({...mailForm, password: e.target.value})} />
                    </div>
                </div>
            );
            case 'google': return (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Google API & Recaptcha</h3>
                     <div className="grid grid-cols-1 gap-6">
                        <InputGroup label="Google Analytics ID" placeholder="UA-XXXXX-Y" />
                        <InputGroup label="Recaptcha Site Key" />
                        <InputGroup label="Recaptcha Secret Key" type="password" />
                        <InputGroup label="Google Map API Key" />
                     </div>
                </div>
            );
            case 'firebase': return (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Firebase Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label="API Key" />
                        <InputGroup label="Auth Domain" />
                        <InputGroup label="Project ID" />
                        <InputGroup label="Storage Bucket" />
                        <InputGroup label="Messaging Sender ID" />
                        <InputGroup label="App ID" />
                        <InputGroup label="Measurement ID" />
                    </div>
                </div>
            );
            case 'notification': return (
                <div className="space-y-6">
                     <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Notification Settings</h3>
                     <div className="grid grid-cols-1 gap-6">
                        <InputGroup label="FCM Server Key" type="password" />
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <span className="font-medium">Enable Push Notifications</span>
                            <ToggleSwitch checked={notifForm.enablePush} onChange={() => setNotifForm({...notifForm, enablePush: !notifForm.enablePush})} />
                        </div>
                         <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <span className="font-medium">Enable Email Notifications</span>
                            <ToggleSwitch checked={notifForm.enableEmail} onChange={() => setNotifForm({...notifForm, enableEmail: !notifForm.enableEmail})} />
                        </div>
                     </div>
                </div>
            );

             case 'social': return (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Social Media Links</h3>
                    <div className="grid grid-cols-1 gap-6">
                        <InputGroup label="Facebook URL" placeholder="https://facebook.com/..." />
                        <InputGroup label="Twitter URL" placeholder="https://twitter.com/..." />
                        <InputGroup label="Instagram URL" placeholder="https://instagram.com/..." />
                        <InputGroup label="LinkedIn URL" placeholder="https://linkedin.com/..." />
                        <InputGroup label="Youtube URL" placeholder="https://youtube.com/..." />
                    </div>
                </div>
            );
            case 'thirdparty': return (
                <div className="space-y-6">
                     <h3 className="text-xl font-bold text-gray-800 border-b pb-4">3rd Party APIs</h3>
                     <div className="grid grid-cols-1 gap-6">
                         <InputGroup label="SMS Gateway Key" type="password" />
                         <InputGroup label="Payment Gateway Key" type="password" />
                     </div>
                </div>
            );


             case 'other': return (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Other Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <InputGroup label="Currency Symbol" value="$" />
                         <InputGroup label="Currency Code" value="USD" />
                         <div className='md:col-span-2'>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                             <select className="w-full border-gray-300 rounded-md shadow-sm focus:border-[#f187b5] focus:ring focus:ring-[#f187b5] focus:ring-opacity-50 p-2 border">
                                <option>UTC</option>
                                <option>IST (India)</option>
                                <option>EST (US)</option>
                            </select>
                         </div>
                         <ToggleItem label="Maintenance Mode" checked={false} onChange={() => {}} />
                         <ToggleItem label="Force Update" checked={false} onChange={() => {}} />
                    </div>
                </div>
            );
            default: return <div>Select a setting</div>;
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-gray-50 font-sans">
            {/* Left Sidebar */}
            <div className="w-full md:w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0 shadow-sm z-10">
                <div className="p-4 border-b border-gray-100 bg-[#f187b5]/10">
                    <h2 className="font-bold text-[#f187b5] text-lg">App Setting</h2>
                </div>
                <div className="py-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 border-l-4 ${
                                activeTab === tab.id
                                ? 'border-[#f187b5] text-[#f187b5] bg-pink-50'
                                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                            <span className="mr-3 text-lg opacity-80">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 min-h-[500px]">
                    {renderContent()}

                    {/* Footer Actions */}
                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                        <button
                            onClick={handleUpdate}
                            disabled={isLoading}
                            className={`px-6 py-2.5 rounded-lg text-white font-medium shadow-md transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f187b5] ${isLoading ? 'bg-pink-300 cursor-not-allowed' : 'bg-[#f187b5] hover:bg-[#e076a5]'}`}
                        >
                            {isLoading ? 'Updating...' : 'Update'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sub-components for cleaner code
function InputGroup({ label, type = "text", value, onChange, placeholder }: any) {
    return (
        <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] transition-colors"
                autoComplete="off"
            />
        </div>
    );
}

function ToggleItem({ label, checked, onChange }: any) {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
            <span className="font-medium text-gray-700">{label}</span>
            <ToggleSwitch checked={checked} onChange={onChange} />
        </div>
    );
}

function ToggleSwitch({ checked, onChange }: any) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-[#f187b5]' : 'bg-gray-200'}`}
        >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );
}
