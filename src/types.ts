export type State = 'MG' | 'RJ' | 'SP' | 'ES';

export type CategoryType = 'Concurso' | 'Residência' | 'Certificação' | 'Stricto Sensu';

export interface Course {
  id: string;
  nome: string;
  estado: State;
  createdAt?: any;
}

export interface Category {
  id: string;
  curso_id: string;
  tipo: CategoryType;
}

export interface Content {
  id: string;
  titulo: string;
  descricao: string;
  tipo_conteudo: 'texto' | 'link' | 'pdf';
  conteudo_texto?: string;
  link_url?: string;
  arquivo?: string; // PDF URL
  categoria_id: string;
  createdAt?: any;
}
