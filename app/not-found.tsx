import Link from "next/link"
export default function NotFound() {
  return (
    <main className="not-found">
      <p>404</p>
      <h1>This page never went up.</h1>
      <Link href="/">← Back to the index</Link>
    </main>
  )
}
