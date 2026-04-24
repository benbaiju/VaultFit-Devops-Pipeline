import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout.tsx";
import { ProtectedRoute } from "./components/protected-route.tsx";
import { BookingPage } from "./pages/booking-page.tsx";
import { HomePage } from "./pages/home-page.tsx";
import { LoginPage } from "./pages/login-page.tsx";
import { RegisterPage } from "./pages/register-page.tsx";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="bookings" element={<BookingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
