import { cssBundleHref } from "@remix-run/css-bundle";
import {
  json,
  type LinksFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useFetcher,
  useLoaderData,
} from "@remix-run/react";
import {
  type UserWallet,
  retrieveConnectedWalletFromCookie,
} from "./wallet-cookie.server";
import * as React from "react";
import { shortHex } from "./utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Remix & Wallet reconciliation" },
    { name: "description", content: "Welcome to the example!" },
  ];
};

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export async function loader({ request }: LoaderFunctionArgs) {
  const userWallet = await retrieveConnectedWalletFromCookie(request);
  return json({ wallet: userWallet });
}

export default function App() {
  const data = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Layout wallet={data.wallet}>
          <Outlet />
        </Layout>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

/**
 * This hook will check if the user is connected to a wallet and sync the state with the server.
 * If injected `ethereum` object is available, it will check for connected accounts and chain ID.
 * If the user is not connected, it will trigger a backend call to `POST /user-wallet` with the current pathname only. The cookie will be cleared and the user redirected.
 * If the user is connected, it will trigger a backend call to `POST /user-wallet` with the address, the chain ID and the current pathname. The cookie will be updated and the user redirected.
 * If the user changes the connected account or the chain ID, it will trigger a backend call to `POST /user-wallet` with the address, the chain ID and the current pathname. The cookie will be updated and the user redirected.
 */
function useSyncWallet() {
  const walletFetcher = useFetcher();

  const submit = walletFetcher.submit;
  React.useEffect(() => {
    async function checkConnectedAccount(ethereum: any) {
      if (!ethereum) return () => {};
      const [account] = await ethereum.request({ method: "eth_accounts" });
      const chainId = await ethereum.request({ method: "eth_chainId" });
      if (!account || !chainId) {
        submit(
          {
            currentPathname: window.location.pathname,
          },
          { method: "post", action: "/user-wallet" },
        );
      } else {
        submit(
          {
            address: account,
            chainId,
            currentPathname: window.location.pathname,
          },
          { method: "post", action: "/user-wallet" },
        );
      }
    }
    function sync() {
      const ethereum = getMetaMaskProvider();
      if (!ethereum) return () => {};
      checkConnectedAccount(ethereum);
      const cb = () => checkConnectedAccount(ethereum);

      checkConnectedAccount(ethereum);
      ethereum.on("accountsChanged", cb);
      ethereum.on("chainChanged", cb);

      return () => {
        ethereum.off("accountsChanged", cb);
        ethereum.off("chainChanged", cb);
      };
    }
    const cleanup = sync();
    return cleanup;
  }, [submit]);
}

type LayoutProps = {
  children: React.ReactNode;
  wallet: UserWallet | null;
};
function Layout({ wallet, children }: LayoutProps) {
  useSyncWallet();

  const [metamaskAvailabilityStatus, setMetamaskAvailabilityStatus] =
    React.useState<"init" | "available" | "unavailable">("init");
  React.useEffect(() => {
    setMetamaskAvailabilityStatus(
      getMetaMaskProvider() ? "available" : "unavailable",
    );
  }, []);

  const connect = () => {
    const ethereum = getMetaMaskProvider();
    if (!ethereum) return;
    ethereum.request({ method: "eth_requestAccounts" });
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>Remix & Wallet reconciliation</div>
        {wallet ? (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div>Network #{Number(wallet.chainId)}</div>
            <div style={{ paddingLeft: "16px" }}>
              {shortHex(wallet.address)}
            </div>
          </div>
        ) : (
          <button onClick={connect}>Connect</button>
        )}
      </div>
      <h1>Welcome to the example</h1>
      {metamaskAvailabilityStatus === "unavailable" && (
        <div>
          MetaMask is unavailable. You will not be able to test this demo :(
        </div>
      )}
      <div style={{ display: "flex" }}>
        <NavLink
          style={(p) => ({ color: p.isActive ? "green" : "inherit" })}
          to="/"
        >
          Home (public route)
        </NavLink>
        <NavLink
          style={(p) => ({
            paddingLeft: "16px",
            color: p.isActive ? "green" : "inherit",
          })}
          to="/usdc"
        >
          USDC overview (public route with wallet enhancement)
        </NavLink>
        <NavLink
          style={(p) => ({
            paddingLeft: "16px",
            color: !wallet ? "red" : p.isActive ? "green" : "inherit",
          })}
          to="/balance"
        >
          My Ether balance (protected route)
        </NavLink>
      </div>
      {children}
    </div>
  );
}

type WindowInstanceWithEthereum = Window &
  typeof globalThis & { ethereum?: any };

function getMetaMaskProvider() {
  const ethereum = (window as WindowInstanceWithEthereum).ethereum;
  if (!ethereum) return null;
  // The `providers` field is populated
  // - when CoinBase Wallet extension is also installed
  // - when user is on Brave and Brave Wallet is not deactivated
  // The expected object is an array of providers, the MetaMask provider is inside
  // See https://docs.cloud.coinbase.com/wallet-sdk/docs/injected-provider-guidance for more information
  // See also https://metamask.zendesk.com/hc/en-us/articles/360038596792-Using-Metamask-wallet-in-Brave-browser
  if (Array.isArray(ethereum.providers)) {
    const metaMaskProvider = ethereum.providers.find(
      (p: any) => p.isMetaMask && !p.isBraveWallet,
    );
    if (metaMaskProvider) return metaMaskProvider;
    const braveWalletProvider = ethereum.providers.find(
      (p: any) => p.isMetaMask && p.isBraveWallet,
    );
    if (!braveWalletProvider) return null;
    return braveWalletProvider;
  }
  if (!ethereum.isMetaMask) return null;
  return ethereum;
}
