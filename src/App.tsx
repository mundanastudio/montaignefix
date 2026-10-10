import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Placeholder } from "./pages/Placeholder";
import { RequestForm } from "./pages/RequestForm";
import { StyleGuide } from "./pages/StyleGuide";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<RequestForm />} />
          <Route path="gestion" element={<Placeholder title="Panel del gerente" phase="Fase 4" />} />
          <Route path="equipo" element={<Placeholder title="Panel del equipo" phase="Fase 5" />} />
          <Route path="muestra" element={<StyleGuide />} />
          <Route path="*" element={<Placeholder title="Página no encontrada" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
