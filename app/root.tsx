import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// NOTE: root must NOT authenticate — public routes (/api/*, /booking/:token)
// and the widget load through here too. Admin auth happens in routes/app.tsx.

export const meta = () => [
  { title: "ProBooker" },
  { name: "shopify-api-key", content: String(process.env.SHOPIFY_API_KEY || "") },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  let message = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    message = error.data?.message || error.statusText || message;
  } else if (error instanceof Error) {
    message = import.meta.env.DEV ? error.message : "An unexpected error occurred.";
  }
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Error</title>
      </head>
      <body style={{ fontFamily: "system-ui", padding: "2rem" }}>
        <h1>Something went wrong</h1>
        <p>{message}</p>
        <p>
          <a href="/app">Go to dashboard</a>
        </p>
      </body>
    </html>
  );
}
