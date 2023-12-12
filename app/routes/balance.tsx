import { type LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { createPublicClient, formatEther, http } from "viem";
import { getBalance } from "viem/actions";
import * as chains from "viem/chains";
import { retrieveConnectedWalletFromCookie } from "~/wallet-cookie.server";

function chainIdToChain(chainId: number) {
  return Object.values(chains).find((c) => c.id === chainId);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userWallet = await retrieveConnectedWalletFromCookie(request);
  if (!userWallet) return redirect("/");

  const chain = chainIdToChain(userWallet.chainId);
  if (!chain) return redirect("/");

  const client = createPublicClient({
    transport: http(),
    chain,
  });
  const balance = await getBalance(client, { address: userWallet.address });

  return json({
    balance: formatEther(balance),
    chain,
  });
}

export default function Balance() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <h3>Balance on chain {data.chain.name}</h3>
      <p>{data.balance} (Eth)</p>
    </div>
  );
}
