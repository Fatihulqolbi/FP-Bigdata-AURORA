const API_BASE = "http://localhost:4000/api";

function getToken(): string {
  return localStorage.getItem("aurora_token") || "";
}

function setToken(token: string) {
  localStorage.setItem("aurora_token", token);
}

function clearToken() {
  localStorage.removeItem("aurora_token");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const auth = {
  login: async (email: string, password: string) => {
    const data = await request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data;
  },
  register: async (data: { email: string; password: string; role: string; name: string; address?: string; lat?: number; lng?: number; contact?: string }) => {
    const result = await request<{ token: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setToken(result.token);
    return result;
  },
  getMe: () => request<any>("/auth/me"),
  updateProfile: (data: any) => request<any>("/auth/profile", { method: "PATCH", body: JSON.stringify(data) }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<any>("/auth/password", { method: "PATCH", body: JSON.stringify({ oldPassword, newPassword }) }),
  deleteAccount: (password: string) =>
    request<any>("/auth/account", { method: "DELETE", body: JSON.stringify({ password }) }),
  forgotPassword: (email: string) => request<any>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request<any>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
  logout: () => clearToken(),
  getToken,
};

// Materials
export const materials = {
  list: () => request<any[]>("/materials"),
  getById: (id: string) => request<any>(`/materials/${id}`),
  create: (data: any) => request<any>("/materials", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/materials/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/materials/${id}`, { method: "DELETE" }),
};

// Listings
export const listings = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/listings${qs}`);
  },
  getById: (id: string) => request<any>(`/listings/${id}`),
  create: (data: any) => request<any>("/listings", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/listings/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/listings/${id}`, { method: "DELETE" }),
};

// Demands
export const demands = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/demands${qs}`);
  },
  getById: (id: string) => request<any>(`/demands/${id}`),
  create: (data: any) => request<any>("/demands", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/demands/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/demands/${id}`, { method: "DELETE" }),
};

// Matches
export const matches = {
  getForDemand: (demandId: string) => request<any>(`/matches?demandId=${demandId}`),
};

// Orders
export const orders = {
  create: (data: any) => request<any>("/orders", { method: "POST", body: JSON.stringify(data) }),
  createInstant: (demandId: string) => request<any>("/orders/instant", { method: "POST", body: JSON.stringify({ demandId }) }),
  listBuyer: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/orders${qs}`);
  },
  listSeller: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/orders/seller${qs}`);
  },
  getById: (id: string) => request<any>(`/orders/${id}`),
  updateStatus: (id: string, status: string, paymentProof?: string) =>
    request<any>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, paymentProof }) }),
  approveItem: (itemId: string) =>
    request<any>(`/orders/items/${itemId}/approve`, { method: "PATCH" }),
  rejectItem: (itemId: string) =>
    request<any>(`/orders/items/${itemId}/reject`, { method: "PATCH" }),
};

// Admin
export const admin = {
  getVerifications: () => request<any[]>("/auth/admin/verifications"),
  verifyUser: (userId: string, status: string) =>
    request<any>(`/auth/admin/verifications/${userId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

// TPS
export const tps = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/tps${qs}`);
  },
  getById: (id: string) => request<any>(`/tps/${id}`),
  create: (data: any) => request<any>("/tps", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/tps/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateVolume: (id: string, currentVolume: number) =>
    request<any>(`/tps/${id}/volume`, { method: "PATCH", body: JSON.stringify({ currentVolume }) }),
  delete: (id: string) => request<any>(`/tps/${id}`, { method: "DELETE" }),
};

export default {
  auth,
  materials,
  listings,
  demands,
  matches,
  orders,
  admin,
  tps,
};
