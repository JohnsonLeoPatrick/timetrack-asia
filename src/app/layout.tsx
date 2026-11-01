import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { LanguageProvider } from "@/providers/language-provider";
import { NotificationProvider } from "@/providers/notification-provider";
import { Toaster } from "@/components/ui/sonner";

const googleSans = localFont({
  src: "./fonts/GoogleSans-Latin.woff2",
  variable: "--font-google-sans",
  weight: "400 700",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Time Track | Every Second Counts",
  description: "Time Track provides the best sports timing and event management services in Malaysia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${googleSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <QueryProvider>
          <LanguageProvider>
            <NotificationProvider>
              {children}
              <Toaster position="bottom-right" />
            </NotificationProvider>
          </LanguageProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
