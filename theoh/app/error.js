"use client";

import { useEffect } from "react";
import ErrorPage from "./components/errors/ErrorPage";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log error to console only — never expose to users
    console.error("Application error:", error);
  }, [error]);

  return (
    <ErrorPage
      statusCode="500"
      title="Something Went Wrong"
      description="We couldn't load this page right now. Please try again."
      illustration="server-error"
      actions={[
        { label: "Try Again", icon: "retry", onClick: () => reset(), variant: "primary" },
        { label: "Go Home", icon: "home", href: "/", variant: "secondary" },
      ]}
    />
  );
}
