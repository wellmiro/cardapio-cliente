import { useEffect, useState, useRef } from "react";
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

    // Ref pra o polling saber qual card está aberto sem recriar o intervalo
    const idExpandidoRef = useRef(null);

    const INTERVALO_ATUALIZACAO_MS = 5000;

    const ETAPAS = [
        { cod: "A", label: "Aguardando", icone: "🕐" },
        { cod: "P", label: "Produção", icone: "👨‍🍳" },
        { cod: "E", label: "Entrega", icone: "🛵" },
        { cod: "F", label: "Concluído", icone: "✅" }
    ];

    // Mapeamento visual para os badges no topo dos cards
    const STATUS_MAP = {
        A: { label: "Aguardando", class: "status-A" },
        P: { label: "Produção", class: "status-P" },
        E: { label: "Entrega", class: "status-E" },
        F: { label: "Concluído", class: "status-F" },
        C: { label: "Cancelado", class: "status-C" }
    };

    // Carrega a lista e, depois, mantém atualizada (status alterado na retaguarda Delphi)
    useEffect(() => {
        if (!slug || !sessionId) {
            setLoadingLista(false);
            return;
        }

        let ativo = true;

        async function buscarLista() {
            try {
                const resp = await api.get(`/pedidos/historico/${slug}/${sessionId}`);
                if (!ativo) return;
                // só troca o state se algo mudou (evita re-render à toa)
                setPedidos(anterior =>
                    JSON.stringify(anterior) === JSON.stringify(resp.data) ? anterior : resp.data
                );
            } catch (err) {
                console.error("Erro ao listar pedidos:", err);
            }
        }

        async function buscarDetalhesAbertos() {
            const id = idExpandidoRef.current;
            if (!id) return;
            try {
                const resp = await api.get(`/pedidos/acompanhar/${id}`);
                // se o usuário abriu outro card enquanto a resposta vinha, descarta
                if (ativo && idExpandidoRef.current === id) {
                    setDetalhes(resp.data);
                }
            } catch (err) {
                console.error("Erro ao atualizar detalhes:", err);
            }
        }

        async function atualizar() {
            if (document.hidden) return; // aba em segundo plano: não gasta requisição
            await Promise.all([buscarLista(), buscarDetalhesAbertos()]);
        }

        // primeira carga (com skeleton)
        buscarLista().finally(() => {
            if (ativo) setLoadingLista(false);
        });

        const intervalo = setInterval(atualizar, INTERVALO_ATUALIZACAO_MS);
        // ao voltar pra aba, atualiza na hora
        document.addEventListener("visibilitychange", atualizar);

        return () => {
            ativo = false;
            clearInterval(intervalo);
            document.removeEventListener("visibilitychange", atualizar);
        };
    }, [slug, sessionId]);

    const handleExpandir = async (id_pedido) => {
        if (idExpandido === id_pedido) {
            idExpandidoRef.current = null;
            setIdExpandido(null);
            return;
        }

        idExpandidoRef.current = id_pedido;
        setIdExpandido(id_pedido);
        setLoadingDetalhes(true);
        setDetalhes(null);

        try {
            const resp = await api.get(`/pedidos/acompanhar/${id_pedido}`);
            if (idExpandidoRef.current === id_pedido) {
                setDetalhes(resp.data);
            }
        } catch (err) {
            console.error("Erro detalhes:", err);
        } finally {
            if (idExpandidoRef.current === id_pedido) {
                setLoadingDetalhes(false);
            }
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
                    <div className="card-pedido" style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🍔</div>
                        <p style={{ color: '#666', fontWeight: '500' }}>Você ainda não fez nenhum pedido.</p>
                        <button 
                            className="btn-voltar" 
                            style={{ margin: '20px auto', display: 'inline-block' }}
                            onClick={() => navigate(`/cardapio_digital/${slug}`)}
                        >
                            Ir para o Cardápio
                        </button>
                    </div>
                ) : (
                    pedidos.map(p => {
                        const infoStatus = STATUS_MAP[p.status] || STATUS_MAP.A;

                        return (
                            <div key={p.id_pedido} className="card-pedido">
                                <div className="resumo-pedido" onClick={() => handleExpandir(p.id_pedido)}>
                                    <div className="info-principal">
                                        <strong>Pedido #{p.id_pedido}</strong>
                                        <p>{p.dt_pedido}</p>
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span className={`badge-status ${infoStatus.class}`}>
                                            {infoStatus.label}
                                        </span>
                                        <span style={{ fontSize: '1.2rem', color: '#cbd5e0' }}>
                                            {idExpandido === p.id_pedido ? "▲" : "▼"}
                                        </span>
                                    </div>
                                </div>

                                {idExpandido === p.id_pedido && (
                                    <div className="detalhes-container">
                                        {loadingDetalhes ? (
                                            <div style={{ textAlign: 'center', padding: '30px', color: '#E84F3D' }}>
                                                <div className="mini-loader">Carregando detalhes...</div>
                                            </div>
                                        ) : detalhes ? (
                                            <>
                                                {/* CONDICIONAL: SE ESTIVER CANCELADO X LINHA DO TEMPO */}
                                                {detalhes.status === "C" ? (
                                                    <div className="cancelado-box">
                                                        <div className="cancelado-box-icone">🚫</div>
                                                        <div className="cancelado-box-titulo">Pedido Cancelado</div>
                                                        <p className="cancelado-box-sub">
                                                            Este pedido foi recusado ou cancelado pelo estabelecimento.
                                                        </p>
                                                    </div>
                                                ) : (
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
                                                )}

                                                <div className="itens-lista">
                                                    <small style={{ color: '#a0aec0', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                                        Resumo dos Itens
                                                    </small>
                                                    
                                                    {detalhes.itens?.map((item, i) => (
                                                        <div key={i} className="item-linha">
                                                            <span>
                                                                <span className="item-qtd">{formatQtd(item.qtd)}x</span> 
                                                                {item.nome_produto}
                                                            </span>
                                                            <span>{fmt(Number(item.vl_total))}</span>
                                                        </div>
                                                    ))}

                                                    <div className="resumo-valores">
                                                        <div className="valor-linha">
                                                            <span>Subtotal</span>
                                                            <span>{fmt(Number(detalhes.vl_subtotal))}</span>
                                                        </div>

                                                        <div className="valor-linha">
                                                            <span>Taxa de Entrega</span>
                                                            <span style={{
                                                                color: Number(detalhes.vl_entrega) > 0 ? '#718096' : '#38a169',
                                                                fontWeight: Number(detalhes.vl_entrega) > 0 ? '400' : 'bold'
                                                            }}>
                                                                {Number(detalhes.vl_entrega) > 0 ? fmt(Number(detalhes.vl_entrega)) : "Grátis"}
                                                            </span>
                                                        </div>

                                                        <div className="total-linha">
                                                            <span>Total do Pedido</span>
                                                            <span>{fmt(Number(detalhes.vl_total))}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #f7fafc', paddingTop: '10px' }}>
                                                    <p style={{ fontSize: '0.7rem', color: '#cbd5e0' }}>
                                                        Sessão: {sessionId?.substring(0, 12)}...
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#e53e3e' }}>
                                                Ops! Não conseguimos carregar os dados deste pedido.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default Historico;