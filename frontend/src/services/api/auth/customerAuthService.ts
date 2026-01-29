import api, { setAuthToken, removeAuthToken } from '../config';
import { setModuleUserData, detectModuleFromPath } from '../../../utils/moduleAuth';

export interface SendOTPResponse {
  success: boolean;
  message: string;
  sessionId?: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      name: string;
      phone: string;
      email: string;
      walletAmount: number;
      refCode: string;
      status: string;
    };
  };
}

export interface RegisterData {
  name: string;
  mobile: string;
  email: string;
  dateOfBirth?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      name: string;
      phone: string;
      email: string;
      walletAmount: number;
      refCode: string;
      status: string;
    };
  };
}

/**
 * Send SMS OTP to customer mobile number
 */
export const sendOTP = async (mobile: string): Promise<SendOTPResponse> => {
  const response = await api.post<SendOTPResponse>('/auth/customer/send-sms-otp', { mobile });
  return response.data;
};

/**
 * Verify SMS OTP and login customer
 */
export const verifyOTP = async (mobile: string, otp: string, sessionId?: string): Promise<VerifyOTPResponse> => {
  const response = await api.post<VerifyOTPResponse>('/auth/customer/verify-sms-otp', { mobile, otp, sessionId });

  if (response.data.success && response.data.data.token) {
    const module = detectModuleFromPath();
    console.log('🔍 Customer Login - Detected module:', module);
    setAuthToken(response.data.data.token);
    // Add userType to user data for proper identification
    const userData = {
      ...response.data.data.user,
      userType: 'Customer' as const
    };
    setModuleUserData(userData, module);
    console.log('✅ Customer Login - Token and user data saved for module:', module);
  }

  return response.data;
};

/**
 * Register new customer
 */
export const register = async (data: RegisterData): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/auth/customer/register', data);

  // Note: Registration typically logs user in automatically in original implementation,
  // but SignUp.tsx flow suggests OTP is required AFTER register?
  // Actually original SignUp.tsx: calls register(), then sendOTP(), then verifyOTP().
  // If register returns token, we might set it, but then verifyOTP overwrites it?

  if (response.data.success && response.data.data.token) {
    const module = detectModuleFromPath();
    setAuthToken(response.data.data.token);
    // Add userType to user data for proper identification
    const userData = {
      ...response.data.data.user,
      userType: 'Customer'
    };
    setModuleUserData(userData, module);
  }

  return response.data;
};

/**
 * Logout customer
 */
export const logout = (): void => {
  removeAuthToken();
};
