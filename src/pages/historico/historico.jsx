import { useEffect, useState } from "react";
import Navbar from "../../components/navbar/navbar.jsx";
import "./historico.css";
import api from "../../services/api.js";
import { useNavigate } from "react-router-dom";

function Historico() {
    const [pedidos, setPedidos] = useState([]);
    const [idExpandido, setIdExpandido] = useState(null);
    const [detalhes, setDetalhes] = useState(null);
    const [loadingDetalhes, setLoadingDetalhes] = useState(false);
    const [loadingLista, setLoadingLista] = useState(true);

    const slug = localStorage.getItem("slug");
    const sessionId = localStorage.getItem("session_id");

    const navigate = useNavigate();

    const ETAPAS = [
        { cod: "A", label: "Aguardando", icone: "🕐" },
        { cod: "P", label: "Em Produção", icone: "👨‍🍳" },
        { cod: "E", label: "Saiu para Entrega", icone: "🛵" },
        { cod: "F", label: "Entregue", icone: "✅" }
    ];

    useEffect(() => {
        if (!slug || !sessionId) {
            setLoadingLista(false);
            return;
        }

        api.get(`/pedidos/historico/${slug}/${sessionId}`)
            .then(resp => setPedidos(resp.data))
            .catch(err => console.error("Erro lista:", err))
            .finally(() => setLoadingLista(false));
    }, [slug, sessionId]);

    const handleExpandir = async (id_pedido) => {
        if (idExpandido === id_pedido) {
            setIdExpandido(null);
            return;
        }

        setIdExpandido(id_pedido);
        setLoadingDetalhes(true);
        setDetalhes(null);

        try {
            const resp = await api.get(`/pedidos/acompanhar/${id_pedido}`);
            setDetalhes(resp.data);
        } catch (err) {
            console.error("Erro detalhes:", err);
        } finally {
            setLoadingDetalhes(false);
        }
    };

    const fmt = (v) =>
        new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(v);

    // 🔥 CORREÇÃO DO BUG 1000x
    const formatQtd = (qtd) => {
        const numero = parseInt(qtd);
        if (!numero || numero <= 0) return 1;
        if (numero > 50) return 1;
        return numero;
    };

    // 🔥 LOADING ESTILO IFOOD
    if (loadingLista) {
        return (
            <div className="historico-page">
                <Navbar />

                <div className="container">
                    <div className="topo-historico">
                        <button 
                            className="btn-voltar"
                            onClick={() => navigate(`/cardapio_digital/${slug}`)}
                        >
                            ← Voltar
                        </button>

                        <h2>Meus Pedidos</h2>
                    </div>

                    <div className="loading">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton-card">
                                <div className="skeleton-line medium"></div>
                                <div className="skeleton-line small"></div>
                                <div className="skeleton-line big"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="historico-page">
            <Navbar />

            <div className="container">

                {/* 🔥 TOPO COM VOLTAR */}
                <div className="topo-historico">
                    <button 
                        className="btn-voltar"
                        onClick={() => navigate(`/cardapio_digital/${slug}`)}
                    >
                        ← Voltar
                    </button>

                    <h2>Meus Pedidos</h2>
                </div>

                {(!slug || !sessionId) && (
                    <p>Você precisa acessar pelo cardápio primeiro.</p>
                )}

                {pedidos.length === 0 && slug && sessionId && (
                    <p>Nenhum pedido encontrado.</p>
                )}

                {pedidos.map(p => (
                    <div key={p.id_pedido} className="card-pedido">
                        
                        <div
                            className="resumo-pedido"
                            onClick={() => handleExpandir(p.id_pedido)}
                        >
                            <div>
                                <strong>Pedido #{p.id_pedido}</strong>
                                <p>{p.dt_pedido} • {fmt(p.vl_total)}</p>
                            </div>

                            <button>
                                {idExpandido === p.id_pedido ? "🔼" : "🔽"}
                            </button>
                        </div>

                        {idExpandido === p.id_pedido && (
                            <div className="detalhes-container">

                                {loadingDetalhes ? (
                                    <div className="mini-loader">
                                        Buscando status...
                                    </div>
                                ) : detalhes ? (
                                    <>
                                        <hr />

                                        <div className="timeline">
                                            {ETAPAS.map((etapa, index) => {
                                                const indexAtual =
                                                    ETAPAS.findIndex(
                                                        e => e.cod === detalhes.status
                                                    );

                                                const concluida =
                                                    index <= indexAtual;

                                                return (
                                                    <div
                                                        key={etapa.cod}
                                                        className={`step ${concluida ? "active" : ""}`}
                                                    >
                                                        <span>{etapa.icone}</span>
                                                        <span>{etapa.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="itens-lista">
                                            {detalhes.itens?.map((item, i) => (
                                                <div key={i}>
                                                    {formatQtd(item.qtd)}x {item.nome_produto} - {fmt(item.vl_total)}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <p>Erro ao carregar detalhes.</p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Historico;