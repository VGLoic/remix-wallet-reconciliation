import { createCookie } from "@remix-run/node";
import { getAddress } from "viem";
import { z } from "zod";

export const userWallet = createCookie("user-wallet", {
  maxAge: 604_800, // one week
});

export const ZAddress = z
  .string()
  .length(42)
  .transform((val, ctx) => {
    try {
      const checkSumAddress = getAddress(val);
      if (checkSumAddress.toLowerCase() !== val.toLowerCase()) {
        throw new Error("Invalid address");
      }
      return checkSumAddress;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid address",
      });
      return z.NEVER;
    }
  });

const ZUserWallet = z.object({
  address: ZAddress,
  chainId: z.number().positive(),
});

export async function retrieveConnectedWalletFromCookie(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  const cookie: unknown = await userWallet.parse(cookieHeader);
  if (!cookie) return null;
  const parsingResult = ZUserWallet.safeParse(cookie);

  if (!parsingResult.success) return null;
  return parsingResult.data;
}

export type UserWallet = z.infer<typeof ZUserWallet>;
