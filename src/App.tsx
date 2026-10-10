import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AdminAccess } from "./pages/AdminAccess";
import { Placeholder } from "./pages/Placeholder";
import { RequestForm } from "./pages/RequestForm";
import { StyleGuide } from "./pages/StyleGuide";
import { TeamAccess } from "./pages/TeamAccess";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<RequestForm />} />
          <Route path="gestion" element={<AdminAccess />} />
          <Route path="equipo" element={<TeamAccess />} />
          <Route path="muestra" element={<StyleGuide />} />
          <Route path="*" element={<Placeholder title="Página no encontrada" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
