import type { Metadata } from "next";
import { Outfit, Syne, Space_Mono, Orbitron, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import SchedulerProvider from "@/components/SchedulerProvider";
import AppFooter from "@/components/AppFooter";

// ── Dark theme fonts ──
const outfit    = Outfit({ subsets: ["latin"], variable: "--font-outfit",   display: "swap" });
const syne      = Syne({ subsets: ["latin"],   variable: "--font-syne",     display: "swap" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400","700"], variable: "--font-space-mono", display: "swap" });
const orbitron  = Orbitron({ subsets: ["latin"], weight: ["400","600","700","900"], variable: "--font-orbitron", display: "swap" });

// ── Light theme fonts ──
const plusJakarta  = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-plus-jakarta", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400","700"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Studio — AI Content Platform",
  description: "Universal AI-powered product content generation for any industry",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fontClasses = [
    outfit.variable, syne.variable, spaceMono.variable, orbitron.variable,
    plusJakarta.variable, jetbrainsMono.variable,
  ].join(" ");

  return (
    <html lang="en" className={`${fontClasses} h-full antialiased`} data-theme="dark">
      <head>
        {/* Apply persisted theme before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var s = localStorage.getItem('studio-theme');
            var t = s ? JSON.parse(s)?.state?.theme : 'dark';
            document.documentElement.setAttribute('data-theme', t || 'dark');
          } catch(e) {}
        ` }} />
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
          <SchedulerProvider>
            <div className="flex-1 flex flex-col">{children}</div>
            <AppFooter />
          </SchedulerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
