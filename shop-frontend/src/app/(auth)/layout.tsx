import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-indigo-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 flex flex-col">
      <header className="p-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">SH Shop</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}
