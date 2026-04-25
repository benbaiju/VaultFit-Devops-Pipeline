import { Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/admin-page.tsx";
import { AuthHomeRedirect } from "./components/root-redirect.tsx";
import { ProtectedRoute, RoleRoute, TrainerVerifiedRoute } from "./components/protected-route.tsx";
import { RoleShellLayout } from "./components/role-shell-layout.tsx";
import { BookingPage } from "./pages/booking-page.tsx";
import { ClientProfilePage } from "./pages/client-profile-page.tsx";
import { HomePage } from "./pages/home-page.tsx";
import { LoginPage } from "./pages/login-page.tsx";
import { MessagesPage } from "./pages/messages-page.tsx";
import { NotificationsPage } from "./pages/notifications-page.tsx";
import { PlansPage } from "./pages/plans-page.tsx";
import { RegisterPage } from "./pages/register-page.tsx";
import { ReviewsPage } from "./pages/reviews-page.tsx";
import { ServicesPage } from "./pages/services-page.tsx";
import { TrainerBookingsPage } from "./pages/trainer-bookings-page.tsx";
import { TrainerDashboardPage } from "./pages/trainer-dashboard-page.tsx";
import { TrainerProfilePage } from "./pages/trainer-profile-page.tsx";
import { TrainerPublicProfilePage } from "./pages/trainer-public-profile-page.tsx";
import { VerificationPage } from "./pages/verification-page.tsx";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<AuthHomeRedirect />} />
      <Route
        path="/client"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["client"]}>
              <RoleShellLayout variant="client" />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="trainers" element={<HomePage />} />
        <Route path="trainers/:trainerId" element={<TrainerPublicProfilePage />} />
        <Route path="profile" element={<ClientProfilePage />} />
        <Route path="book" element={<BookingPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route
        path="/trainer"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["trainer"]}>
              <RoleShellLayout variant="trainer" />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<TrainerDashboardPage />} />
        <Route path="profile" element={<TrainerProfilePage />} />
        <Route
          path="services"
          element={
            <TrainerVerifiedRoute>
              <ServicesPage />
            </TrainerVerifiedRoute>
          }
        />
        <Route
          path="services/create"
          element={
            <TrainerVerifiedRoute>
              <ServicesPage />
            </TrainerVerifiedRoute>
          }
        />
        <Route
          path="services/schedule"
          element={
            <TrainerVerifiedRoute>
              <ServicesPage />
            </TrainerVerifiedRoute>
          }
        />
        <Route
          path="services/blocked-dates"
          element={
            <TrainerVerifiedRoute>
              <ServicesPage />
            </TrainerVerifiedRoute>
          }
        />
        <Route
          path="services/existing"
          element={
            <TrainerVerifiedRoute>
              <ServicesPage />
            </TrainerVerifiedRoute>
          }
        />
        <Route
          path="bookings"
          element={
            <TrainerVerifiedRoute>
              <TrainerBookingsPage />
            </TrainerVerifiedRoute>
          }
        />
        <Route
          path="plans"
          element={
            <TrainerVerifiedRoute>
              <PlansPage />
            </TrainerVerifiedRoute>
          }
        />
        <Route
          path="messages"
          element={
            <TrainerVerifiedRoute>
              <MessagesPage />
            </TrainerVerifiedRoute>
          }
        />
        <Route
          path="notifications"
          element={
            <TrainerVerifiedRoute>
              <NotificationsPage />
            </TrainerVerifiedRoute>
          }
        />
        <Route path="verification" element={<VerificationPage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin"]}>
              <RoleShellLayout variant="admin" />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminPage />} />
      </Route>
      <Route path="*" element={<AuthHomeRedirect />} />
    </Routes>
  );
}

export default App;
