import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "Eatlee",
  description:
    "Statistical nutrition reference for athletes and health-conscious users, ranked with the PYF index.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} ${syne.variable}`}>
      <body className="min-h-screen bg-eatlee-cream text-eatlee-green antialiased">
        {children}
      </body>
    </html>
  );
}
