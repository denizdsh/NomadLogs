import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { trpc } from "../utils/trpc";
import type { UserRole } from "~/types/content";
import { STORAGE_KEYS } from "~/constants/storage";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  verifiedPostCount: number;
  donationLinks: any;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refetchSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getSessionQuery = trpc.auth.getSession.useQuery(undefined, {
    enabled: false, // manual control
  });

  const refetchSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getSessionQuery.refetch();
      if (response.data?.user) {
        setUser(response.data.user as any as User);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to fetch session:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [getSessionQuery]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      refetchSession();
    } else {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
        refetchSession,
      }}
    >
      {children}
    </AuthContext>
  );
}
