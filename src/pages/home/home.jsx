import { useEffect, useState, useCallback, useContext } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../../components/navbar/navbar.jsx";
import ProdutoVitrine from "../../components/produto-vitrine/produto-vitrine.jsx";
import CategoriaBarra from "../../components/categoria-barra/categoria-barra";
import { CartContext } from "../../contexts/cart-context.jsx";
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

  // Pegamos showCart para esconder a barra flutuante quando o carrinho abrir
  const { cartItems, totalCart, showCart, setShowCart } = useContext(CartContext);

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

  // Monitora o scroll para colar a barra de categorias no topo
  useEffect(() => {
    const monitorarScroll = () => {
      // Quando rola mais de 120px (passa da busca), ativa o modo topo fixo
      setRolou(window.scrollY > 120);
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

  const totalItensSacola = cartItems.reduce((acc, item) => acc + Number(item.qtd || 1), 0);

  const formatarValor = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

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
    <div className="home-container">
      <Navbar
        showMenu={true}
        valorBusca={busca}
        onPesquisar={(texto) => setBusca(texto)}
      />

      {/* Quando rola a tela, adiciona a classe 'topo' para grudar no topo */}
      <div className={rolou ? "topo" : "normal"}>
        <CategoriaBarra dados={categorias} />
      </div>

      <div className={`main-container ${totalItensSacola > 0 ? "com-sacola-flutuante" : ""}`}>
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

      {/* A BARRA FLUTUANTE DA SACOLA (SOME AUTOMATICAMENTE SE A SACOLA LATERAL ABRIR) */}
      {totalItensSacola > 0 && !showCart && (
        <div className="barra-sacola-flutuante-wrapper">
          <button
            type="button"
            className="barra-sacola-flutuante"
            onClick={() => setShowCart(true)}
          >
            <div className="sacola-info-esquerda">
              <span className="sacola-badge-qtd">{totalItensSacola}</span>
              <span className="sacola-texto-label">Ver Sacola</span>
            </div>
            <div className="sacola-info-direita">
              <span className="sacola-valor-total">{formatarValor(totalCart)}</span>
              <span className="sacola-seta">→</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default Home;