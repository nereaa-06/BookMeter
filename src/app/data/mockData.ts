export interface User {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalRatings: number;
  about?: string;
  location: {
    lat: number;
    lng: number;
  };
}

export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  synopsis: string;
  condition: string;
  status: "disponible" | "reservado" | "intercambiado";
  isbn?: string;
  owner: User;
  distance: number;
  location: {
    lat: number;
    lng: number;
  };
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
}

export interface Chat {
  id: string;
  book: Book;
  otherUser: User;
  messages: Message[];
}

export const currentUser: User = {
  id: "current-user",
  name: "María García",
  avatar: "https://i.pravatar.cc/150?img=5",
  rating: 4.8,
  totalRatings: 23,
  about: "Me gustan los libros de narrativa, los intercambios sencillos y descubrir lecturas nuevas cerca de casa.",
  location: {
    lat: 40.4168,
    lng: -3.7038
  }
};

export const mockUsers: User[] = [
  {
    id: "1",
    name: "Carlos Ruiz",
    avatar: "https://i.pravatar.cc/150?img=12",
    rating: 4.9,
    totalRatings: 45,
    location: { lat: 40.4200, lng: -3.7050 }
  },
  {
    id: "2",
    name: "Laura Martínez",
    avatar: "https://i.pravatar.cc/150?img=25",
    rating: 4.7,
    totalRatings: 31,
    location: { lat: 40.4150, lng: -3.7100 }
  },
  {
    id: "3",
    name: "Javier López",
    avatar: "https://i.pravatar.cc/150?img=33",
    rating: 4.6,
    totalRatings: 18,
    location: { lat: 40.4180, lng: -3.7020 }
  },
  {
    id: "4",
    name: "Ana Sánchez",
    avatar: "https://i.pravatar.cc/150?img=45",
    rating: 5.0,
    totalRatings: 12,
    location: { lat: 40.4220, lng: -3.7080 }
  }
];

export const mockBooks: Book[] = [
  {
    id: "1",
    title: "Cien años de soledad",
    author: "Gabriel García Márquez",
    cover: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop",
    synopsis: "La obra maestra del realismo mágico que narra la historia de la familia Buendía a lo largo de siete generaciones en el pueblo ficticio de Macondo.",
    condition: "Buen estado",
    status: "disponible",
    isbn: "9780307474728",
    owner: mockUsers[0],
    distance: 0.8,
    location: { lat: 40.4200, lng: -3.7050 }
  },
  {
    id: "2",
    title: "1984",
    author: "George Orwell",
    cover: "https://images.unsplash.com/photo-1495640452828-3df6795cf69b?w=400&h=600&fit=crop",
    synopsis: "Una distopía sobre un régimen totalitario que controla todos los aspectos de la vida mediante la vigilancia constante y la manipulación del lenguaje.",
    condition: "Como nuevo",
    status: "disponible",
    isbn: "9780451524935",
    owner: mockUsers[1],
    distance: 1.2,
    location: { lat: 40.4150, lng: -3.7100 }
  },
  {
    id: "3",
    title: "El principito",
    author: "Antoine de Saint-Exupéry",
    cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=600&fit=crop",
    synopsis: "Un cuento poético sobre un pequeño príncipe que viaja de planeta en planeta haciendo preguntas que van al corazón de lo que significa ser humano.",
    condition: "Usado - Buen estado",
    status: "disponible",
    isbn: "9780156012195",
    owner: mockUsers[2],
    distance: 0.5,
    location: { lat: 40.4180, lng: -3.7020 }
  },
  {
    id: "4",
    title: "La sombra del viento",
    author: "Carlos Ruiz Zafón",
    cover: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop",
    synopsis: "En la Barcelona de posguerra, un joven descubre un libro maldito que cambiará su vida para siempre en este misterioso thriller literario.",
    condition: "Excelente estado",
    status: "disponible",
    isbn: "9780143126393",
    owner: mockUsers[3],
    distance: 1.5,
    location: { lat: 40.4220, lng: -3.7080 }
  },
  {
    id: "5",
    title: "El amor en los tiempos del cólera",
    author: "Gabriel García Márquez",
    cover: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=600&fit=crop",
    synopsis: "Una historia de amor épica que abarca más de cincuenta años, explorando la naturaleza del amor verdadero y la persistencia del deseo.",
    condition: "Buen estado",
    status: "disponible",
    isbn: "9780307389732",
    owner: mockUsers[0],
    distance: 0.8,
    location: { lat: 40.4200, lng: -3.7050 }
  },
  {
    id: "6",
    title: "Rayuela",
    author: "Julio Cortázar",
    cover: "https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=400&h=600&fit=crop",
    synopsis: "Una novela experimental que puede leerse de múltiples maneras, siguiendo a un escritor argentino en París en busca del sentido de la vida.",
    condition: "Como nuevo",
    status: "disponible",
    isbn: "9788420412962",
    owner: mockUsers[1],
    distance: 1.2,
    location: { lat: 40.4150, lng: -3.7100 }
  },
  {
    id: "7",
    title: "Los renglones torcidos de Dios",
    author: "Torcuato Luca de Tena",
    cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop",
    synopsis: "Una detective privada se interna en un psiquiátrico haciéndose pasar por paciente para resolver un misterioso caso.",
    condition: "Usado - Buen estado",
    status: "disponible",
    isbn: "9788408238133",
    owner: mockUsers[2],
    distance: 0.5,
    location: { lat: 40.4180, lng: -3.7020 }
  },
  {
    id: "8",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    cover: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=600&fit=crop",
    synopsis: "Una audaz historia de la humanidad desde la Edad de Piedra hasta el siglo XXI, explorando cómo el Homo sapiens llegó a dominar el mundo.",
    condition: "Excelente estado",
    status: "disponible",
    isbn: "9780062316097",
    owner: mockUsers[3],
    distance: 1.5,
    location: { lat: 40.4220, lng: -3.7080 }
  }
];

