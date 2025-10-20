import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
//import '@/styles/globals.css'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "OneStonks",
  description: "(ou mercado humorístico... Vamos ver)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <body className={"bg-black text-white min-h-screen font-sans " + geistSans.variable + " " + geistMono.variable}>
        {children}
      </body>
    </html>
  );
}
