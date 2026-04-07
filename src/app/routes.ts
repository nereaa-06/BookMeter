import { createBrowserRouter } from "react-router";
import Root from "./Root";
import Home from "./pages/Home";
import AddBook from "./pages/AddBook";
import BookDetail from "./pages/BookDetail";
import ChatPage from "./pages/ChatPage";
import Profile from "./pages/Profile";
import AuthPage from "./pages/Auth";

export const router = createBrowserRouter([
  { path: "/auth", Component: AuthPage },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "add-book", Component: AddBook },
      { path: "book/:id", Component: BookDetail },
      { path: "chat", Component: ChatPage },
      { path: "chat/:id", Component: ChatPage },
      { path: "profile/:id", Component: Profile },
    ],
  },
]);
