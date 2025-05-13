import Link from "next/link";

import { LatestPost } from "~/app/_components/post";
import { api, HydrateClient } from "~/trpc/server";
import { AskAI } from "./_components/ask-ai";
import { SearchPost } from "./_components/search";

export default async function Home() {
  void api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Second <span className="text-[hsl(280,100%,70%)]">Brain</span> App
          </h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
              href="https://create.t3.gg/en/usage/first-steps"
              target="_blank"
            >
              <h3 className="text-2xl font-bold">Ask AI →</h3>
              <div className="text-lg">
                Get instant answers pulled from your own posts—no need to leave
                the page.
              </div>
            </Link>
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
              href="https://create.t3.gg/en/introduction"
              target="_blank"
            >
              <h3 className="text-2xl font-bold">Search →</h3>
              <div className="text-lg">
                Quickly locate any post that contains your text — titles and
                snippets highlighted.
              </div>
            </Link>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-white">{`Hola! Let's create some posts 😀`}</p>
          </div>

          <LatestPost />
          <SearchPost />
          <AskAI />
          <div className="mb-[100px]"></div>
        </div>
      </main>
    </HydrateClient>
  );
}
