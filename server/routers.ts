import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { 
  deleteSupabaseTransaction, 
  deleteSupabaseTransactions, 
  insertSupabaseTransactions, 
  listSupabaseTransactions, 
  toSupabaseTransactionRow,
  listSupabaseCategories,
  insertSupabaseCategory,
  deleteSupabaseCategory,
  listSupabaseSubcategories,
  insertSupabaseSubcategory,
  deleteSupabaseSubcategory
} from "./supabase";

export const appRouter = router({
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

  categories: router({
    list: protectedProcedure.query(async () => listSupabaseCategories()),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return insertSupabaseCategory(input.name);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        await deleteSupabaseCategory(input.id);
        return { success: true } as const;
      }),
    listSubcategories: protectedProcedure.query(async () => listSupabaseSubcategories()),
    createSubcategory: protectedProcedure
      .input(z.object({ name: z.string().min(1), categoryId: z.string().uuid() }))
      .mutation(async ({ input }) => {
        return insertSupabaseSubcategory(input.name, input.categoryId);
      }),
    deleteSubcategory: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        await deleteSupabaseSubcategory(input.id);
        return { success: true } as const;
      }),
  }),

  transactions: router({
    list: protectedProcedure.query(async () => listSupabaseTransactions()),
    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        await deleteSupabaseTransaction(input.id);
        return { success: true } as const;
      }),
    deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
      .mutation(async ({ input }) => {
        await deleteSupabaseTransactions(input.ids);
        return { success: true } as const;
      }),
    create: protectedProcedure
      .input(z.object({
        transactions: z.array(z.object({
          date: z.string().min(1),
          type: z.enum(["receita", "despesa"]),
          amount: z.number().positive(),
          category: z.string().min(1),
          subcategory: z.string().min(1),
          subcategoria_id: z.string().uuid().nullable().optional(),
          responsible: z.string().min(1),
          payment: z.string().nullable(),
          note: z.string().nullable(),
          installmentGroupId: z.string().nullable().optional(),
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
