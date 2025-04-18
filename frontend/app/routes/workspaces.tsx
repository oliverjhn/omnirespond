import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

export default function WorkspacesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const shownToast = useRef(false);
  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "workspace_not_found" && !shownToast.current) {
      shownToast.current = true;
      toast.error("Workspace not found");
      const params = new URLSearchParams(searchParams);
      params.delete("error");
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div>
      <h1>Workspaces</h1>
    </div>
  );
}
