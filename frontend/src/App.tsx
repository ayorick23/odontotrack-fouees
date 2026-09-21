import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Assignments } from "./pages/Assignments/Assignments";
import { Calendar } from "./pages/Calendar/Calendar";
import { Dashboard } from "./pages/Dashboard/Dashboard";
import { Login } from "./pages/Login/Login";
import { PatientDetail } from "./pages/Patients/PatientDetail";
import { PatientForm } from "./pages/Patients/PatientForm";
import { PatientList } from "./pages/Patients/PatientList";
import { RoleForm } from "./pages/Roles/RoleForm";
import { RoleList } from "./pages/Roles/RoleList";
import { Students } from "./pages/Students/Students";
import { Supervision } from "./pages/Supervision/Supervision";
import { Support } from "./pages/Support/Support";

function App() {
  return (
    <ThemeProvider>
      <Toaster />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/patients" element={<PatientList />} />
              <Route path="/patients/new" element={<PatientForm />} />
              <Route path="/patients/:id/edit" element={<PatientForm />} />
              <Route path="/patients/:id" element={<PatientDetail />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/supervision" element={<Supervision />} />
              <Route path="/students" element={<Students />} />
              <Route path="/roles" element={<RoleList />} />
              <Route path="/roles/:id/edit" element={<RoleForm />} />
              <Route path="/roles/:id" element={<RoleForm />} />
              <Route path="/support" element={<Support />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
