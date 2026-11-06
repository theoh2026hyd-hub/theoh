import UpdatesClient from "./UpdatesClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://theoh.in";

export const metadata = {
  title: "Latest News & Events | THE OH ! Oats Cloud Kitchen",
  description:
    "Discover the latest announcements, new oat bowl flavors, pop-up stall events, and healthy food meetups from THE OH ! in Hyderabad.",
  keywords: [
    "the oh news",
    "oats cloud kitchen events",
    "healthy food popup hyderabad",
    "the oh updates",
  ],
  alternates: {
    canonical: `${siteUrl}/updates`,
  },
  openGraph: {
    title: "Latest News & Events | THE OH ! Oats Cloud Kitchen",
    description:
      "Stay updated with new menu items, oat bowl pop-ups, and special releases from THE OH !.",
    url: `${siteUrl}/updates`,
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
      "name": "Updates",
      "item": `${siteUrl}/updates`,
    },
  ],
};

export default function UpdatesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <UpdatesClient />
    </>
  );
}
