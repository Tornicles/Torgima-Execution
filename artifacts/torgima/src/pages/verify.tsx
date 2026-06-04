import { Redirect, useSearch } from "wouter";

/** Legacy magic-link path — forwards to /auth/callback preserving query string. */
export default function VerifyPage() {
  const search = useSearch();
  const q = search.startsWith("?") ? search : search ? `?${search}` : "";
  return <Redirect to={`/auth/callback${q}`} />;
}
