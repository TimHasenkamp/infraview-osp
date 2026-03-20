"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: string | null;
  token: string | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === "/login") {
      setLoading(false);
      return;
    }

    const savedToken = localStorage.getItem("infraview_token");
    if (!savedToken) {
      router.push("/login");
      setLoading(false);
      return;
    }

    // Verify token with backend
    fetch("/api/proxy/auth/me", {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setToken(savedToken);
      })
      .catch(() => {
        localStorage.removeItem("infraview_token");
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [pathname, router]);

  const logout = async () => {
    await fetch("/api/proxy/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("infraview_token");
    setUser(null);
    setToken(null);
    router.push("/login");
  };

  // Don't gate the login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
