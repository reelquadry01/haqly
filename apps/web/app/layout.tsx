import type { Metadata } from "next";
import { AppSplash } from "../components/app-splash";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haqly",
  description: "Haqly ERP workspace for finance, inventory, sales, purchases, assets, and loans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppSplash />
        {children}
      </body>
    </html>
  );
}
