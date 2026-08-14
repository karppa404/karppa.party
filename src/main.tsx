import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/routes/App.tsx'
import { BrowserRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "@/components/theme-provider"
import HomeLayout from "@/layouts/HomeLayout"
import { ConvexProvider, ConvexReactClient } from "convex/react";
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ConvexProvider client={convex}>
        <BrowserRouter>
          <Routes>
            <Route element={<HomeLayout />}>
              <Route index element={<App />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ConvexProvider>
    </ThemeProvider>
  </StrictMode>,
)
