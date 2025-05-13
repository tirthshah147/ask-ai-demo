"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { api } from "~/trpc/react";

/* ---------- debounce helper ---------- */
function useDebounce<T>(value: T, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
/* ------------------------------------- */

/** 🔍  Full‑text search for posts */
export function SearchPost() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 500);

  const { data: results = [], isFetching } = api.post.search.useQuery(
    { q: debounced },
    { enabled: !!debounced },
  );

  return (
    <section className="w-full max-w-lg space-y-4">
      <h3 className="text-2xl font-bold">Search your posts</h3>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search posts…"
        className="w-full rounded-md bg-white/10 px-4 py-2 text-white"
      />

      {debounced && (
        <ul className="space-y-3 rounded-md bg-black/20 p-4">
          {isFetching && <li className="text-sm text-gray-400">Searching…</li>}

          {results.map((p) => (
            <li key={p.id} className="space-y-1 rounded-md bg-white/5 p-3">
              {/* title + icon */}
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText size={16} className="shrink-0 text-amber-400" />
                <span>{p.title}</span>
              </div>

              {/* highlighted snippet */}
              <div
                className="prose prose-invert text-xs"
                dangerouslySetInnerHTML={{ __html: p.descriptionHighlighted }}
              />
            </li>
          ))}

          {!isFetching && !results.length && (
            <li className="text-sm text-gray-400">No matches.</li>
          )}
        </ul>
      )}
    </section>
  );
}
