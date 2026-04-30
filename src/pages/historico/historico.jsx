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
        { cod: "P", label: "Produção", icone: "👨‍🍳" },
        { cod: "E", label: "Entrega", icone: "🛵" },
        { cod: "F", label: "Concluído", icone: "✅" }
    ];

    useEffect(() => {
        if (!slug || !sessionId) {
            setLoadingLista(false);
            return;
        }
        listarPedidos();
    }, [slug, sessionId]);

    const listarPedidos = () => {
        api.get(`/pedidos/historico/${slug}/${sessionId}`)
            .then(resp => setPedidos(resp.data))
            .catch(err => console.error("Erro lista:", err))
            .finally(() => setLoadingLista(false));
    }

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
        }).format(v || 0);

    const formatQtd = (qtd) => {
        const numero = parseInt(qtd);
        return isNaN(numero) || numero <= 0 ? 1 : numero;
    };

    if (loadingLista) {
        return (
            <div className="historico-page">
                <Navbar />
                <div className="container">
                    <div className="topo-historico">
                        <h2>Buscando seus pedidos...</h2>
                    </div>
                    {[1, 2, 3].map(i => <div key={i} className="skeleton-card" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="historico-page">
            <Navbar />

            <div className="container">
                <div className="topo-historico">
                    <button className="btn-voltar" onClick={() => navigate(`/cardapio_digital/${slug}`)}>
                        ← Voltar
                    </button>
                    <h2>Meus Pedidos</h2>
                </div>

                {pedidos.length === 0 ? (
                    <div className="card-pedido" style={{padding: '30px', textAlign: 'center'}}>
                        <p style={{color: '#666'}}>Você ainda não fez nenhum pedido.</p>
                    </div>
                ) : (
                    pedidos.map(p => (
                        <div key={p.id_pedido} className="card-pedido">
                            
                            {/* CABEÇALHO DO CARD */}
                            <div className="resumo-pedido" onClick={() => handleExpandir(p.id_pedido)}>
                                <div className="info-principal">
                                    <strong>Pedido #{p.id_pedido}</strong>
                                    <p>{p.dt_pedido}</p>
                                </div>
                                
                                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                                    <span className={`badge-status status-${p.status || 'A'}`}>
                                        {ETAPAS.find(e => e.cod === (p.status || 'A'))?.label}
                                    </span>
                                    <span style={{fontSize: '1.2rem'}}>{idExpandido === p.id_pedido ? "▲" : "▼"}</span>
                                </div>
                            </div>

                            {/* CORPO EXPANSÍVEL */}
                            {idExpandido === p.id_pedido && (
                                <div className="detalhes-container">
                                    {loadingDetalhes ? (
                                        <div style={{textAlign: 'center', padding: '20px', color: '#E84F3D', fontWeight: 'bold'}}>
                                            Atualizando status...
                                        </div>
                                    ) : detalhes ? (
                                        <>
                                            {/* TIMELINE */}
                                            <div className="timeline">
                                                {ETAPAS.map((etapa, index) => {
                                                    const indexAtual = ETAPAS.findIndex(e => e.cod === detalhes.status);
                                                    const concluida = index <= indexAtual;
                                                    return (
                                                        <div key={etapa.cod} className={`step ${concluida ? "active" : ""}`}>
                                                            <div className="icon-box">{etapa.icone}</div>
                                                            <span>{etapa.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* LISTA DE PRODUTOS */}
                                            <div className="itens-lista">
                                                <small style={{color: '#a0aec0', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.65rem'}}>Itens do Pedido</small>
                                                {detalhes.itens?.map((item, i) => (
                                                    <div key={i} className="item-linha">
                                                        <span><span className="item-qtd">{formatQtd(item.qtd)}x</span> {item.nome_produto}</span>
                                                        <span>{fmt(item.vl_total)}</span>
                                                    </div>
                                                ))}

                                                {/* RESUMO FINANCEIRO */}
                                                <div className="resumo-valores">
                                                    <div className="valor-linha">
                                                        <span>Subtotal</span>
                                                        <span>{fmt(detalhes.vl_total - (detalhes.vl_entrega || 0))}</span>
                                                    </div>
                                                    <div className="valor-linha">
                                                        <span>Taxa de Entrega</span>
                                                        <span>{detalhes.vl_entrega > 0 ? fmt(detalhes.vl_entrega) : "Grátis"}</span>
                                                    </div>
                                                    <div className="total-linha">
                                                        <span>Total</span>
                                                        <span>{fmt(detalhes.vl_total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <p style={{fontSize: '0.75rem', color: '#cbd5e0', marginTop: '15px', textAlign: 'center'}}>
                                                ID da Sessão: {sessionId.substring(0,8)}...
                                            </p>
                                        </>
                                    ) : (
                                        <p>Não foi possível carregar os detalhes.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Historico;