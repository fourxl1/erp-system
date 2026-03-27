import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import Maintenance from "./pages/Maintenance";
import MasterData from "./pages/MasterData";
import Messages from "./pages/Messages";
import Reports from "./pages/Reports";
import Requests from "./pages/Requests";
import StockMovements from "./pages/StockMovements";
import { fetchCurrentUser } from "./services/api";
import { hasAllowedRole, readStoredUser } from "./utils/auth";

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");
  const [status, setStatus] = useState(token ? "checking" : "missing");
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      return () => {
        cancelled = true;
      };
    }

    fetchCurrentUser()
      .then((response) => {
        if (!cancelled) {
          const nextUser = response?.user || {};
          localStorage.setItem("inventory-user-data", JSON.stringify(nextUser));
          localStorage.setItem("inventory-user", nextUser.full_name || nextUser.email || "Store User");
          setCurrentUser(nextUser);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("missing");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "checking") {
    return null;
  }

  if (status !== "ready") {
    return <Navigate to="/login" replace />;
  }

  if (!hasAllowedRole(currentUser, allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function HomeRedirect() {
  return <Navigate to={localStorage.getItem("token") ? "/dashboard" : "/login"} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <Inventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/movements"
        element={
          <ProtectedRoute>
            <StockMovements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests"
        element={
          <ProtectedRoute>
            <Requests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance"
        element={
          <ProtectedRoute>
            <Maintenance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/master-data"
        element={
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <MasterData />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export default App;
