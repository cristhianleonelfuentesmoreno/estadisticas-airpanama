import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/LoginCard";
import { getAppSettings } from "@/app/actions/admin";
import { getSessionProfile } from "@/lib/auth";

export default async function LoginPage() {
  // Con la sesión ya abierta no se vuelve a pedir login: va directo a la caja (o al panel)
  const profile = await getSessionProfile();
  if (profile?.status === "aprobado") redirect("/");

  const settings = await getAppSettings();
  return (
    <main>
      <LoginCard settings={settings || undefined} />
    </main>
  );
}
