import DeliveryMapClient from "./DeliveryMapClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://theoh.in";

export const metadata = {
  title: "Delivery Coverage & Area Map in Hyderabad | THE OH !",
  description:
    "Check delivery coverage, kitchen location, and delivery charges for THE OH ! healthy oats cloud kitchen in Hyderabad, Telangana.",
  keywords: [
    "oats bowl delivery hyderabad",
    "healthy food delivery radius hyderabad",
    "the oh kitchen location",
    "cloud kitchen delivery map hyderabad",
  ],
  alternates: {
    canonical: `${siteUrl}/delivery-map`,
  },
  openGraph: {
    title: "Delivery Coverage & Area Map in Hyderabad | THE OH !",
    description:
      "Order fresh oats bowls and healthy meals delivered across Hyderabad from THE OH ! cloud kitchen.",
    url: `${siteUrl}/delivery-map`,
    images: [{ url: "/theoh!.jpg", width: 1200, height: 630, alt: "THE OH ! Delivery Map Hyderabad" }],
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
      "name": "Delivery Map",
      "item": `${siteUrl}/delivery-map`,
    },
  ],
};

export default function DeliveryMapPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <DeliveryMapClient />
    </>
  );
}
