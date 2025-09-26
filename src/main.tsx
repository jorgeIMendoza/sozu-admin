import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA (handled automatically by vite-plugin-pwa)

createRoot(document.getElementById("root")!).render(<App />);
