import type { Metadata } from "next";
import { ProductNav } from "@/components/navigation/ProductNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fantasy Draft Coach",
  description: "Draft recommendations you can understand.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-stone-50 text-zinc-950">
        <ProductNav />
        {children}
      </body>
    </html>
  );
}
