import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { I18nProvider } from "./i18n";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </ErrorBoundary>
  );
}

