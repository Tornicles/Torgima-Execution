import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start free",
  description: "Create your Torgima account and begin your execution system.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
