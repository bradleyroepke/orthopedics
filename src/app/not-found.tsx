import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <FileQuestion className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
      <p className="text-muted-foreground mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link href="/">
        <Button>Go to Home</Button>
      </Link>
    </div>
  );
}
