import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navigation from "./components/Navigation";
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AddSite from "./pages/AddSite";
import IoTSensors from "./pages/IoTSensors";
import TestingDiagnostics from "./pages/TestingDiagnostics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Monitor from "./pages/Monitor";
import Evaluate from "./pages/Evaluate";
import VisualMonitoring from "./pages/VisualMonitoring";
import RealTimeMonitor from "./pages/RealTimeMonitor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Welcome />} />
            <Route path="/auth" element={<Auth />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-site"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <AddSite />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sensors"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <IoTSensors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/diagnostics"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <TestingDiagnostics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visual-monitoring"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <VisualMonitoring />
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-time"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <RealTimeMonitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitor"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <Monitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluate"
              element={
                <ProtectedRoute>
                  <Navigation />
                  <Evaluate />
                </ProtectedRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
