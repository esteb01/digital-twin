import type { Metadata } from "next";
import { IBM_Plex_Sans, Orbitron } from "next/font/google";
import "./globals.css";

const display = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://erhdigitaltwin.com"),
  title: "Esteban Ruiz",
  description: "Ask Esteban Ruiz's career digital twin anything about his work.",
  openGraph: {
    title: "Esteban Ruiz",
    description: "Ask anything about my thesis, work, and this AWS digital twin.",
    url: "https://erhdigitaltwin.com",
    siteName: "Esteban Ruiz",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Esteban Ruiz — career digital twin",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Esteban Ruiz",
    description: "Ask anything about my thesis, work, and this AWS digital twin.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta property="og:title" content="Esteban Ruiz" />
        <meta property="og:description" content="Ask anything about my thesis, work, and this AWS digital twin." />
        <meta property="og:url" content="https://erhdigitaltwin.com" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://erhdigitaltwin.com/og.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Esteban Ruiz" />
        <meta name="twitter:image" content="https://erhdigitaltwin.com/og.png" />
      </head>
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
