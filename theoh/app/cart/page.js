import CartClient from "./CartClient";

export const metadata = {
  title: "Shopping Cart | THE OH !",
  description: "View and checkout your selected natural oats bowls and healthy items.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function CartPage() {
  return <CartClient />;
}
