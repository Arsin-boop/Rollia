import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { I18nProvider } from "./i18n";

export default function App() {
  return (
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  );
}

