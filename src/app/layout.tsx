// @ts-nocheck
import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { Sonner } from "@/components/ui/sonner";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ITA Attendance Hub",
  description:
    "ITA Attendance Hub for teacher attendance, approvals, and archives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfairDisplay.variable} ${dmSans.variable} font-body antialiased`}>
        {children}
        <Sonner />
      </body>
    </html>
  );
}
