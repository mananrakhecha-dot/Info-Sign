import api from "./client";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  identity_level: "NONE" | "SES" | "AES";
  edisclosure_accepted: boolean;
  phone_verified: boolean;
  phone_number?: string;
}

export const authApi = {
  register: (
    email: string,
    password: string,
    full_name: string,
    edisclosure: boolean,
  ) =>
    api.post<{ message: string; verifyUrl?: string }>("/auth/register", {
      email,
      password,
      full_name,
      edisclosure,
    }),

  login: (email: string, password: string) =>
    api.post<{ user: User; accessToken: string }>("/auth/login", {
      email,
      password,
    }),

  logout: () => api.post("/auth/logout"),

  me: () => api.get<User>("/auth/me"),

  refresh: () => api.post<{ accessToken: string }>("/auth/refresh"),

  acceptEDisclosure: () => api.post("/auth/edisclosure"),

  sendOTP: (phone_number: string) =>
    api.post("/auth/otp/send", { phone_number }),

  verifyOTP: (otp_code: string) => api.post("/auth/otp/verify", { otp_code }),

  updateProfile: (data: { full_name: string }) =>
    api.patch<{ message: string }>("/auth/profile", data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post<{ message: string }>("/auth/change-password", data),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/auth/forgot-password", { email }),

  validateResetToken: (token: string) =>
    api.get<{ valid: boolean }>(`/auth/validate-reset-token?token=${token}`),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>("/auth/reset-password", { token, password }),
};
