// app/page.tsx
import dynamic from "next/dynamic";

// Carrega o app só no cliente (evita erro de window/localStorage no SSR)
const AgencyMindMap = dynamic(() => import("@/components/AgencyMindMap"), {
  ssr: false,
});

export default function Page() {
  return <AgencyMindMap />;
}
