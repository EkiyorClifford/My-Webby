import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({
  src: [
    {
      path: "../fonts/Sentient-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/Sentient-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../fonts/Sentient-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

const body = localFont({
  src: [
    {
      path: "../fonts/Switzer-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/Switzer-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/Switzer-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spark · Idea to MVP Spec Assistant",
  description:
    "Turn a rough product idea into a structured MVP brief with streaming Groq LLM output. Built by Ekiyor Clifford.",
  authors: [{ name: "Ekiyor Clifford" }],
  icons: {
    icon: "/spark-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-[var(--muted)]">
        {children}
      </body>
    </html>
  );
}
