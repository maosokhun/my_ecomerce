import axios from 'axios';

/** Browser: default `/api` (rewritten to Express in next.config). Override with NEXT_PUBLIC_API_URL for prod. */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return '/api';
  return process.env.INTERNAL_API_URL?.trim() || 'http://127.0.0.1:5000/api';
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach token automatically
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary for file uploads
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Let pages/stores decide how to handle 401 to avoid
// redirect loops during hydration or transient failures.
api.interceptors.response.use((response) => response, (error) => Promise.reject(error));

// Auth
export const authApi = {
  register: (data: {
    name: string;
    email?: string;
    phone: string;
    password: string;
    clientLatitude?: number;
    clientLongitude?: number;
  }) => api.post('/auth/register', data),
  login: (data: {
    identifier: string;
    password: string;
    clientLatitude?: number;
    clientLongitude?: number;
  }) => api.post('/auth/login', data),
  facebookLogin: (data: {
    accessToken: string;
    clientLatitude?: number;
    clientLongitude?: number;
  }) => api.post('/auth/facebook', data),
  googleLogin: (data: {
    credential: string;
    clientLatitude?: number;
    clientLongitude?: number;
  }) => api.post('/auth/google', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: Partial<{ name: string; phone: string; avatar: string }>) =>
    api.put('/auth/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/password', data),
  requestPasswordResetByEmail: (data: { email: string }) =>
    api.post('/auth/forgot-password/email/request', data),
  resetPasswordByEmailCode: (data: { email: string; code: string; newPassword: string }) =>
    api.post('/auth/forgot-password/email/verify', data),
  resetPasswordByInfo: (data: { name: string; phone: string; newPassword: string }) =>
    api.post('/auth/forgot-password/info/verify', data),
};

// Products
export const productApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/products', { params }),
  /** Lightweight autocomplete / instant search (name, brand, category, slug). */
  suggest: (params: { q: string; limit?: number; lang?: string }) =>
    api.get('/products/suggestions', { params }),
  getFeatured: (lang: 'km' | 'en' | 'zh' = 'km') => api.get('/products/featured', { params: { lang } }),
  getBySlug: (slug: string, lang: 'km' | 'en' | 'zh' = 'km') => api.get(`/products/${slug}`, { params: { lang } }),
  getRelated: (slug: string, lang: 'km' | 'en' | 'zh' = 'km') => api.get(`/products/${slug}/related`, { params: { lang } }),
  create: (data: unknown) => api.post('/products', data),
  update: (id: string, data: unknown) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// Categories
