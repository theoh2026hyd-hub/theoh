"use client";

import SiteAudioProvider from "./SiteAudioProvider";
import CartFloatingBar from "./CartFloatingBar";
import ToastProvider from "./errors/ToastProvider";
import NetworkStatusProvider from "./errors/NetworkError";

export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <NetworkStatusProvider>
        <SiteAudioProvider>
          {children}
          <CartFloatingBar />
        </SiteAudioProvider>
      </NetworkStatusProvider>
    </ToastProvider>
  );
}
