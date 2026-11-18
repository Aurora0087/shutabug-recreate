import type { Metadata } from "next"
import "./globals.css"
import "./polish.css"
import ArtworkTransitions from "@/components/artwork-transitions"
export const metadata: Metadata = {
  title: "Shutabug — Art, in good company.",
  description:
    "Explore a world of colour. Digital paintings, stories, and art prints by Mayowa Alabi.",
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/aiz8hql.css" />
      </head>
      <body>
        <ArtworkTransitions />
        {children}
      </body>
    </html>
  )
}
