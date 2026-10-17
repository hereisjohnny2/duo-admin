"use client";

import { ToastContainer } from "react-toastify";

/* Notificações do app (react-toastify). As cores vêm das variáveis do tema
   em globals.css, então seguem o modo claro/escuro sem precisar de estado. */

export default function Toaster() {
  return <ToastContainer position="bottom-right" autoClose={3500} newestOnTop closeOnClick pauseOnFocusLoss={false} theme="light" />;
}
