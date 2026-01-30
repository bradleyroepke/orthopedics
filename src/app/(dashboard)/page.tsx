import { SubspecialtyFolders } from "@/components/documents/SubspecialtyFolders";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Library</h1>
        <p className="text-muted-foreground">
          Browse documents by subspecialty
        </p>
      </div>
      <SubspecialtyFolders />
    </div>
  );
}