export const currentUserBooks: Book[] = [
  {
    id: "user-1",
    title: "Don Quijote de la Mancha",
    author: "Miguel de Cervantes",
    cover: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400&h=600&fit=crop",
    synopsis: "Las aventuras del ingenioso hidalgo que confunde molinos con gigantes y la realidad con la ficción.",
    condition: "Buen estado",
    status: "disponible",
    isbn: "9788424936464",
    owner: currentUser,
    distance: 0,
    location: currentUser.location
  },
  {
    id: "user-2",
    title: "La casa de los espíritus",
    author: "Isabel Allende",
    cover: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop",
    synopsis: "La saga de una familia chilena a través de varias generaciones, mezclando lo político con lo sobrenatural.",
    condition: "Como nuevo",
    status: "disponible",
    isbn: "9788497592703",
    owner: currentUser,
    distance: 0,
    location: currentUser.location
  },
  {
    id: "user-3",
    title: "Crónica de una muerte anunciada",
    author: "Gabriel García Márquez",
    cover: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=600&fit=crop",
    synopsis: "Un relato sobre un asesinato que todo el pueblo sabía que iba a ocurrir pero nadie pudo evitar.",
    condition: "Usado - Buen estado",
    status: "disponible",
    isbn: "9780307475497",
    owner: currentUser,
    distance: 0,
    location: currentUser.location
  }
];

export const googleBooksSearchResults = [
  {
    isbn: "9788420412962",
    title: "Rayuela",
    author: "Julio Cortázar",
    cover: "https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=400&h=600&fit=crop",
    synopsis: "Una novela experimental que puede leerse de múltiples maneras, siguiendo a un escritor argentino en París en busca del sentido de la vida."
  },
  {
    isbn: "9780062316097",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    cover: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=600&fit=crop",
    synopsis: "Una audaz historia de la humanidad desde la Edad de Piedra hasta el siglo XXI, explorando cómo el Homo sapiens llegó a dominar el mundo."
  },
  {
    isbn: "9788498386561",
    title: "El nombre del viento",
    author: "Patrick Rothfuss",
    cover: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=600&fit=crop",
    synopsis: "La historia de Kvothe, un joven que se convierte en el mago más famoso de su tiempo, narrada por él mismo en una posada remota."
  }
];
