/** Which admin API data keys each console tab needs when syncing. */
export const ADMIN_SECTION_KEYS = {
  dashboard: ["stats", "orders", "logs"],
  orders: ["stats", "orders"],
  products: ["products", "categories"],
  categories: ["categories"],
  addons: ["addons", "categories"],
  coupons: ["coupons"],
  coins: ["customers"],
  customers: ["customers"],
  payments: ["payments"],
  updates: ["updates"],
  events: ["events"],
  upcoming: ["upcomingItems"],
  contacts: ["contacts"],
  settings: ["settings"]
};

export function getSectionFetchNeeds(section) {
  const needs = {
    orders: false,
    categories: false,
    products: false,
    addons: false,
    coupons: false,
    wallets: false,
    settings: false,
    logs: false,
    updates: false,
    events: false,
    upcoming: false,
    contacts: false,
    userDetails: false
  };

  if (!section || section === "all") {
    Object.keys(needs).forEach((k) => {
      needs[k] = true;
    });
    return needs;
  }

  switch (section) {
    case "dashboard":
      needs.orders = true;
      needs.logs = true;
      break;
    case "orders":
      needs.orders = true;
      break;
    case "products":
      needs.products = true;
      needs.categories = true;
      break;
    case "categories":
      needs.categories = true;
      break;
    case "addons":
      needs.addons = true;
      needs.categories = true;
      break;
    case "coupons":
      needs.coupons = true;
      break;
    case "coins":
    case "customers":
      needs.wallets = true;
      needs.orders = true;
      needs.userDetails = true;
      break;
    case "payments":
      needs.orders = true;
      break;
    case "updates":
      needs.updates = true;
      break;
    case "events":
      needs.events = true;
      break;
    case "upcoming":
      needs.upcoming = true;
      break;
    case "contacts":
      needs.contacts = true;
      break;
    case "settings":
      needs.settings = true;
      break;
    default:
      Object.keys(needs).forEach((k) => {
        needs[k] = true;
      });
  }

  return needs;
}

export function pickSectionPayload(section, fullPayload) {
  if (!section || section === "all") return fullPayload;

  const keys = ADMIN_SECTION_KEYS[section];
  if (!keys) return fullPayload;

  const partial = { success: true, section };
  keys.forEach((key) => {
    if (fullPayload[key] !== undefined) partial[key] = fullPayload[key];
  });
  return partial;
}
