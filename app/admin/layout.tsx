import dynamic from 'next/dynamic';

const AdminLayoutClient = dynamic(() => import('./AdminLayoutClient'), { ssr: false });

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
