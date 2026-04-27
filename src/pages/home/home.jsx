import { useEffect, useState, useCallback } from "react"; // Adicionado useCallback
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

  const imagemPadrao = "https://placehold.co/300x300?text=Sem+Foto";

  // Função isolada para poder ser chamada pelo botão "Tentar Novamente"
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

  const produtosPorCategoria = produtos.reduce((acc, produto) => {
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
      <Navbar showMenu={true} />
      <div className={rolou ? "topo" : ""}>
        <CategoriaBarra dados={categorias} />
      </div>
      <div className="main-container">
        {Object.entries(produtosPorCategoria).map(([categoria, listaProdutos]) => (
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
        ))}
      </div>
    </div>
  );
}

export default Home;