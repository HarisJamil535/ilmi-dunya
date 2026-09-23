import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";

export default function Breadcrumbs({ items = [], className = "" }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-500 ${className}`}>
      <Link to="/" aria-label="Home" className="rounded-md p-1 text-slate-400 hover:bg-primary-soft hover:text-primary">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, index) => {
        const current = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="contents">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
            {current || !item.to ? (
              <span aria-current={current ? "page" : undefined} className="truncate text-slate-700">{item.label}</span>
            ) : (
              <Link to={item.to} className="truncate hover:text-primary">{item.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
