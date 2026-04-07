import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { MapPin, PlusCircle, MessageCircle, User } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { currentUser } from "../data/mockData";
import { contarChatsNoLeidos, escucharCambiosDeChat } from "../data/chatStorage";

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [chatsNoLeidos, setChatsNoLeidos] = useState(0);

  useEffect(() => {
    const idUsuario = usuario?.id ?? currentUser.id;

    const cargar = async () => {
      const total = await contarChatsNoLeidos(idUsuario);
      setChatsNoLeidos(total);
    };

    void cargar();
    const desuscribir = escucharCambiosDeChat(() => {
      void cargar();
    });

    return () => {
      desuscribir();
    };
  }, [usuario?.id]);

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const resetRutaActiva = (ruta: string) => {
    navigate(`${ruta}?navReset=${Date.now()}`, { replace: true });
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1200] bg-secondary border-t border-secondary shadow-lg">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-4">
        <Link
          to="/"
          onClick={(e) => {
            if (location.pathname === "/") {
              e.preventDefault();
              resetRutaActiva("/");
            }
          }}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            isActive("/") && !location.pathname.includes("profile") && !location.pathname.includes("chat") && !location.pathname.includes("add-book") && !location.pathname.includes("book")
              ? "text-white bg-white/20"
              : "text-white/70 hover:text-white"
          }`}
        >
          <MapPin className="w-6 h-6" />
          <span className="text-xs">Explorar</span>
        </Link>

        <Link
          to="/add-book"
          onClick={(e) => {
            if (location.pathname === "/add-book") {
              e.preventDefault();
              resetRutaActiva("/add-book");
            }
          }}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            isActive("/add-book")
              ? "text-white bg-white/20"
              : "text-white/70 hover:text-white"
          }`}
        >
          <PlusCircle className="w-6 h-6" />
          <span className="text-xs">Añadir</span>
        </Link>

        <Link
          to="/chat"
          onClick={(e) => {
            if (location.pathname === "/chat") {
              e.preventDefault();
              resetRutaActiva("/chat");
            }
          }}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors relative ${
            isActive("/chat")
              ? "text-white bg-white/20"
              : "text-white/70 hover:text-white"
          }`}
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-xs">Chats</span>
          {chatsNoLeidos > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] leading-[18px] text-center">
              {chatsNoLeidos > 99 ? "99+" : chatsNoLeidos}
            </span>
          )}
        </Link>

        <Link
          to="/profile/current-user"
          onClick={(e) => {
            if (location.pathname === "/profile/current-user") {
              e.preventDefault();
              resetRutaActiva("/profile/current-user");
            }
          }}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            isActive("/profile")
              ? "text-white bg-white/20"
              : "text-white/70 hover:text-white"
          }`}
        >
          <User className="w-6 h-6" />
          <span className="text-xs">Perfil</span>
        </Link>
      </div>
    </nav>
  );
}
