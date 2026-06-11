import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hospital SaaS Superadmin",
  description: "Central superadmin console for hospital tenant management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-950">{children}</body>
    </html>
  );
}
