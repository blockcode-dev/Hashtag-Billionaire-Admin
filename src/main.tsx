import { createRoot } from "react-dom/client";
import "./services/Api/interceptors";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
