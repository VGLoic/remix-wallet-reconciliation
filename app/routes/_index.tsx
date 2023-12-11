import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { shortHex } from "~/utils";
import { retrieveConnectedWalletFromCookie } from "~/wallet-cookie.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userWallet = await retrieveConnectedWalletFromCookie(request);

  return json({
    wallet: userWallet,
  });
}

export default function Index() {
  const data = useLoaderData<typeof loader>();

  if (!data.wallet) {
    return (
      <div>
        <h3>Home</h3>
        <div>
          <div>
            <strong>You are not connected.</strong>
          </div>
          <div style={{ paddingTop: "8px" }}>
            <div>
              - By clicking on the connect button on the top right you will:
            </div>
            <ol>
              <li>Connect your MetaMask wallet to this app</li>
              <li>
                A backend call to `POST /user-wallet` will automatically be
                triggered with the address and the chain ID of your wallet,
              </li>
              <li>
                The backend will create a cookie containing the address and the
                chain ID,
              </li>
              <li>
                Redirect to the current route and set the cookie in your
                browser.
              </li>
            </ol>
            <div>
              Every time you change your address or your network, the cookie
              will be updated using the same process.
            </div>
          </div>
          <div style={{ paddingTop: "8px" }}>
            <div>
              - You can browse public routes, but you can not browse routes
              restricted to connected users.
            </div>
            <div>
              Protected routes loaders will check for the wallet cookie
              existence and will redirect to the home page if it is not present.
            </div>
          </div>
          <div style={{ paddingTop: "8px" }}>
            - Once connected, route loaders retrieve the wallet from the cookie
            and can use it to perform the target requests.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3>Home</h3>
      <div>
        <div>
          <strong>You are connected.</strong>
        </div>
        <div style={{ paddingTop: "8px" }}>
          <div>
            - Wallet address is {shortHex(data.wallet.address)}, network is #
            {data.wallet.chainId}.
          </div>
        </div>
        <div style={{ paddingTop: "8px" }}>
          <div>- You can browse public and protected routes.</div>
          <div>
            Loaders of protected routes and public routes with wallet
            enhancement will retrieve the wallet from the cookie and can use it
            to perform the target requests.
          </div>
        </div>
        <div style={{ paddingTop: "8px" }}>
          - Every time you change your address or your network, the cookie will
          be updated using the same process.
        </div>
      </div>
    </div>
  );
}
