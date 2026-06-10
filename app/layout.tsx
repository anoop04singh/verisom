import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeriSom | Smart Contract Safety for AI Agents",
  description:
    "VeriSom gives AI agents a contract safety score before they transact, with source or bytecode analysis, RAG evidence, and Somnia-backed results.",
  icons: {
    icon: [
      { url: "/verisom-logo.png", type: "image/png", sizes: "512x512" },
      { url: "/verisom-logo.svg", type: "image/svg+xml" }
    ],
    apple: "/verisom-logo.png",
    shortcut: "/verisom-logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
