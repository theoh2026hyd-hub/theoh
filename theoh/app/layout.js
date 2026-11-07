import { Poppins } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "./components.css";
import AppProviders from "./components/AppProviders";
import { getDefaultHeroPreloadAssets } from "./lib/heroMedia";
import { CONTACT_EMAIL, CONTACT_PHONE_DIAL, CONTACT_LOCATION, CONTACT_LOCATION_MAP_LINK, CONTACT_INSTAGRAM_URL } from "./lib/contactInfo";

const { videoUrl: heroPreloadVideoUrl } = getDefaultHeroPreloadAssets();

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dreamAvenue = localFont({
  src: "./fonts/DreamAvenue.ttf",
  variable: "--font-dream-avenue",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://theoh.in";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Healthy oats bowls in hyderabad",
    template: "%s | THE OH !",
  },
  description:
    "THE OH ! is a premium oats cloud kitchen in Hyderabad crafting signature healthy oats bowls, fruit bowls, protein oats, and cookie bowls. Fresh healthy food delivery to your door.",
  keywords: [
    "healthy oats bowls in hyderabad",
    "oats bowls",
    "healthy oats bowls",
    "oats bowl hyderabad",
    "healthy food delivery hyderabad",
    "healthy breakfast delivery",
    "oats cloud kitchen hyderabad",
    "healthy bowls near me",
    "the oh oats",
    "protein oats bowl",
    "cookie bowl hyderabad",
    "healthy breakfast bowls",
  ],
  authors: [{ name: "THE OH !" }],
  creator: "THE OH !",
  publisher: "THE OH !",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "./",
  },
  openGraph: {
    title: "Healthy oats bowls in hyderabad",
    description:
      "Order freshly prepared healthy oats bowls, fruit bowls, protein oats, and cookie bowls delivered fresh across Hyderabad.",
    url: siteUrl,
    siteName: "THE OH !",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/theoh!.jpg",
        width: 1200,
        height: 630,
        alt: "THE OH ! Premium Oats Bowls Hyderabad",
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
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "FastFoodRestaurant",
  "name": "THE OH !",
  "alternateName": "The OH Oats Cloud Kitchen",
  "image": `${siteUrl}/theoh!.jpg`,
  "@id": `${siteUrl}/#organization`,
  "url": siteUrl,
  "telephone": CONTACT_PHONE_DIAL,
  "email": CONTACT_EMAIL,
  "priceRange": "₹₹",
  "servesCuisine": ["Healthy Food", "Oats Bowls", "Breakfast", "Desserts"],
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Hyderabad",
    "addressRegion": "Telangana",
    "addressCountry": "IN",
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "17.3850",
    "longitude": "78.4867",
  },
  "hasMap": CONTACT_LOCATION_MAP_LINK,
  "sameAs": [CONTACT_INSTAGRAM_URL],
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "opens": "07:00",
      "closes": "23:00",
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${poppins.variable} ${dreamAvenue.variable}`}>
      <head>
        <link rel="preload" as="video" href={heroPreloadVideoUrl} type="video/mp4" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
