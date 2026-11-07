import WhyUsClient from "./WhyUsClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://theoh.in";

export const metadata = {
  title: "Why Choose THE OH ! | Premium Healthy Oats Bowls Hyderabad",
  description:
    "Discover why THE OH ! is Hyderabad's favourite healthy oats cloud kitchen. Premium ingredients, zero synthetic processing, wholesome oat bowls & nutritious cookie bowls.",
  keywords: [
    "why choose oats",
    "healthy oats habit",
    "premium oats hyderabad",
    "healthy oats bowls",
    "healthy breakfast hyderabad",
  ],
  alternates: {
    canonical: `${siteUrl}/why-us`,
  },
  openGraph: {
    title: "Why Choose THE OH ! | Premium Healthy Oats Bowls Hyderabad",
    description:
      "Clean, elevated nutrition crafted with premium healthy oats, fruits & nuts. Learn about THE OH ! story & standards.",
    url: `${siteUrl}/why-us`,
    images: [{ url: "/why_us_premium_oats.png", width: 1200, height: 630, alt: "Why Choose THE OH !" }],
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
      "name": "Why Us",
      "item": `${siteUrl}/why-us`,
    },
  ],
};

export default function WhyUsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <WhyUsClient />
    </>
  );
}
