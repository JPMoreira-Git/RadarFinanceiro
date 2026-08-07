import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { insertSupabaseTransactions, toSupabaseTransactionRow } from "./supabase";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  transactions: router({
    create: protectedProcedure
      .input(z.object({
        transactions: z.array(z.object({
          date: z.string().min(1),
          type: z.enum(["receita", "despesa"]),
          amount: z.number().positive(),
          category: z.string().min(1),
          subcategory: z.string().min(1),
          responsible: z.string().min(1),
          payment: z.string().nullable(),
          note: z.string().nullable(),
          installmentGroupId: z.string().nullable(),
          installmentNumber: z.number().int().positive().optional(),
          installmentCount: z.number().int().positive().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const rows = input.transactions.map(toSupabaseTransactionRow);
        return insertSupabaseTransactions(rows);
      }),
  }),
});

export type AppRouter = typeof appRouter;
