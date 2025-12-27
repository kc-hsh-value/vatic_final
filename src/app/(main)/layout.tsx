import type { Metadata } from "next";
import Providers from "@/providers/providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main>
        <Providers>
          {children}
        </Providers>
    </main>
  );
}
