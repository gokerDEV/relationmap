import { RelationMapEditor } from "@/components/relation-map-editor";

export default function Home() {
  return (
    <main className="h-screen w-full flex flex-col overflow-hidden bg-background">
      <RelationMapEditor />
    </main>
  );
}
