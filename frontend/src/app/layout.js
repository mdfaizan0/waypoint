// For adding custom fonts with other frameworks, see:
// https://tailwindcss.com/docs/font-family
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Shift",
  description: "Real-time ride hailing platform",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}