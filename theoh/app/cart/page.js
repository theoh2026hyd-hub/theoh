import CartClient from "./CartClient";

export const metadata = {
  title: "Shopping Cart | THE OH !",
  description: "View and checkout your selected healthy oats bowls and nutritious items.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function CartPage() {
  return <CartClient />;
}
