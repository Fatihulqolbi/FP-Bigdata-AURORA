import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { auth as authApi } from "../features/marketplace/api/marketplaceApi";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  status: string;
  permissions: string[];
  adminLevel?: string;
  kecamatan?: string;
  assignedKecamatans?: string[];
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string>;
  register: (data: RegisterData) => Promise<string>;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  role: string;
  name: string;
  kecamatan?: string;
  address?: string;
  lat?: number;
  lng?: number;
  contact?: string;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  login: async () => "",
  register: async () => "",
  logout: () => {},
  hasPermission: () => false,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = authApi.getToken();
    if (savedToken) {
      setToken(savedToken);
      authApi
        .getMe()
        .then((me: any) => {
          setUser({
            id: me.id,
            email: me.email,
            role: me.role,
            name: me.name,
            status: me.status,
            permissions: me.permissions || [],
            adminLevel: me.adminLevel,
            kecamatan: me.kecamatan,
            assignedKecamatans: me.assignedKecamatans,
          });
        })
        .catch(() => {
          authApi.logout();
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data: any = await authApi.login(email, password);
    setToken(data.token);
    setUser({
      id: data.user.id,
      email: data.user.email,
      role: data.user.role,
      name: data.user.name,
      status: data.user.status,
      permissions: data.user.permissions || [],
      adminLevel: data.user.adminLevel,
      kecamatan: data.user.kecamatan,
      assignedKecamatans: data.user.assignedKecamatans,
    });
    return data.user.role;
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const result: any = await authApi.register(data);
    setToken(result.token);
    setUser({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      name: result.user.name,
      status: result.user.status,
      permissions: result.user.permissions || [],
      adminLevel: result.user.adminLevel,
      kecamatan: data.kecamatan,
    });
    return result.user.role;
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    setToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me: any = await authApi.getMe();
      setUser({
        id: me.id,
        email: me.email,
        role: me.role,
        name: me.name,
        status: me.status,
        permissions: me.permissions || [],
        adminLevel: me.adminLevel,
        kecamatan: me.kecamatan,
        assignedKecamatans: me.assignedKecamatans,
      });
    } catch {
      // ignore
    }
  }, []);

  const hasPermission = useCallback(
    (perm: string) => {
      if (!user) return false;
      return user.permissions.includes(perm);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
