import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import OpenAI from "openai";
import type { Post, Prisma } from "@prisma/client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function toUnit(v: number[]) {
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}

/* ── utils/snippet.ts ────────────────────────────────────────── */
/** Make a 1‑or‑2‑line snippet around the *first* match and mark it. */
export function makeSnippet(text: string, q: string) {
  const words = q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (!words.length) return "";

  // 1️⃣ find first line containing any search word
  const lines = text.split(/\r?\n/);
  const re = new RegExp(`(${words.join("|")})`, "i");
  const idx = lines.findIndex((ln) => re.test(ln));

  if (idx === -1) return ""; // nothing matched (shouldn't happen if MATCH found it)

  // 2️⃣ take that line + the one after it (if present)
  const slice = lines.slice(idx, idx + 2).join(" ");

  // 3️⃣ highlight *all* occurrences inside the slice
  const markRe = new RegExp(`(${words.join("|")})`, "gi");
  return slice.replace(markRe, "<mark>$1</mark>");
}
/* ────────────────────────────────────────────────────────────── */

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  // ── create a new post with title + description ───────────────
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<Post> => {
      /* 📌 1. split + embed (no DB, no Tx yet) */
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 400,
        chunkOverlap: 80,
      });
      const chunks = await splitter.splitText(
        `${input.title}\n\n${input.description}`,
      );

      const { data } = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunks,
      });

      /* 📌 2. open a fast transaction for *only* SQL work */
      return ctx.db.$transaction<Post>(async (tx: Prisma.TransactionClient) => {
        const post = await tx.post.create({
          data: { title: input.title, description: input.description },
        });

        const rows = data.map((e, i) => [
          post.id,
          i,
          chunks[i],
          JSON.stringify(toUnit(e.embedding)),
        ]);
        const placeholders = rows.map(() => "(?,?,?,TO_VECTOR(?))").join(",");

        await tx.$executeRawUnsafe<number>(
          `INSERT INTO PostEmbedding
             (postId, chunkIndex, content, embedding)
           VALUES ${placeholders}`,
          ...rows.flat(),
        );

        return post;
      });
    }),

  getLatest: publicProcedure.query(async ({ ctx }) => {
    const post = await ctx.db.post.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true, createdAt: true },
    });

    return post ?? null;
  }),

  askPost: publicProcedure
    .input(z.object({ question: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      /* 1️⃣  embed the user’s question */
      const embed = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: input.question,
      });

      const embedding = embed.data[0]?.embedding;
      if (!embedding) throw new Error("OpenAI returned no embedding");

      // const qVecUnit = JSON.stringify(toUnit(embedding));
      const qVec = JSON.stringify(toUnit(embedding));

      const snippets: { content: string }[] = await ctx.db.$queryRawUnsafe(
        `
          SELECT  content
          FROM    PostEmbedding
          ORDER BY DISTANCE(  
          TO_VECTOR(?),              
          embedding,
          'cosine'     
          )
  LIMIT 5;
  `,
        qVec,
      );

      const context = snippets.map((s) => s.content).join("\n---\n");

      console.log("Question: ", input.question);
      console.log("Context: ", context);

      /* 3️⃣  let GPT‑4 answer from the context */
      const chat = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `Please answer the question as accurately and thoroughly as possible using only the information provided in the context. If the answer isn’t available in the context, kindly respond with: ‘I’m not sure about that, sorry.’

Return the response in well-structured, semantic HTML with proper formatting:

- Use headings like <h1>, <h2>, and <h3> for clarity and structure  
- Use <ul> and <li> for bullet points where appropriate  
- Insert <br> tags for clear line breaks and spacing. 
- Highlight important words using <strong> (bold), <em> (italic), and <u> (underline) wherever it improves readability or emphasis  

Keep the tone warm, empathetic, and conversational—like a caring support team would.`,
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nQ: ${input.question}`,
          },
        ],
      });

      const answer =
        chat.choices[0]?.message?.content?.trim() ??
        "⚠️  Model returned no answer.";

      return {
        answer,
      };
    }),

  /* ── full‑text search ─────────────────────────────────── */
  search: publicProcedure
    .input(z.object({ q: z.string() }))
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      if (!q) return []; // nothing to search yet

      const posts = await ctx.db.post.findMany({
        where: {
          OR: [{ title: { search: q } }, { description: { search: q } }],
        },
        orderBy: {
          _relevance: {
            fields: ["title", "description"],
            search: q,
            sort: "desc",
          },
        },
        select: { id: true, title: true, description: true },
      });

      return posts.map((p) => ({
        id: p.id,
        title: p.title,
        descriptionHighlighted: makeSnippet(p.description, q),
      }));
    }),
});
