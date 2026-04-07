import type { Metadata } from "next";
import { Manrope, Space_Mono } from "next/font/google";
import "./globals.css";
import { ErrorToastContainer } from "@/components/error-toast";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UniSphere - The Student Life Ecosystem",
  description: "Foundational full-stack student platform with modular routing and workspace UI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var saved=localStorage.getItem('unisphere-theme');var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var isDark=saved?saved==='dark':prefersDark;document.documentElement.classList.toggle('dark',isDark);}catch(e){}})();",
          }}
        />
        {children}
          <ErrorToastContainer />
      </body>
    </html>
  );
}
