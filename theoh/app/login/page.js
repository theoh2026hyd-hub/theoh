import SignInClient from "../signin/SignInClient";

export const metadata = {
  title: "Login | THE OH !",
  description: "Log in to your THE OH ! account to manage orders, addresses, and reward coins.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginPage() {
  return <SignInClient />;
}
