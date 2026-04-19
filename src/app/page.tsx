import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Co-Dispatch</h1>
      <Link href="/morning-triage">Morning Triage</Link>
      <button type="button">Dispatch New Load</button>
    </main>
  );
}
