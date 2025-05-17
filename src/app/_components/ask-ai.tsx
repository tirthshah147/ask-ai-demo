"use client";

import { useState } from "react";
import { api } from "~/trpc/react"; // ← tRPC hook generator

export function AskAI() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<{ tag: string; url: string }[]>([]);

  // tRPC mutation
  const askPost = api.post.askPost.useMutation({
    onSuccess: (data) => {
      setAnswer(data.answer);
      setSources(data.sources); // [{ tag:"12-3", url:"/posts/12#c3" }, …]
    },
    onMutate: () => {
      setAnswer(`🤖 Thinking…`);
      setSources([]);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAnswer(`🤖 Demo answer for: “${question}” is loading...`);
    askPost.mutate({ question });
    setQuestion("");
  };

  return (
    <section className="w-full max-w-lg space-y-4">
      <h3 className="text-2xl font-bold">Ask your posts</h3>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type a question…"
          className="flex-1 rounded-md bg-white/10 px-4 py-2 text-white"
        />
        <button
          type="submit"
          className="rounded-md bg-white/10 px-4 py-2 font-semibold hover:bg-white/20"
        >
          Ask
        </button>
      </form>

      {answer && (
        <div
          className="prose prose-invert rounded-md bg-black/20 p-4 text-amber-300"
          dangerouslySetInnerHTML={{ __html: answer }}
        />
      )}

      {/* source list */}
      {sources.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-cyan-300">
          {sources.map((s) => (
            <li key={s.tag}>
              <a href={s.url} target="_blank" className="underline">
                source {s.tag}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
