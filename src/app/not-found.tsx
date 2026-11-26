import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid gap-4">
      <h1 className="text-title-h4">Page not found</h1>
      <p className="text-paragraph-md">Check the address, or go to the <Link href="/">start page</Link>.</p>
      <p className="text-paragraph-md text-text-sub-600">If you followed an invitation link, open it again from your email.</p>
    </div>
  );
}
