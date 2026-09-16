import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { Assignments } from "./pages/Assignments/Assignments";
import { Calendar } from "./pages/Calendar/Calendar";
import { Dashboard } from "./pages/Dashboard/Dashboard";
import { Login } from "./pages/Login/Login";
import { PatientDetail } from "./pages/Patients/PatientDetail";
import { PatientForm } from "./pages/Patients/PatientForm";
import { PatientList } from "./pages/Patients/PatientList";
import { Students } from "./pages/Students/Students";
import { Supervision } from "./pages/Supervision/Supervision";
import { Support } from "./pages/Support/Support";

// Rutas base de la aplicación. Todas las pantallas están vacías por
// ahora (solo un título); se irán completando conforme avance cada
// historia de Linear. No hay todavía rutas protegidas por rol: eso se
// agregará junto con la lógica real de useAuth.
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/new" element={<PatientForm />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/supervision" element={<Supervision />} />
          <Route path="/students" element={<Students />} />
          <Route path="/support" element={<Support />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
