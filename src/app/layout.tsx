import type { Metadata } from "next";
import { Outfit, Syne, Space_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import SchedulerProvider from "@/components/SchedulerProvider";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const syne   = Syne({ subsets: ["latin"], variable: "--font-syne",   display: "swap" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono", display: "swap" });
const orbitron  = Orbitron({ subsets: ["latin"], weight: ["400", "600", "700", "900"], variable: "--font-orbitron", display: "swap" });

export const metadata: Metadata = {
  title: "Studio — AI Content Platform",
  description: "Universal AI-powered product content generation for any industry",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${syne.variable} ${spaceMono.variable} ${orbitron.variable} h-full antialiased`}>
      <head>
        {/* Ad Headline font picker previews */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Bodoni+Moda:wght@400;700&family=Cormorant+Garamond:wght@300;400;600&family=EB+Garamond:wght@400;600&family=GFS+Didot&family=Montserrat:wght@400;600;800&family=PT+Serif:wght@400;700&family=Source+Serif+Pro:wght@400;600&family=Jost:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <SchedulerProvider>{children}</SchedulerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
