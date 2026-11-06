import SignInClient from "./SignInClient";

export const metadata = {
  title: "Sign In | THE OH !",
  description: "Sign in to your THE OH ! account to manage orders, addresses, and reward coins.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function SignInPage() {
  return <SignInClient />;
}
