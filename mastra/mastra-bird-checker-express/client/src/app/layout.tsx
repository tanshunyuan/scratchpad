import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Providers } from "@/lib/providers";

// const geistSans = localFont({
//   src: "./fonts/GeistVF.woff",
//   variable: "--font-geist-sans",
//   weight: "100 900",
// });
// const geistMono = localFont({
//   src: "./fonts/GeistMonoVF.woff",
//   variable: "--font-geist-mono",
//   weight: "100 900",
// });

export const metadata: Metadata = {
  title: "Bird Checker",
  description: "Bird checker with Mastra",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        // className={`${geistSans.variable} ${geistSans.className} ${geistMono.variable} antialiased`}
        className={`antialiased`}
      >
        <Providers>
          <Toaster />
          <NuqsAdapter>{children}</NuqsAdapter>
        </Providers>
      </body>
    </html>
  );
}
