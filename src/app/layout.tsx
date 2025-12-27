// app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
// Remove Providers import from here
import { Analytics } from "@vercel/analytics/next";

const inter = localFont({
  src: "../../public/fonts/InterVariable.ttf",
  variable: "--font-inter",
  display: "swap",
});

const abcFavorit = localFont({
  src: "../../public/fonts/ABCFavorit-Medium.woff2",
  variable: "--font-abc-favorit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vatic Trading",
  description: "Trade Reality",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body
        className={`${inter.variable} ${abcFavorit.variable} antialiased`}
      >
        {/* Analytics is usually fine globally, but Providers go to the inner layout */}
        {children}
        <Analytics />
      </body>
    </html>
  );
}