export const categoryApi = {
  getAll: () => api.get('/categories'),
  getBySlug: (slug: string) => api.get(`/categories/${slug}`),
  create: (data: unknown) => api.post('/categories', data),
  update: (id: string, data: unknown) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Cart
export const cartApi = {
  get: () => api.get('/cart'),
  add: (data: { productId: string; quantity: number; variantId?: string }) =>
    api.post('/cart', data),
  update: (itemId: string, quantity: number) =>
    api.put(`/cart/${itemId}`, { quantity }),
  remove: (itemId: string) => api.delete(`/cart/${itemId}`),
  clear: () => api.delete('/cart/clear'),
};

// Orders
export const orderApi = {
  create: (data: {
    addressId?: string;
    paymentMethod?: string;
    notes?: string;
    couponCode?: string;
    shippingCarrier?: 'VET' | 'JNT';
  }) => api.post('/orders', data),
  previewCoupon: (data: { couponCode?: string; shippingCarrier?: 'VET' | 'JNT' }) =>
    api.post('/orders/coupon-preview', data),
  getAll: (params?: Record<string, unknown>) => api.get('/orders', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  getInvoice: (id: string, lang?: 'km' | 'en' | 'zh') =>
    api.get(`/orders/${id}/invoice`, { params: lang ? { lang } : {} }),
  cancel: (id: string) => api.put(`/orders/${id}/cancel`),
  archiveHistory: (id: string) => api.delete(`/orders/${id}/history`),
  confirmPayment: (data: { orderId: string; paymentIntentId: string }) =>
    api.post('/orders/confirm-payment', data),
  createStripePaymentIntent: (orderId: string) =>
    api.post('/orders/stripe-payment-intent', { orderId }),
  // Admin
  adminGetAll: (params?: Record<string, unknown>) => api.get('/orders/admin/all', { params }),
  adminUpdateStatus: (id: string, data: unknown) =>
    api.put(`/orders/admin/${id}/status`, data),
};

// Payments
export const paymentApi = {
  createKhqr: (orderId: string) => api.post('/payments/khqr/create', { orderId }),
  getKhqrStatus: (orderId: string) => api.get(`/payments/khqr/status/${orderId}`),
  mockConfirmKhqr: (orderId: string) => api.post(`/payments/khqr/mock-confirm/${orderId}`),
};

// Reviews
export const reviewApi = {
  getMine: () => api.get('/reviews/me'),
  getByProduct: (productId: string, params?: Record<string, unknown>) =>
    api.get(`/reviews/product/${productId}`, { params }),
  create: (productId: string, data: unknown) =>
    api.post(`/reviews/product/${productId}`, data),
  update: (reviewId: string, data: unknown) => api.put(`/reviews/${reviewId}`, data),
  delete: (reviewId: string) => api.delete(`/reviews/${reviewId}`),
};

// User
export const userApi = {
  getAddresses: () => api.get('/users/addresses'),
  addAddress: (data: unknown) => api.post('/users/addresses', data),
  updateAddress: (id: string, data: unknown) => api.put(`/users/addresses/${id}`, data),
  deleteAddress: (id: string, lang?: 'km' | 'en' | 'zh') =>
    api.delete(`/users/addresses/${id}`, { params: lang ? { lang } : {} }),
  getWishlist: (lang: 'km' | 'en' | 'zh' = 'km') => api.get('/users/wishlist', { params: { lang } }),
  toggleWishlist: (productId: string) => api.post('/users/wishlist', { productId }),
};

export const locationApi = {
  getProvinces: (lang: 'km' | 'en' | 'zh' = 'km') => api.get('/locations/provinces', { params: { lang } }),
  getDistricts: (provinceId: string, lang: 'km' | 'en' | 'zh' = 'km') =>
    api.get(`/locations/districts/${encodeURIComponent(provinceId)}`, { params: { lang } }),
  /** Pass provinceId when district value is official code (optional for internal cuid). */
  getCommunes: (districtId: string, lang: 'km' | 'en' | 'zh' = 'km', provinceId?: string) =>
    api.get(`/locations/communes/${encodeURIComponent(districtId)}`, {
      params: { lang, ...(provinceId ? { provinceId } : {}) },
    }),
  /** Pass districtId + provinceId when commune value is official code. */
  getVillages: (
    communeId: string,
    lang: 'km' | 'en' | 'zh' = 'km',
    opts?: { districtId?: string; provinceId?: string }
  ) =>
    api.get(`/locations/villages/${encodeURIComponent(communeId)}`, {
      params: {
        lang,
        ...(opts?.districtId ? { districtId: opts.districtId } : {}),
        ...(opts?.provinceId ? { provinceId: opts.provinceId } : {}),
      },
    }),
};

// Admin
export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  /** Full product catalog (active + inactive) — use for admin UI only */
  getProducts: (params?: Record<string, unknown>) => api.get('/admin/products', { params }),
  getCategories: () => api.get('/admin/categories'),
  getUsers: (params?: Record<string, unknown>) => api.get('/admin/users', { params }),
  updateUser: (id: string, data: unknown) => api.put(`/admin/users/${id}`, data),
  getCoupons: () => api.get('/admin/coupons'),
  createCoupon: (data: unknown) => api.post('/admin/coupons', data),
  updateCoupon: (id: string, data: unknown) => api.put(`/admin/coupons/${id}`, data),
  deleteCoupon: (id: string) => api.delete(`/admin/coupons/${id}`),
  getUnreadCounts: () => api.get('/admin/unread-counts'),
  markSeen: (type: 'orders' | 'users' | 'leads') => api.post('/admin/mark-seen', { type }),
};

// Site Settings
export const settingApi = {
  get: () => api.get('/settings'),
  update: (data: unknown) => api.put('/settings', data),
};

/** Admin image upload (multipart). Saves to Cloudinary if configured, else server disk at /uploads/… */
export const uploadApi = {
  uploadProductImage: (file: File, folder = 'products') => {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('folder', folder);
    return api.post<{ success: boolean; data: { url: string; publicId?: string | null } }>('/upload/image', fd, {
      timeout: 120000,
    });
  },
};

export const supportApi = {
  createInquiry: (data: { name: string; phone: string; question: string; priority?: 'ORDER' | 'PAYMENT' | 'PRODUCT' | 'GENERAL'; transcript?: string }) =>
    api.post('/support/inquiries', data),
  getInquiries: () => api.get('/support/inquiries'),
};

export const leadApi = {
  subscribe: (data: { email: string; phone?: string }) => api.post('/leads/subscribe', data),
  getAll: () => api.get('/leads'),
};
