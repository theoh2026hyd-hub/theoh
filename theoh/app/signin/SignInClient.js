"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserAuthPanel from "../components/UserAuthPanel";
import { useAuth } from "../hooks/useAuth";

export default function SignInClient() {
  const router = useRouter();
  const { isLoggedIn, isProfileComplete, loading } = useAuth();

  useEffect(() => {
    if (!loading && (isLoggedIn || isProfileComplete)) {
      router.replace("/profile");
    }
  }, [isLoggedIn, isProfileComplete, loading, router]);

  const handleAuthenticated = () => {
    router.replace("/profile");
  };

  return (
    <div className="app-container">
      <Navbar
        onCartToggle={() => {
          if (typeof window !== "undefined") {
            window.location.href = "/cart";
          }
        }}
        cartCount={0}
        onDashboardToggle={() => {}}
        activeDashboard={null}
        userCoins={0}
        isLoggedIn={isLoggedIn}
        activeSection="signin"
        setActiveSection={() => {}}
      />
      <main className="signin-page-main" style={{ minHeight: "70vh", padding: "40px 16px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: "960px" }}>
          <UserAuthPanel onAuthenticated={handleAuthenticated} variant="page" />
        </div>
      </main>
      <Footer onDashboardToggle={() => {}} setActiveSection={() => {}} />
    </div>
  );
}
