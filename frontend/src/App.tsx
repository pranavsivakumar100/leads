import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/hooks/useAuth";
import { DialerProvider } from "@/hooks/useDialer";

export default function App() {
  return (
    <AuthProvider>
      <DialerProvider>
        <AppLayout />
      </DialerProvider>
    </AuthProvider>
  );
}
