window.onerror = function (message, source, lineno, colno, error) {
  console.error("Global error handler:", message, source, lineno, colno, error);
};
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
});

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { HashRouter } from "react-router-dom";

// Add more detailed error logging
window.addEventListener('error', (event) => {
  console.error('Global error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

try {
  const root = document.getElementById("root");
  
  if (!root) {
    throw new Error("Root element not found");
  }

  const reactRoot = ReactDOM.createRoot(root);

  reactRoot.render(
    <HashRouter>
      <App />
    </HashRouter>
  );

} catch (error) {
  console.error("Detailed error during React rendering:", {
    error,
    stack: error instanceof Error ? error.stack : undefined,
    type: error instanceof Error ? error.constructor.name : typeof error
  });
}
