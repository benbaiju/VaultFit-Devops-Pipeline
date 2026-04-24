import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout.tsx";
import { ProtectedRoute } from "./components/protected-route.tsx";
import { BookingPage } from "./pages/booking-page.tsx";
import { HomePage } from "./pages/home-page.tsx";
import { LoginPage } from "./pages/login-page.tsx";
import { MessagesPage } from "./pages/messages-page.tsx";
import { NotificationsPage } from "./pages/notifications-page.tsx";
import { PlansPage } from "./pages/plans-page.tsx";
import { RegisterPage } from "./pages/register-page.tsx";
import { ReviewsPage } from "./pages/reviews-page.tsx";
import { ServicesPage } from "./pages/services-page.tsx";
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
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
