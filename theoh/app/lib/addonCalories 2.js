/** Average kcal per 100g for standard bowl add-ons (30g serving used in cart) */
export const ADDON_CALORIES_PER_100G = {
  Apple: 52,
  Banana: 89,
  Blueberry: 57,
  "Dragon Fruit": 60,
  Grapes: 69,
  Mango: 60,
  Muskmelon: 34,
  Mulberries: 43,
  Pomegranate: 83,
  Raspberries: 52,
  Strawberry: 32,
  Almonds: 579,
  "Black Raisins": 299,
  Cashews: 553,
  Cranberries: 308,
  Dates: 282,
  "Green Raisins": 299,
  "Hazel Nuts": 628,
  Peanuts: 567,
  Walnuts: 654,
  "Chia Seeds": 486,
  "Pumpkin Seeds": 559,
  "Sunflower Seeds": 584,
  "Watermelon Seeds": 557,
  "Almond Butter (Creamy / Crunchy)": 614,
  "Almond Butter (Creamy/Crunchy)": 614,
  "Dark Chocolate Peanut Butter": 588,
  "Peanut Butter": 588,
};

export function lookupAddonCalories(name) {
  if (!name) return null;
  const trimmed = String(name).trim();
  if (ADDON_CALORIES_PER_100G[trimmed] != null) {
    return ADDON_CALORIES_PER_100G[trimmed];
  }
  const match = Object.entries(ADDON_CALORIES_PER_100G).find(
    ([key]) => key.toLowerCase() === trimmed.toLowerCase()
  );
  return match ? match[1] : null;
}
