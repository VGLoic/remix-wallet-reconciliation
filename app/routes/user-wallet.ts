import { type ActionFunctionArgs, redirect } from "@remix-run/node";
import { z } from "zod";
import { ZAddress, userWallet } from "~/wallet-cookie.server";

const ZChainId = z.string().transform((val, ctx) => {
  if (val === "" || isNaN(Number(val))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid number",
    });
    return z.NEVER;
  }
  return Number(val);
});

const ZUserWalletPayload = z.object({
  address: ZAddress,
  chainId: ZChainId,
});

export async function action({ request }: ActionFunctionArgs) {
  const bodyParams = await request.formData();
  const values = Object.fromEntries(bodyParams);

  const locationParsingResult = z
    .string()
    .min(1)
    .startsWith("/")
    .safeParse(values.currentPathname);
  if (!locationParsingResult.success) {
    return redirect("/", {
      headers: {
        "Set-Cookie": await userWallet.serialize({}),
      },
    });
  }

  const parsingResult = ZUserWalletPayload.safeParse(values);

  if (!parsingResult.success) {
    return redirect(locationParsingResult.data, {
      headers: {
        "Set-Cookie": await userWallet.serialize({}),
      },
    });
  }

  return redirect(locationParsingResult.data, {
    headers: {
      "Set-Cookie": await userWallet.serialize(parsingResult.data),
    },
  });
}
