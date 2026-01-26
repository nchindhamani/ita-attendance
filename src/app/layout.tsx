import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sonner } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ITA Attendance Portal",
  description:
    "ITA Attendance Portal for teacher attendance, approvals, and archives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        {children}
        <Sonner />
      </body>
    </html>
  );
}
