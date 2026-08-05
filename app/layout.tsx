import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { esES } from "@clerk/localizations";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Verbixa AI",
  description: "Documentación automática de reuniones corporativas con IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        theme: dark,
        elements: {
          card: "bg-background/70 backdrop-blur-xl border border-border/50 shadow-2xl shadow-black/20",
          logoBox: "h-16 w-16 mb-2",
          logoImage: "h-16 w-16 object-contain",
          header: "flex-row items-baseline justify-center gap-2 flex-wrap",
          headerTitle: "text-base",
          headerSubtitle: "text-sm",
        },
      }}
      localization={esES}
    >
      <html
        lang="es"
        className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <TooltipProvider>{children}</TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
