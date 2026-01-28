import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/providers/theme-provider";
import SolanaProvider from "@/components/providers/solana-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Rialopulse | Solana Prediction Markets",
  description: "Decentralized prediction market platform built on Solana",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <SolanaProvider>
            {children}
          </SolanaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
