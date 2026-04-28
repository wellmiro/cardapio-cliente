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
  const [busca, setBusca] = useState(""); // Estado para a barra de pesquisa

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

      setProdutos(resProdutos.data || []);
      setCategorias(resCategorias.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados", err);
      setErro("Ops! Não conseguimos carregar o cardápio no momento.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const monitorarScroll = () => {
      if (window.scrollY > 50) setRolou(true);
      else setRolou(false);
    };
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

  // Lógica de Filtro: Filtra produtos por nome ou descrição
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
        <button onClick={carregarDados} className="btn-recarregar">
          Tentar Novamente
        </button>
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