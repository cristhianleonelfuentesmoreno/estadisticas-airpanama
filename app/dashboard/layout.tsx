import { redirect } from "next/navigation";

// El panel de vuelos de Air Panama ya no se usa: quien llegue aquí va al inicio de ValisVentas
export default function DashboardLayout() {
  redirect("/");
}
