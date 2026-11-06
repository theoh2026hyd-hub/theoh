export default function manifest() {
  return {
    name: "THE OH ! - Natural Oats Bowls & Healthy Meals",
    short_name: "THE OH !",
    description:
      "Signature Premium Natural Oats Bowls, Fruit Bowls, Protein Oats & Cookie Bowls delivered fresh across Hyderabad.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#183028",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
