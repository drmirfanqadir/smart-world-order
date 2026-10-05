import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { AppProvider } from "./hooks/use-app.tsx";
import { ContentProvider } from "./hooks/use-content.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import HomePage from "./pages/home/index.tsx";
import AdminPage from "./pages/admin/index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import PwaBanner from "@/components/pwa-banner.tsx";
import "./i18n/index.ts";

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
      <AppProvider>
        <ContentProvider>
          <PwaBanner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ContentProvider>
      </AppProvider>
    </DefaultProviders>
  );
}
