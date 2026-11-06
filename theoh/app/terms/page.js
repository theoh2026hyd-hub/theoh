import TermsClient from "./TermsClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://theoh.in";

export const metadata = {
  title: "Terms of Service & Delivery Policies | THE OH ! Hyderabad",
  description:
    "Review Terms of Service, ordering terms, refund policies, and delivery rules for THE OH ! natural oats cloud kitchen in Hyderabad.",
  keywords: [
    "terms of service",
    "delivery terms hyderabad",
    "the oh ordering policies",
  ],
  alternates: {
    canonical: `${siteUrl}/terms`,
  },
  openGraph: {
    title: "Terms of Service & Delivery Policies | THE OH ! Hyderabad",
    description:
      "Operational terms and ordering policies for THE OH ! oats cloud kitchen.",
    url: `${siteUrl}/terms`,
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": siteUrl,
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Terms of Service",
      "item": `${siteUrl}/terms`,
    },
  ],
};

export default function TermsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <TermsClient />
    </>
  );
}
