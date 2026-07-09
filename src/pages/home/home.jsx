import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../../components/navbar/navbar.jsx";
import ProdutoVitrine from "../../components/produto-vitrine/produto-vitrine.jsx";
import CategoriaBarra from "../../components/categoria-barra/categoria-barra";
import api from "../../services/api.js";
import "./home.css";

function Home() {
  const { id } = useParams();
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [rolou, setRolou] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");

  const [estaAberto, setEstaAberto] = useState(true);
  const [horarios, setHorarios] = useState({ abertura: "", fechamento: "" });

  const imagemPadrao = "https://placehold.co/300x300?text=Sem+Foto";

  const carregarDados = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErro(null);
      const [resProdutos, resCategorias] = await Promise.all([
        api.get(`/cardapio_digital/${id}`),
        api.get(`/categorias_digital/${id}`)
      ]);
      const dadosProdutos = resProdutos.data;
      setEstaAberto(dadosProdutos.esta_aberto);
      setHorarios(dadosProdutos.configuracoes || {});

      // Só exibimos produtos com estoque disponível.
      // Se "qtd" vier null/undefined, tratamos como "sem controle de estoque" (sempre disponível).
      const todosProdutos = dadosProdutos.lista_produtos || [];
      const produtosComEstoque = todosProdutos.filter(p => {
        if (p.qtd === null || p.qtd === undefined) return true;
        return Number(p.qtd) > 0;
      });

      setProdutos(produtosComEstoque);
      setCategorias(resCategorias.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados", err);
      setErro("Ops! Não conseguimos carregar o cardápio no momento.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const monitorarScroll = () => setRolou(window.scrollY > 50);
    window.addEventListener("scroll", monitorarScroll);
    return () => window.removeEventListener("scroll", monitorarScroll);
  }, []);

  useEffect(() => {
    if (id) {
      localStorage.setItem("slug", id);
      let sessionId = localStorage.getItem("session_id") || crypto.randomUUID();
      localStorage.setItem("session_id", sessionId);
      carregarDados();
    }
  }, [id, carregarDados]);

  const produtosFiltrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.descricao && p.descricao.toLowerCase().includes(busca.toLowerCase()))
  );

  const produtosPorCategoria = produtosFiltrados.reduce((acc, produto) => {
    const categoriaNome = produto.categoria || "Outros";
    if (!acc[categoriaNome]) acc[categoriaNome] = [];
    acc[categoriaNome].push(produto);
    return acc;
  }, {});

  const fmtHora = (h) => h ? h.substring(0, 5) : "";

  if (loading) {
    return (
      <div className="center-page">
        <div className="loader"></div>
        <p className="loading-text">Carregando Cardápio...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="center-page">
        <h2 className="error-title">{erro}</h2>
        <button onClick={carregarDados} className="btn-recarregar">Tentar Novamente</button>
      </div>
    );
  }

  if (!estaAberto) {
    return (
      <div className="fechado-page">
        <div className="fechado-card">
          <div className="fechado-lua">🌙</div>
          <h1>Estamos fechados</h1>
          <p className="fechado-msg">No momento não estamos recebendo pedidos.</p>
          <div className="fechado-horario-destaque">
            <span className="fechado-label">Voltamos às</span>
            <span className="fechado-hora">{fmtHora(horarios.abertura)}</span>
          </div>
          <p className="fechado-rodape">
            Funcionamos das <strong>{fmtHora(horarios.abertura)}</strong> às <strong>{fmtHora(horarios.fechamento)}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar
        showMenu={true}
        valorBusca={busca}
        onPesquisar={(texto) => setBusca(texto)}
      />
      <div className={rolou ? "topo" : ""}>
        <CategoriaBarra dados={categorias} />
      </div>
      <div className="main-container">
        {Object.entries(produtosPorCategoria).length > 0 ? (
          Object.entries(produtosPorCategoria).map(([categoria, listaProdutos]) => (
            <div key={categoria} id={categoria} className="category-section">
              <h2 className="category-title">{categoria}</h2>
              <div className="product-grid">
                {listaProdutos.map((prod) => (
                  <ProdutoVitrine
                    key={prod.id_produto}
                    id_produto={prod.id_produto}
                    nome={prod.nome}
                    preco={prod.preco}
                    foto={prod.url_foto || imagemPadrao}
                    descricao={prod.descricao}
                    estoque={prod.qtd}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="busca-vazia">
            <p>Nenhum produto encontrado para "{busca}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
