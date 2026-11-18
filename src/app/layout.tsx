import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Serbell",
  description: "Laboratorio de conciliación de Serbell",
};

const moneyPreference = `try{if(localStorage.getItem("serbell-money")==="plain")document.documentElement.dataset.money="plain"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-money="color" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: moneyPreference }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
