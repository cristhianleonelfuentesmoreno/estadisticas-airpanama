import { LoginCard } from "@/components/auth/LoginCard";
import { getAppSettings } from "@/app/actions/admin";

export default async function LoginPage() {
  const settings = await getAppSettings();
  return (
    <main>
      <LoginCard settings={settings || undefined} />
    </main>
  );
}
