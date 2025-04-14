import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Database, Home, FileUp } from "lucide-react";

export function SupabaseNav() {
  return (
    <div className="bg-slate-800 p-2 flex gap-2">
      <Link href="/">
        <Button variant="outline" size="sm" className="text-white border-slate-600 hover:bg-slate-700">
          <Home className="h-4 w-4 mr-2" />
          Home
        </Button>
      </Link>
      
      <Link href="/migrate">
        <Button variant="outline" size="sm" className="text-white border-slate-600 hover:bg-slate-700">
          <FileUp className="h-4 w-4 mr-2" />
          Migration Utility
        </Button>
      </Link>
      
      <Link href="/auth">
        <Button variant="outline" size="sm" className="text-white border-slate-600 hover:bg-slate-700">
          <Database className="h-4 w-4 mr-2" />
          Switch to Local Auth
        </Button>
      </Link>
    </div>
  );
}