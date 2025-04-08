import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Import fonts
import "@fontsource/bebas-neue"; // Display font for headlines
import "@fontsource/ibm-plex-sans/300.css"; // Light weight
import "@fontsource/ibm-plex-sans/400.css"; // Regular weight
import "@fontsource/ibm-plex-sans/500.css"; // Medium weight
import "@fontsource/ibm-plex-sans/600.css"; // Semibold weight
import "@fontsource/ibm-plex-sans/700.css"; // Bold weight

createRoot(document.getElementById("root")!).render(
  <App />
);
