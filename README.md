# Reconcile Remix & Wallet

This repository contains the code in order to share the user MetaMask wallet with the server in a Remix application. Said otherwise, it tries to reconcile the heavy client side approach of the wallet with the prefered server side approach of [Remix](https://remix.run/).

This enables the route loaders to have access to the connected user and efficiently perform the usual fetching logic related to the user address and network.

## TLDR

This is one possible answer to the issue of leveraging the server in a dApp with the following criteria:

- Remix application,
- Not requiring authentication such as [Sign in with Ethereum](https://login.xyz/) (SIWE). Said otherwise, there are no privacy requirement regarding a particular wallet related data \*,

The user can connect their MetaMask wallet to the application as usual. On successful connection, the wallet address and chain ID are sent backend side in order to perform a redirection while setting a minimalistic [Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) in the user's browser.

During navigation, the cookie is sent with the request, thereby enabling the route loaders to access the user's address and the connected network in order to:

- fetch the user data,
- redirect the user in case of accessing a route that need a connected wallet.

⚠️⚠️ **\*This approach does not replace an authentication such as SIWE. The server has no guarantee that the provided address contained in the cookie is actually controlled by the user.** ⚠️⚠️

```ts
// Page loader, executed server side
export async function loader({ request }: LoaderFunctionArgs) {
  const userWallet = await retrieveConnectedWalletFromCookie(request);
  // If parsing failed, we don't want to stay on this page as it is only for connected users
  if (!userWallet) return redirect("/");

  const chain = chainIdToChain(userWallet.chainId);
  if (!chain) return redirect("/");

  const client = createPublicClient({ transport: http(), chain });
  const balance = await getBalance(client, { address: userWallet.address });

  return json({
    balance: formatEther(balance),
    chain,
  });
}

// Fetched data is consumed client side
export default function Balance() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <h3>Balance on chain {data.chain.name}</h3>
      <p>{data.balance} (Eth)</p>
    </div>
  );
}
```

## Issue and motivation

Interactions with a cryptocurrency wallet, e.g. [MetaMask extension](https://metamask.io), generally happen in the browser of the user as we want to keep the private key far away from a server. In other words, Ethereum-related applications typically have the wallet logic in the user's browser, specifically on the client-side. This is generally the case for data fetching, the app will retrieve the user wallet address, store it client side and use it for network requests in order to fetch data on some APIs, e.g. [TheGraph](https://thegraph.com/).

This approach works well in the current state of the frontend ecosystem. As an example, one can consider a [React](https://react.dev/) app, bundled with [Vite](https://vitejs.dev/), managing wallet with [Wagmi](https://wagmi.sh/) and using [React-Query](https://tanstack.com/query/latest/docs/react/overview) for data fetching. It will give the developer a quick and efficient way to interact with the user's wallet and perform the needed requests based on the wallet address in order to retrieve the user data, all of this running perfectly client side.

Currently, meta frameworks such as [NextJS](https://nextjs.org/) or [Remix](https://remix.run/) are encouraging developers to leverage the application server. The goal is to simplify the code downloaded and ran client side by moving as much of the data fetching and logic to the server. In addition to the performance gain, these meta frameworks provide a more complete developer experience as the frontier between backend code and frontend code is lower.

**Mixing these meta-frameworks with the wallet is however non straightforward as the wallet state lives exclusively client side while we want to push for server side logic.**

Before going further, it is important to consider what kind of application we are talking about. We can distinsuish two kinds of Ethereum related application.

- The one with private data: data associated to a particular address is private and only accessible by authorised users. The authentication mechanism will generally be of the form of a Sign in with Ethereum. **In this kind of application, a session cookie usually exists between the server and the client so the server has already access to the wallet address. This repository is not about this kind of application.**
- The usual one: all the data is public and accessible through a public API such as TheGraph. The client manages the connected wallet address and use it to query the wallet related data on the public API. **The server does not naturally have access to the wallet address in this case, this repository focus on this kind of application.**

The possible solutions to our issue lives between two extreme solutions:

1. Do nothing: we keep our logic client side as before. The price to pay is that we don't leverage the server at hand for all the user data,
2. Integrate authentication such as SIWE: it will technically give the server the wallet address as a session is created between the server and the client. It is though an overkill feature wise as the data hosted by the API is public so we don't need a proper authentication mechanism. The price to pay is that an authentication step must be imposed client side.

Now the found possibilities in order to inform the server of the wallet address are:

- adding the wallet address as a part of the URL: either as query param or directly in the path, in that way, the server would be able to retrieve it using its router capabilities, **this is not explored here**,
- introducing a [cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) in order to share the wallet state to the server: **this is the goal of this repository**.

## Flow

The flow in itself is short.

1. Once the user has connected its wallet to the application, the client makes a HTTP request to the server with the wallet address and the chain ID as payload,
2. the server verifies that the address and chain ID in the payload are well-formatted. If formatting is ok, it builds the associated cookie with the wallet data and redirect the user to the current location with the associated cookie,
3. the user now possesses a cookie containing the wallet state, and this cookie will be sent with every new request to the server, including routing,
4. on every request or new page, the server is able to parse the expected cookie and access the wallet state of the user.

Additionally, the HTTP request at step 1 is made every time the user changes its connected wallet address or network. In that way, the cookie should always reflect the current state of the wallet.

```ts
// POST /user-wallet handler
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
      headers: { "Set-Cookie": await userWallet.serialize({}) },
    });
  }

  return redirect(locationParsingResult.data, {
    headers: { "Set-Cookie": await userWallet.serialize(parsingResult.data) },
  });
}



// Somewhere else client side

function Layout({ children }: LayoutProps) {
  useSyncWallet();

  return (...)
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

```

## Cool cookie, what now?

Now we can stop using the client side wallet state for the routing or the data fetching and leverage the application server for these. All the wallet related logic, apart from transaction execution, can be moved away from the client into the server.

The typical scenario would be:

1. user navigates to a route,
2. server checks for the wallet cookie and successfully parse it,
3. server trigger the network requests based on the wallet state retrieved from the cookie,
4. server renders the route component with the loaded data.

In the case where the wallet cookie is not present or not valid, the server is able to redirect the user to another route.

Here is a dummy example for a Remix route with a simple component displaying user balance

```ts
// Page loader, executed server side
export async function loader({ request }: LoaderFunctionArgs) {
  const userWallet = await retrieveConnectedWalletFromCookie(request);
  // If parsing failed, we don't want to stay on this page as it is only for connected users
  if (!userWallet) return redirect("/");

  const chain = chainIdToChain(userWallet.chainId);
  if (!chain) return redirect("/");

  const client = createPublicClient({ transport: http(), chain });
  const balance = await getBalance(client, { address: userWallet.address });

  return json({
    balance: formatEther(balance),
    chain,
  });
}

// Fetched data is consumed client side
export default function Balance() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <h3>Balance on chain {data.chain.name}</h3>
      <p>{data.balance} (Eth)</p>
    </div>
  );
}
```

## What it is not

- **This is not a privacy conserving solution**. This solution assumes that we rely on a public API, such as a blockchain node or TheGraph. However, **the server never checks that the address put in the cookie is controlled by the user**. This could be achieved only by an authentication mechanism such as SIWE. Nothing prevents someone to use a cookie with any chosen address in order to "impersonate" them. In terms of privacy, the situation is similar to the full client side approach.

- This does not replace the wallet client side in any way. It still needs a wallet at the beginning in order to specify a wallet state. More importantly, only the public address is known server side but **any transaction signature needs to be fully handled client side where the wallet is.**

## Development

From your terminal:

```sh
nvm use
```

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.
