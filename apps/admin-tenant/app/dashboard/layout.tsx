import DashboardShellLayout from '../../components/dashboard-shell-layout';

export default function DashboardLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return <DashboardShellLayout>{children}</DashboardShellLayout>;
}
