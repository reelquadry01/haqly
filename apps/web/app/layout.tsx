import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppSplash } from "../components/app-splash";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

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
    <html lang="en" className={sans.variable}>
      <body className={sans.className}>
        <AppSplash />
        {children}
      </body>
    </html>
  );
}
