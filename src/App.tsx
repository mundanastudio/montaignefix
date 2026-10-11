import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AdminShell } from "./pages/admin/AdminShell";
import { ShoppingList } from "./pages/admin/ShoppingList";
import { TicketDetail } from "./pages/admin/TicketDetail";
import { TicketList } from "./pages/admin/TicketList";
import { Placeholder } from "./pages/Placeholder";
import { RequestForm } from "./pages/RequestForm";
import { StyleGuide } from "./pages/StyleGuide";
import { TeamList } from "./pages/team/TeamList";
import { TeamShell } from "./pages/team/TeamShell";
import { TeamTicket } from "./pages/team/TeamTicket";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<RequestForm />} />
          <Route path="gestion" element={<AdminShell />}>
            <Route index element={<TicketList />} />
            <Route path="compra" element={<ShoppingList />} />
            <Route path=":code" element={<TicketDetail />} />
          </Route>
          <Route path="equipo" element={<TeamShell />}>
            <Route index element={<TeamList />} />
            <Route path=":code" element={<TeamTicket />} />
          </Route>
          <Route path="muestra" element={<StyleGuide />} />
          <Route path="*" element={<Placeholder title="Página no encontrada" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
