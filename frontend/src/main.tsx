import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { App } from "./app/App";
import "./components/ui/ui.css";
import "./index.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("The application root is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
