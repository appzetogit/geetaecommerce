import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, sendOTP, verifyOTP } from '../../services/api/auth/customerAuthService';
import { useAuth } from '../../context/AuthContext';
import OTPInput from '../../components/OTPInput';
import { requestNotificationPermission } from '../../services/pushNotificationService';

export default function SignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    dateOfBirth: '',
  });
  const [sessionId, setSessionId] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoSectionRef = useRef<HTMLDivElement>(null);
  const loginSectionRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'mobile') {
      setFormData(prev => ({
        ...prev,
        [name]: value.replace(/\D/g, '').slice(0, 10),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.mobile || !formData.email) {
      setError('Name, mobile, and email are required');
      return;
    }

    if (formData.mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await register({
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email,
        dateOfBirth: formData.dateOfBirth || undefined,
      });

      if (response.success) {
        // Registration successful, now send OTP for verification
        try {
          const otpRes = await sendOTP(formData.mobile);
          if (otpRes.sessionId) setSessionId(otpRes.sessionId);
          setShowOTP(true);
        } catch (otpErr: any) {
          setError(otpErr.response?.data?.message || 'Registration successful but failed to setup call.');
        }

        // Capture FCM Token immediately after registration (even before OTP)
        if (response.data?.token) {
          requestNotificationPermission('customer', response.data.token);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await verifyOTP(formData.mobile, otp, sessionId);
      if (response.success && response.data) {
        // Update auth context with user data
        login(response.data.token, {
          id: response.data.user.id,
          name: response.data.user.name,
          phone: response.data.user.phone,
          email: response.data.user.email,
          walletAmount: response.data.user.walletAmount,
          refCode: response.data.user.refCode,
          status: response.data.user.status,
        });

        // Request notification permission
        await requestNotificationPermission('customer', response.data.token);

        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const updateOverlayPosition = () => {
      if (videoSectionRef.current && loginSectionRef.current && overlayRef.current) {
        requestAnimationFrame(() => {
          if (videoSectionRef.current && loginSectionRef.current && overlayRef.current) {
            const videoRect = videoSectionRef.current.getBoundingClientRect();
            const boundaryY = videoRect.bottom;
            const overlayHeight = 12;
            overlayRef.current.style.top = `${boundaryY - overlayHeight / 2}px`;
            overlayRef.current.style.height = `${overlayHeight}px`;
          }
        });
      }
    };

    const timeoutId1 = setTimeout(updateOverlayPosition, 50);
    const timeoutId2 = setTimeout(updateOverlayPosition, 200);
    const timeoutId3 = setTimeout(updateOverlayPosition, 500);

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateOverlayPosition, 100);
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      updateOverlayPosition();
    });

    if (videoSectionRef.current) {
      resizeObserver.observe(videoSectionRef.current);
    }
    if (loginSectionRef.current) {
      resizeObserver.observe(loginSectionRef.current);
    }

    window.addEventListener('scroll', updateOverlayPosition, { passive: true });

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', updateOverlayPosition);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="h-screen bg-white flex flex-col" style={{ overflow: 'hidden', backgroundColor: '#ffffff', width: '100%', margin: 0, padding: 0, boxSizing: 'border-box' }}>
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-neutral-50 transition-colors"
        aria-label="Back"
      >
        <svg width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Video Section */}
      <div
        ref={videoSectionRef}
        className="overflow-hidden relative flex-1"
        style={{ minHeight: 0, border: 'none', borderBottom: 'none', padding: 0, margin: 0, marginLeft: '2px', backgroundColor: '#ffffff', zIndex: 0, width: 'calc(100% - 2px)', boxSizing: 'border-box', position: 'relative' }}
      >
        <video
          ref={videoRef}
          src="/assets/login/loginvideo.mp4?v=2"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          key="login-video-v2"
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.playbackRate = 1.5;
            }
          }}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            margin: 0,
            padding: 0,
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            verticalAlign: 'top',
            objectFit: 'cover',
            objectPosition: 'center top',
            background: 'transparent',
            position: 'relative',
            zIndex: 0,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            transform: 'translateY(-60px)',
            marginTop: '-60px'
          }}
        />
      </div>

      {/* Unified white overlay */}
      <div
        ref={overlayRef}
        className="fixed bg-white"
        style={{
          height: '12px',
          zIndex: 10,
          left: '0px',
          right: '0px',
          width: '100%',
          pointerEvents: 'none'
        }}
      ></div>

      {/* Sign Up Section */}
      <div
        ref={loginSectionRef}
        className="bg-white flex flex-col items-center flex-shrink-0 relative"
        style={{ border: 'none', borderTop: 'none', margin: 0, marginTop: '-100px', marginLeft: '-2px', boxShadow: 'none', outline: 'none', backgroundColor: '#ffffff', zIndex: 1, padding: '4px 0px 12px', paddingTop: '6px', width: 'calc(100% + 4px)', boxSizing: 'border-box', position: 'relative' }}
      >
        {!showOTP ? (
          <form onSubmit={handleSubmit} className="w-full px-4 space-y-2 relative z-10">
            <h2 className="text-lg font-bold text-neutral-800 mb-3 text-center">Create Account</h2>

            {/* Name Input */}
            <div className="mb-2">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Full Name"
                required
                className="w-full px-3 py-2 sm:py-2.5 text-sm border border-neutral-300 rounded-lg placeholder:text-neutral-400 focus:outline-none focus:border-orange-500 bg-white"
                style={{ color: '#9ca3af', backgroundColor: '#ffffff' }}
                disabled={loading}
              />
            </div>

            {/* Mobile Input */}
            <div className="mb-2">
              <div className="flex items-center bg-white border border-neutral-300 rounded-lg overflow-hidden focus-within:border-orange-500 transition-colors">
                <div className="px-3 py-2 sm:py-2.5 text-sm font-medium text-neutral-400 border-r border-neutral-300 bg-white">
                  +91
                </div>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  placeholder="Mobile Number"
                  required
                  className="flex-1 px-3 py-2 sm:py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none bg-white"
                  style={{ color: '#9ca3af', backgroundColor: '#ffffff' }}
                  maxLength={10}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="mb-2">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Email Address"
                required
                className="w-full px-3 py-2 sm:py-2.5 text-sm border border-neutral-300 rounded-lg placeholder:text-neutral-400 focus:outline-none focus:border-orange-500 bg-white"
                style={{ color: '#9ca3af', backgroundColor: '#ffffff' }}
                disabled={loading}
              />
            </div>

            {/* Date of Birth Input */}
            <div className="mb-2">
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                placeholder="Date of Birth (Optional)"
                className="w-full px-3 py-2 sm:py-2.5 text-sm border border-neutral-300 rounded-lg placeholder:text-neutral-400 focus:outline-none focus:border-orange-500 bg-white"
                style={{ color: '#9ca3af', backgroundColor: '#ffffff' }}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded text-center">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !formData.name || formData.mobile.length !== 10 || !formData.email}
              className={`w-full py-2 sm:py-2.5 rounded-lg font-semibold text-sm transition-colors border px-3 ${formData.name && formData.mobile.length === 10 && formData.email && !loading
                ? 'bg-orange-50 text-orange-600 border-orange-500 hover:bg-orange-100'
                : 'bg-neutral-300 text-neutral-500 cursor-not-allowed border-neutral-300'
                }`}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>

            {/* Login Link */}
            <div className="text-center pt-2">
              <p className="text-xs text-neutral-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-orange-600 hover:text-orange-700 font-semibold"
                >
                  Login
                </button>
              </p>
            </div>
          </form>
        ) : (
          <>
            {/* OTP Verification */}
            <div className="w-full mb-2 px-4 relative z-10 text-center">
              <p className="text-xs text-neutral-600 mb-2">
                Enter the 4-digit OTP sent via call to
              </p>
              <p className="text-xs font-semibold text-neutral-800">+91 {formData.mobile}</p>
            </div>
            <div className="w-full mb-2 px-4 relative z-10 flex justify-center">
              <OTPInput onComplete={handleOTPComplete} disabled={loading} />
            </div>
            {error && (
              <div className="w-full mb-1 px-4 relative z-10 text-xs text-red-600 bg-red-50 p-2 rounded text-center">
                {error}
              </div>
            )}
            <div className="w-full mb-1 px-4 relative z-10 flex gap-2">
              <button
                onClick={() => {
                  setShowOTP(false);
                  setError('');
                }}
                disabled={loading}
                className="flex-1 py-2 rounded-lg font-semibold text-xs bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors border border-neutral-300"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2 rounded-lg font-semibold text-xs bg-orange-50 text-orange-600 border border-orange-500 hover:bg-orange-100 transition-colors"
              >
                {loading ? 'Verifying...' : 'Resend OTP'}
              </button>
            </div>
          </>
        )}

        {/* Privacy Text */}
        <p className="text-[9px] sm:text-[10px] text-neutral-500 text-center max-w-sm leading-tight px-4 relative z-10 pb-1 mt-2">
          By signing up, you agree to Geeta Stores's Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

