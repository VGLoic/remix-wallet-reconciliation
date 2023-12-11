# Welcome to Remix & Wallet reconciliation example!

This repository contains the code in order to share the user MetaMask wallet with the server in a Remix application. Said otherwise, it tries to reconcile the heavy client side approach of the wallet with the prefered server side approach of [Remix](https://remix.run/).

It enables the route loaders to have access to the connected user and efficiently perform the usual fetching logic related to the user address and network.

## TLDR

This is one possible answer to the issue of leveraging the server in a dApp with the following criteria:

- Remix application,
- Not requiring authentication such as [Sign in with Ethereum](https://login.xyz/) (SIWE). Said otherwise, there are no privacy requirement regarding a particular wallet related data \*,
- Exposing routes that do not depend on the user wallet, i.e. `public route`,
- Exposing routes that are enhanced by the user wallet, i.e. `public route enhanced by wallet`,
- Exposing routes that only make sense with a user wallet, i.e. `protected route`.

The user is able to connect as usual its MetaMask wallet to the application. On successful connection, the wallet address and chain ID are sent backend side in order to perform a redirection while setting a minimalistic [Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) in the user's browser.

On navigation, the cookie is sent alongside the request, hence allowing the route loaders to have access to the user address and the connected network in order to:

- fetch the user data,
- redirect the user in case of accessing a protected route.

⚠️⚠️ **\*This approach does not replace an authentication such as SIWE. The server has no guarantee that the provided address contained in the cookie is actually controlled by the user.** ⚠️⚠️

## Development

From your terminal:

```sh
nvm use
```

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.
