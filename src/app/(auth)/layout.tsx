import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="text-lg font-extrabold tracking-tight text-slate-900">PopsDrops</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
