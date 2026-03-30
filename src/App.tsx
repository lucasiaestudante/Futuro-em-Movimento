/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  MapPin, 
  Plus, 
  FileText, 
  Link as LinkIcon, 
  FileDown, 
  ChevronRight, 
  ArrowLeft,
  Settings,
  X,
  CheckCircle2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Upload,
  Layers,
  Edit2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Routes, 
  Route, 
  useNavigate, 
  useLocation,
  Navigate
} from 'react-router-dom';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  serverTimestamp,
  doc,
  getDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { db, storage, auth } from './firebase';
import { Course, Content, State, Category, CategoryType } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STATES: State[] = ['MG', 'RJ', 'SP', 'ES'];
const CATEGORY_TYPES: CategoryType[] = ['Concurso', 'Residência', 'Certificação', 'Stricto Sensu', 'Carreira e Empreendedorismo'];

// --- COMPONENTES AUXILIARES ---

/**
 * Componente de Login para Professores
 */
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (error: any) {
      console.error("Erro no login:", error);
      alert("Falha no login. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-royal/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-royal" />
          </div>
          <h2 className="text-2xl font-bold text-navy">Acesso Professor</h2>
          <p className="text-slate-500">Entre com suas credenciais para gerenciar o portal.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal outline-none transition-all"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Senha</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-navy text-white font-bold py-4 rounded-xl hover:bg-royal transition-all shadow-lg shadow-navy/10 disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// --- APLICAÇÃO PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Estados de visualização pública
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  // Dados do Firestore
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  
  // Estados de Admin
  const [adminSection, setAdminSection] = useState<'menu' | 'course' | 'category' | 'content' | 'manage'>('menu');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [editingItem, setEditingItem] = useState<{ type: 'course' | 'category' | 'content', data: any } | null>(null);

  // Form States
  const [formCourse, setFormCourse] = useState({ nome: '', estado: 'MG' as State });
  const [formCategory, setFormCategory] = useState({ curso_id: '', tipo: 'Concurso' as CategoryType });
  const [formContent, setFormContent] = useState({ 
    titulo: '', 
    descricao: '', 
    categoria_id: '', 
    tipo_conteudo: 'texto' as 'texto' | 'link' | 'pdf',
    conteudo_texto: '',
    link_url: ''
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // --- FUNÇÕES DE NAVEGAÇÃO ---

  const irParaHome = () => {
    console.log("[DEBUG] Realizando reset completo de navegação...");
    setSelectedState(null);
    setSelectedCourse(null);
    setSelectedCategory(null);
    setAdminSection('menu');
    setEditingItem(null);
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Monitorar estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Buscar cursos quando o estado é selecionado
  useEffect(() => {
    if (selectedState) fetchCoursesByState(selectedState);
  }, [selectedState]);

  // Buscar categorias quando o curso é selecionado
  useEffect(() => {
    if (selectedCourse) fetchCategoriesByCourse(selectedCourse.id);
  }, [selectedCourse]);

  // Buscar conteúdos quando a categoria é selecionada
  useEffect(() => {
    if (selectedCategory) fetchContentsByCategory(selectedCategory.id);
  }, [selectedCategory]);

  // Funções de Busca (Firestore)
  
  const fetchCoursesByState = async (state: State) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'cursos'), where('estado', '==', state));
      const snap = await getDocs(q);
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchCategoriesByCourse = async (courseId: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'categorias'), where('curso_id', '==', courseId));
      const snap = await getDocs(q);
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchContentsByCategory = async (catId: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'conteudos'), where('categoria_id', '==', catId));
      const snap = await getDocs(q);
      setContents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Content)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchAllCourses = async () => {
    const snap = await getDocs(collection(db, 'cursos'));
    setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
  };

  const fetchAllCategories = async () => {
    const snap = await getDocs(collection(db, 'categorias'));
    setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
  };

  const fetchAllContents = async () => {
    const snap = await getDocs(collection(db, 'conteudos'));
    setContents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Content)));
  };

  // Funções de Escrita (Admin)

  const carregarDados = async () => {
    console.log("[DEBUG] Recarregando dados do Firestore...");
    await Promise.all([
      fetchAllCourses(),
      fetchAllCategories(),
      fetchAllContents()
    ]);
  };

  const excluirItem = async (colecao: string, id: string) => {
    console.log("Excluindo:", colecao, id);
    
    if (!auth.currentUser) {
      console.error("[ERRO] Usuário não autenticado.");
      alert("Você precisa estar logado para excluir.");
      return;
    }
    
    setLoading(true);
    try {
      const refDoc = doc(db, colecao, id);
      await deleteDoc(refDoc);
      console.log("Item excluído com sucesso");
      
      const elemento = document.getElementById("item-" + id);
      if (elemento) {
        elemento.remove();
      }
      
    } catch (erro: any) {
      console.error("Erro ao excluir:", erro);
      alert("Erro ao excluir item");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setLoading(true);
    try {
      const { type, data } = editingItem;
      const docRef = doc(db, type === 'course' ? 'cursos' : type === 'category' ? 'categorias' : 'conteudos', data.id);
      
      const updateData = { ...data };
      delete updateData.id; // Não atualizar o ID

      await updateDoc(docRef, updateData);
      setEditingItem(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      await carregarDados();
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar item.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourse.nome) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'cursos'), { ...formCourse, createdAt: serverTimestamp() });
      setFormCourse({ nome: '', estado: 'MG' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await carregarDados();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategory.curso_id) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'categorias'), { ...formCategory });
      setFormCategory({ curso_id: '', tipo: 'Concurso' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await carregarDados();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.titulo || !formContent.categoria_id) return;
    setLoading(true);
    try {
      let arquivoUrl = '';
      if (formContent.tipo_conteudo === 'pdf' && pdfFile) {
        const storageRef = ref(storage, `pdfs/${Date.now()}_${pdfFile.name}`);
        const snapshot = await uploadBytes(storageRef, pdfFile);
        arquivoUrl = await getDownloadURL(snapshot.ref);
      }
      
      await addDoc(collection(db, 'conteudos'), { 
        ...formContent, 
        arquivo: arquivoUrl,
        createdAt: serverTimestamp() 
      });
      
      setFormContent({ 
        titulo: '', 
        descricao: '', 
        categoria_id: '', 
        tipo_conteudo: 'texto',
        conteudo_texto: '',
        link_url: ''
      });
      setPdfFile(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await carregarDados();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  // --- RENDERIZADORES ---

  const renderHome = () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center justify-center p-3 bg-royal/10 rounded-2xl mb-4"
        >
          <GraduationCap className="w-10 h-10 text-royal" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold text-navy mb-2 uppercase tracking-tight"
        >
          Futuro em Movimento
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-medium text-slate-500 mb-6"
        >
          De aluno a profissional
        </motion.p>
        <p className="text-slate-600 text-lg">Selecione seu estado para acessar os materiais exclusivos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {STATES.map((state, index) => (
          <motion.button
            key={state}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => {
              setSelectedState(state);
              setSelectedCourse(null);
              setSelectedCategory(null);
            }}
            className="group relative overflow-hidden bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all border border-slate-100 text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-royal uppercase tracking-widest mb-1 block">Estado</span>
                <h3 className="text-3xl font-bold text-navy">{state}</h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-royal group-hover:text-white transition-colors">
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-0 bg-royal group-hover:w-full transition-all duration-500" />
          </motion.button>
        ))}
      </div>
    </div>
  );

  const renderCourses = () => (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button onClick={irParaHome} className="flex items-center text-slate-500 hover:text-navy mb-8 font-medium">
        <ArrowLeft className="w-5 h-5 mr-2" /> Voltar para Estados
      </button>
      <h2 className="text-3xl font-bold text-navy mb-8">Setores em {selectedState}</h2>
      
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-royal"></div></div>
      ) : courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <motion.div
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-100 group"
            >
              <div className="p-3 bg-royal/5 rounded-xl group-hover:bg-royal/10 transition-colors mb-4 w-fit">
                <BookOpen className="w-6 h-6 text-royal" />
              </div>
              <h3 className="text-xl font-bold text-navy mb-2 group-hover:text-royal transition-colors">{course.nome}</h3>
              <div className="flex items-center text-slate-400 text-sm"><MapPin className="w-4 h-4 mr-1" /> {course.estado}</div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">Nenhum setor encontrado.</div>
      )}
    </div>
  );

  const renderCategories = () => (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button onClick={() => setSelectedCourse(null)} className="flex items-center text-slate-500 hover:text-navy mb-8 font-medium">
        <ArrowLeft className="w-5 h-5 mr-2" /> Voltar para Setores
      </button>
      <h2 className="text-3xl font-bold text-navy mb-2">{selectedCourse?.nome}</h2>
      <p className="text-slate-500 mb-8">Selecione uma categoria para ver os conteúdos.</p>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-royal"></div></div>
      ) : categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat)}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-royal/30 hover:shadow-md transition-all text-left group"
            >
              <div className="p-2 bg-slate-50 rounded-lg mb-3 group-hover:bg-royal/10 transition-colors w-fit">
                <Layers className="w-5 h-5 text-slate-400 group-hover:text-royal" />
              </div>
              <span className="font-bold text-navy">{cat.tipo}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">Nenhuma categoria cadastrada para este setor.</div>
      )}
    </div>
  );

  const renderContents = () => (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button onClick={() => setSelectedCategory(null)} className="flex items-center text-slate-500 hover:text-navy mb-8 font-medium">
        <ArrowLeft className="w-5 h-5 mr-2" /> Voltar para Categorias
      </button>
      <div className="flex items-center gap-3 mb-8">
        <div className="h-8 w-1.5 bg-royal rounded-full" />
        <h2 className="text-3xl font-bold text-navy">{selectedCategory?.tipo}</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-royal"></div></div>
      ) : contents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {contents.map((content) => (
            <div key={content.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-2xl",
                  content.tipo_conteudo === 'pdf' ? "bg-emerald-50 text-emerald-500" :
                  content.tipo_conteudo === 'link' ? "bg-blue-50 text-blue-500" :
                  "bg-indigo-50 text-indigo-500"
                )}>
                  {content.tipo_conteudo === 'pdf' ? <FileText className="w-6 h-6" /> :
                   content.tipo_conteudo === 'link' ? <LinkIcon className="w-6 h-6" /> :
                   <FileText className="w-6 h-6" />}
                </div>
                
                {content.tipo_conteudo === 'pdf' && content.arquivo && (
                  <a 
                    href={content.arquivo} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-royal text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-navy transition-all shadow-lg shadow-royal/20"
                  >
                    <FileDown className="w-4 h-4" /> Abrir PDF
                  </a>
                )}

                {content.tipo_conteudo === 'link' && content.link_url && (
                  <a 
                    href={content.link_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-royal text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-navy transition-all shadow-lg shadow-royal/20"
                  >
                    <LinkIcon className="w-4 h-4" /> Acessar Link
                  </a>
                )}
              </div>
              <h4 className="text-xl font-bold text-navy mb-2">{content.titulo}</h4>
              <p className="text-slate-600 leading-relaxed mb-4">{content.descricao}</p>
              
              {content.tipo_conteudo === 'texto' && content.conteudo_texto && (
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-slate-700 whitespace-pre-wrap border border-slate-100">
                  {content.conteudo_texto}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">Nenhum conteúdo cadastrado nesta categoria.</div>
      )}
    </div>
  );

  const renderAdmin = () => (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-3xl font-bold text-navy">Painel do Professor</h2>
          <p className="text-slate-500">Gerencie a estrutura educacional do portal.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setAdminSection('menu')} className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-navy transition-colors">
            <LayoutDashboard className="w-6 h-6" />
          </button>
          <button onClick={handleLogout} className="p-3 bg-red-50 rounded-xl shadow-sm border border-red-100 text-red-400 hover:text-red-600 transition-colors">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {adminSection === 'menu' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { id: 'course', label: 'Criar Setor', icon: Plus, color: 'bg-royal' },
              { id: 'category', label: 'Criar Categoria', icon: Layers, color: 'bg-indigo-500' },
              { id: 'content', label: 'Adicionar Conteúdo', icon: FileText, color: 'bg-emerald-500' },
              { id: 'manage', label: 'Gerenciar Conteúdos', icon: Settings, color: 'bg-slate-700' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setAdminSection(item.id as any);
                  if (item.id === 'category' || item.id === 'content' || item.id === 'manage') {
                    fetchAllCourses();
                    if (item.id === 'content' || item.id === 'manage') fetchAllCategories();
                    if (item.id === 'manage') fetchAllContents();
                  }
                }}
                className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all border border-slate-100 text-center"
              >
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg transition-transform group-hover:scale-110", item.color)}>
                <item.icon className="w-8 h-8" />
              </div>
              <span className="font-bold text-navy text-lg">{item.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-2xl mx-auto">
          <button onClick={() => setAdminSection('menu')} className="flex items-center text-slate-400 hover:text-navy mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Menu
          </button>

          {adminSection === 'course' && (
            <form onSubmit={handleCreateCourse} className="space-y-6">
              <h3 className="text-xl font-bold text-navy mb-4">Novo Setor</h3>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Nome do Setor</label>
                <input type="text" required value={formCourse.nome} onChange={e => setFormCourse({...formCourse, nome: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal" placeholder="Ex: Mentoria Medicina" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Estado</label>
                <select value={formCourse.estado} onChange={e => setFormCourse({...formCourse, estado: e.target.value as State})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal">
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button disabled={loading} className="w-full bg-navy text-white font-bold py-4 rounded-xl hover:bg-royal transition-all disabled:opacity-50">
                {loading ? "Salvando..." : success ? "Setor Criado!" : "Salvar Setor"}
              </button>
            </form>
          )}

          {adminSection === 'category' && (
            <form onSubmit={handleCreateCategory} className="space-y-6">
              <h3 className="text-xl font-bold text-navy mb-4">Nova Categoria</h3>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Selecionar Setor</label>
                <select required value={formCategory.curso_id} onChange={e => setFormCategory({...formCategory, curso_id: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal">
                  <option value="">Selecione um setor...</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.estado})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Tipo de Categoria</label>
                <select value={formCategory.tipo} onChange={e => setFormCategory({...formCategory, tipo: e.target.value as CategoryType})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal">
                  {CATEGORY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button disabled={loading} className="w-full bg-navy text-white font-bold py-4 rounded-xl hover:bg-royal transition-all disabled:opacity-50">
                {loading ? "Salvando..." : success ? "Categoria Criada!" : "Salvar Categoria"}
              </button>
            </form>
          )}

          {adminSection === 'content' && (
            <form onSubmit={handleCreateContent} className="space-y-6">
              <h3 className="text-xl font-bold text-navy mb-4">Novo Conteúdo</h3>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Categoria Destino</label>
                <select required value={formContent.categoria_id} onChange={e => setFormContent({...formContent, categoria_id: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal">
                  <option value="">Selecione uma categoria...</option>
                  {categories.map(cat => {
                    const course = courses.find(c => c.id === cat.curso_id);
                    return <option key={cat.id} value={cat.id}>{cat.tipo} - {course?.nome} ({course?.estado})</option>
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Título</label>
                <input type="text" required value={formContent.titulo} onChange={e => setFormContent({...formContent, titulo: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal" placeholder="Título do material" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Descrição</label>
                <textarea rows={2} required value={formContent.descricao} onChange={e => setFormContent({...formContent, descricao: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal" placeholder="Breve descrição do conteúdo..." />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Tipo de Conteúdo</label>
                <div className="flex gap-4">
                  {['texto', 'link', 'pdf'].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="tipo_conteudo" 
                        value={type} 
                        checked={formContent.tipo_conteudo === type}
                        onChange={() => setFormContent({...formContent, tipo_conteudo: type as any})}
                        className="w-4 h-4 text-royal"
                      />
                      <span className="text-sm font-medium text-slate-600 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formContent.tipo_conteudo === 'texto' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Texto do Conteúdo</label>
                  <textarea rows={6} required value={formContent.conteudo_texto} onChange={e => setFormContent({...formContent, conteudo_texto: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal" placeholder="Escreva o texto aqui..." />
                </div>
              )}

              {formContent.tipo_conteudo === 'link' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">URL do Link</label>
                  <input type="url" required value={formContent.link_url} onChange={e => setFormContent({...formContent, link_url: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal" placeholder="https://exemplo.com" />
                </div>
              )}

              {formContent.tipo_conteudo === 'pdf' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Arquivo PDF</label>
                  <input type="file" required accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} className="w-full px-4 py-3 rounded-xl border border-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-royal/10 file:text-royal" />
                </div>
              )}

              <button disabled={loading} className="w-full bg-navy text-white font-bold py-4 rounded-xl hover:bg-royal transition-all disabled:opacity-50">
                {loading ? "Salvando..." : success ? "Conteúdo Salvo!" : "Salvar Conteúdo"}
              </button>
            </form>
          )}
          {adminSection === 'manage' && !editingItem && (
            <div className="space-y-10">
              <h3 className="text-2xl font-bold text-navy border-b pb-4">Gerenciar Conteúdos</h3>
              
              {/* Lista de Setores */}
              <section>
                <h4 className="text-lg font-bold text-slate-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-royal" /> Setores
                </h4>
                <div className="space-y-3">
                  {courses.map(course => (
                    <div key={course.id} id={`item-${course.id}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="font-bold text-navy">{course.nome}</p>
                        <p className="text-sm text-slate-500">{course.estado}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingItem({ type: 'course', data: { ...course } })}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => excluirItem('cursos', course.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Lista de Categorias */}
              <section>
                <h4 className="text-lg font-bold text-slate-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-500" /> Categorias
                </h4>
                <div className="space-y-3">
                  {categories.map(cat => {
                    const course = courses.find(c => c.id === cat.curso_id);
                    return (
                      <div key={cat.id} id={`item-${cat.id}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="font-bold text-navy">{cat.tipo}</p>
                          <p className="text-sm text-slate-500">Setor: {course?.nome || 'N/A'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingItem({ type: 'category', data: { ...cat } })}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => excluirItem('categorias', cat.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Lista de Conteúdos */}
              <section>
                <h4 className="text-lg font-bold text-slate-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" /> Conteúdos
                </h4>
                <div className="space-y-3">
                  {contents.map(content => {
                    const cat = categories.find(c => c.id === content.categoria_id);
                    return (
                      <div key={content.id} id={`item-${content.id}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="max-w-[70%]">
                          <p className="font-bold text-navy truncate">{content.titulo}</p>
                          <p className="text-sm text-slate-500 truncate">{content.descricao}</p>
                          <p className="text-xs text-royal mt-1">Cat: {cat?.tipo || 'N/A'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingItem({ type: 'content', data: { ...content } })}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => excluirItem('conteudos', content.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* Formulários de Edição */}
          {editingItem && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-navy">Editar {editingItem.type === 'course' ? 'Setor' : editingItem.type === 'category' ? 'Categoria' : 'Conteúdo'}</h3>
                <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-navy">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-6">
                {editingItem.type === 'course' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Nome do Setor</label>
                      <input 
                        type="text" 
                        required 
                        value={editingItem.data.nome} 
                        onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, nome: e.target.value}})} 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Estado</label>
                      <select 
                        value={editingItem.data.estado} 
                        onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, estado: e.target.value as State}})} 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal"
                      >
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {editingItem.type === 'category' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Tipo de Categoria</label>
                      <select 
                        value={editingItem.data.tipo} 
                        onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, tipo: e.target.value as CategoryType}})} 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal"
                      >
                        {CATEGORY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {editingItem.type === 'content' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Título</label>
                      <input 
                        type="text" 
                        required 
                        value={editingItem.data.titulo} 
                        onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, titulo: e.target.value}})} 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Descrição</label>
                      <textarea 
                        rows={3} 
                        required 
                        value={editingItem.data.descricao} 
                        onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, descricao: e.target.value}})} 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-royal" 
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={loading} 
                    className="flex-1 bg-navy text-white font-bold py-4 rounded-xl hover:bg-royal transition-all disabled:opacity-50"
                  >
                    {loading ? "Salvando..." : success ? "Atualizado!" : "Salvar Alterações"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-royal"></div></div>;

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50/50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={irParaHome}>
            <div className="w-10 h-10 bg-navy rounded-xl flex items-center justify-center group-hover:bg-royal transition-colors">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-navy tracking-tight">Futuro em <span className="text-royal">Movimento</span></span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <button onClick={() => navigate('/admin')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-royal text-white shadow-lg shadow-royal/20">
                <LayoutDashboard className="w-4 h-4" /> Painel Admin
              </button>
            ) : (
              <button onClick={() => navigate('/login')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all">
                <Settings className="w-4 h-4" /> Acesso Professor
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {!selectedState && renderHome()}
                {selectedState && !selectedCourse && renderCourses()}
                {selectedCourse && !selectedCategory && renderCategories()}
                {selectedCategory && renderContents()}
              </motion.div>
            </AnimatePresence>
          } />
          
          <Route path="/login" element={user ? <Navigate to="/admin" /> : <Login />} />
          
          <Route path="/admin" element={
            user ? renderAdmin() : <Navigate to="/login" />
          } />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-4 text-center">
          <p className="text-slate-400 text-sm font-medium">© 2024 Futuro em Movimento. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
