import { EmergencyModuleView } from "@/components/emergency/emergency-module";

export default async function EmergencyModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmergencyModuleView moduleId={id} />;
}
