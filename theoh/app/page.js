import HomePageClient from "./HomePageClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://theoh.in";

export const metadata = {
  title: {
    absolute: "Healthy oats bowls in hyderabad",
  },
  description:
    "Order freshly prepared healthy oats bowls, fruit bowls, protein oats, and cookie bowls delivered fresh across Hyderabad from THE OH ! oats cloud kitchen.",
  keywords: [
    "healthy oats bowls in hyderabad",
    "healthy oats bowls",
    "oats bowls hyderabad",
    "oats cloud kitchen",
    "protein oats bowl",
    "healthy food delivery hyderabad",
    "fruit oats bowl",
    "healthy breakfast delivery hyderabad",
    "oats bowls near me",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Healthy oats bowls in hyderabad",
    description:
      "Signature Premium Healthy Oats Bowls, Fruit Bowls, Protein Oats & Cookie Bowls delivered fresh across Hyderabad.",
    url: siteUrl,
    siteName: "THE OH !",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/theoh!.jpg",
        width: 1200,
        height: 630,
        alt: "THE OH ! Healthy Oats Bowls Hyderabad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Healthy oats bowls in hyderabad",
    description:
      "Fresh, wholesome healthy oats bowls, protein oats, and cookie bowls delivered across Hyderabad.",
    images: ["/theoh!.jpg"],
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is THE OH !?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":
          "THE OH ! is a premium oats cloud kitchen in Hyderabad specializing in signature healthy oats bowls, fruit bowls, protein oats, and cookie bowls.",
      },
    },
    {
      "@type": "Question",
      "name": "How can I order oats bowls in Hyderabad?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":
          "You can explore our menu online at theoh.in, customize your oats bowl with fresh fruits and nuts, and place an order for fast delivery to your door in Hyderabad.",
      },
    },
    {
      "@type": "Question",
      "name": "Are your oats bowls freshly prepared?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":
          "Yes! Every bowl at THE OH ! is made fresh for every order using premium quality oats, fresh fruits, wholesome nuts, and transparent nutrition without synthetic additives.",
      },
    },
    {
      "@type": "Question",
      "name": "Where do you deliver in Hyderabad?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":
          "We deliver across Hyderabad within a 50 km radius of our cloud kitchen location.",
      },
    },
    {
      "@type": "Question",
      "name": "Do you offer customized oats bowls?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":
          "Yes! You can build and customize your own bowl with your choice of oat bases, premium fruit toppings, nut butters, and seeds.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <HomePageClient />
    </>
  );
}
