import { Loader2 } from "lucide-react";

export default function Spinner({ label = "Loading ..." }) {
  return <span className="inline-flex items-center justify-center text-primary" role="status" aria-label={label}><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /></span>;
}
