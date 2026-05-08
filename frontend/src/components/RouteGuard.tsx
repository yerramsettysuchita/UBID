"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";

const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  OFFICER:    ["/search", "/lookup", "/pincode", "/query", "/business"],
  REVIEWER:   ["/search", "/pincode", "/query", "/review", "/operations/clusters", "/business", "/graph"],
  SUPERVISOR: ["/search", "/lookup", "/pincode", "/query", "/review", "/operations/clusters", "/analytics", "/dashboard", "/business", "/graph"],
  ADMIN:      ["/search", "/lookup", "/pincode", "/query", "/review", "/operations/clusters", "/analytics", "/dashboard", "/admin", "/business", "/graph"],
  AUDITOR:    ["/search", "/pincode", "/query", "/review", "/operations/clusters", "/analytics", "/dashboard", "/business", "/graph"],
};

function isAllowed(role: string, pathname: string): boolean {
  const allowed = ROLE_ALLOWED_PATHS[role] ?? [];
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/") {
      setReady(true);
      return;
    }

    if (!user || !token) {
      router.replace("/");
      return;
    }

    if (!isAllowed(user.role, pathname)) {
      // Redirect to their default landing page
      const defaults: Record<string, string> = {
        OFFICER:    "/search",
        REVIEWER:   "/review",
        SUPERVISOR: "/dashboard",
        ADMIN:      "/admin",
        AUDITOR:    "/dashboard",
      };
      router.replace(defaults[user.role] ?? "/search");
      return;
    }

    setReady(true);
  }, [user, token, pathname, router]);

  if (!ready && pathname !== "/login" && pathname !== "/") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#F8FAFC",
      }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "3px solid #E0E7FF", borderTopColor: "#4F46E5",
            animation: "spin 0.7s linear infinite",
          }} />
          <span style={{ fontSize: 13, color: "#6B7280", fontFamily: "'Poppins', sans-serif" }}>
            Verifying access…
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
