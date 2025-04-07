import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { NoteEditingProvider } from "./hooks/use-notes";

createRoot(document.getElementById("root")!).render(
  <NoteEditingProvider>
    <App />
  </NoteEditingProvider>
);
