import ProfileClient from "./ProfileClient";

export const metadata = {
  title: "My Account | THE OH !",
  description: "Manage your THE OH ! user profile, order history, and rewards balance.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function ProfilePage() {
  return <ProfileClient />;
}
