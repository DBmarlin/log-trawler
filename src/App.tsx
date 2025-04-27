import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Home from "./components/home";

function App() {
  try {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </ThemeProvider>
    );
  } catch (error) {
    console.error("Error rendering App component:", error);
    return <div>Error rendering App component</div>;
  }
}

export default App;
