import { useEffect, useState } from "react";
import { IMAGE_LOADING_CLASS } from "../data/imageUtils";

interface BookCoverProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
}

export default function BookCover({
  src,
  alt,
  className = "w-24 h-36 object-cover",
  containerClassName = "",
}: BookCoverProps) {
  const SRC_PLACEHOLDER = "https://placehold.co/240x360/EDE7DD/6B6962?text=Sin+portada";
  const srcInicial = src?.trim() ? src : SRC_PLACEHOLDER;
  const [srcActual, setSrcActual] = useState(srcInicial);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const siguienteSrc = src?.trim() ? src : SRC_PLACEHOLDER;
    setSrcActual(siguienteSrc);
    setLoaded(false);
    setError(false);
  }, [src]);

  const handleLoad = () => {
    setLoaded(true);
    setError(false);
  };

  const handleError = () => {
    if (srcActual !== SRC_PLACEHOLDER) {
      setSrcActual(SRC_PLACEHOLDER);
      setLoaded(false);
      return;
    }

    setError(true);
  };

  if (error) {
    // Mostrar placeholder SVG si falla la carga
    return (
      <div className={`${containerClassName} ${IMAGE_LOADING_CLASS} flex items-center justify-center overflow-hidden`}>
        <svg
          className="w-full h-full opacity-30"
          viewBox="0 0 100 150"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="100" height="150" fill="#e2e8f0" />
          <path
            d="M 20 30 L 80 30 L 80 120 L 20 120 Z"
            stroke="#cbd5e1"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="50" cy="50" r="8" fill="#cbd5e1" />
          <line x1="20" y1="70" x2="80" y2="70" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="20" y1="80" x2="80" y2="80" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="20" y1="90" x2="80" y2="90" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="20" y1="100" x2="70" y2="100" stroke="#cbd5e1" strokeWidth="1" />
        </svg>
        <span className="absolute text-2xl">📖</span>
      </div>
    );
  }

  return (
    <div className={`${containerClassName} ${!loaded ? IMAGE_LOADING_CLASS : ""} overflow-hidden`}>
      <img
        src={srcActual}
        alt={alt}
        className={className}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
