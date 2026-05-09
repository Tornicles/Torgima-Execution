import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// When the SPA is hosted on a different origin than the API (e.g. Vercel
// serving the frontend, Railway/Fly serving the Express API), VITE_API_BASE_URL
// must be set at build time so all relative `/api/...` calls go to the right
// origin. When unset, requests fall back to same-origin (existing behavior).
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
