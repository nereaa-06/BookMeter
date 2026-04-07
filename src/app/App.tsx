import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./auth/AuthProvider";
import { iniciarTemaColor } from "./data/themeStorage";

export default function App() {
  useEffect(() => {
    iniciarTemaColor();
  }, []);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}