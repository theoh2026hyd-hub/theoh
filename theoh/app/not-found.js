"use client";

import ErrorPage from "./components/errors/ErrorPage";

export default function NotFound() {
  return (
    <ErrorPage
      statusCode="404"
      title="Page Not Found"
      description="The page you're looking for doesn't exist or may have been moved."
      illustration="not-found"
      actions={[
        { label: "Go Home", icon: "home", href: "/", variant: "primary" },
        { label: "Go Back", icon: "back", variant: "secondary" },
      ]}
    />
  );
}
