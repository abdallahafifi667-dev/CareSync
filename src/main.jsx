import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./shared/styles/index.css";
import "./shared/styles/colors.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { ThemeProvider } from "./shared/hooks/contexts/ThemeContext";
import "./shared/locales/i18n";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
