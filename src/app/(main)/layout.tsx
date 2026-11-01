import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen overflow-x-clip">
      <Header />
      <main className="public-light flex-grow bg-white text-slate-900">{children}</main>
      <Footer />
    </div>
  );
}
