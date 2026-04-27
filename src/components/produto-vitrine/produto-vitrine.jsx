import { useState, useContext, useEffect } from "react";
import { CartContext } from "../../contexts/cart-context";
import "./produto-vitrine.css";

const API = "https://api-99burger.onrender.com";

function ProdutoVitrine(props) {
    const [aberto, setAberto] = useState(false);
    const [qtd, setQtd] = useState(1);
    const [obs, setObs] = useState("");
    const [opcoes, setOpcoes] = useState([]);
    const [selecionados, setSelecionados] = useState({});
    const [carregando, setCarregando] = useState(false);

    const { cartItems, AddItemCart, setShowCart } = useContext(CartContext);

    const itemNoCarrinho = cartItems.find(item => item.id === props.id_produto);
    const qtdExibir = itemNoCarrinho ? itemNoCarrinho.qtd : 0;

    const imagemPadrao = "https://placehold.co/300x300?text=Sem+Foto";
    const fotoProduto = props.foto || imagemPadrao;

    const formatar = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    useEffect(() => {
        if (!aberto) return;
        setCarregando(true);
        fetch(`${API}/opcoes_digital/${props.id_produto}`)
            .then(r => r.json())
            .then(data => {
                setOpcoes(Array.isArray(data) ? data : []);
                setSelecionados({});
            })
            .catch(() => setOpcoes([]))
            .finally(() => setCarregando(false));
    }, [aberto, props.id_produto]);

    const toggleItem = (id_opcao, item, qtd_max) => {
        setSelecionados(prev => {
            const atual = prev[id_opcao] || [];
            const jatem = atual.find(i => i.id_item === item.id_item);
            if (jatem) {
                return { ...prev, [id_opcao]: atual.filter(i => i.id_item !== item.id_item) };
            } else {
                if (qtd_max && atual.length >= qtd_max) return prev;
                return { ...prev, [id_opcao]: [...atual, item] };
            }
        });
    };

    const totalAdicionais = Object.values(selecionados)
        .flat()
        .reduce((acc, i) => acc + i.vl_item, 0);

    const totalFinal = (props.preco + totalAdicionais) * qtd;

    const obrigatoriosPendentes = opcoes
        .filter(o => o.ind_obrigatorio === 'S')
        .filter(o => !selecionados[o.id_opcao] || selecionados[o.id_opcao].length === 0);

    // FUNÇÃO PARA O BOTÃO DO CARD (Adiciona direto e abre sacola)
    const handleAddDireto = (e) => {
        e.stopPropagation(); // ESSENCIAL: Impede o clique de chegar no card e abrir o modal

        AddItemCart({
            id: props.id_produto,
            nome: props.nome,
            preco: props.preco,
            foto: fotoProduto,
            qtd: 1,
            observacao: "",
            adicionais: []
        });

        if (setShowCart) setShowCart(true);
    };

    // FUNÇÃO PARA O BOTÃO DENTRO DO MODAL
    const handleAdicionarModal = () => {
        if (obrigatoriosPendentes.length > 0) {
            alert(`Selecione obrigatoriamente: ${obrigatoriosPendentes.map(o => o.descricao).join(', ')}`);
            return;
        }

        const adicionaisSelecionados = Object.values(selecionados).flat();

        AddItemCart({
            id: props.id_produto,
            nome: props.nome,
            preco: props.preco + totalAdicionais,
            foto: fotoProduto,
            qtd,
            observacao: obs,
            adicionais: adicionaisSelecionados
        });

        setAberto(false);
        setQtd(1);
        setObs("");
        setSelecionados({});

        if (setShowCart) setShowCart(true);
    };

    return (
        <>
            {/* Clicar no box do produto abre o modal */}
            <div className="produto-box" onClick={() => setAberto(true)}>
                {qtdExibir > 0 && <div className="badge-qtd">{qtdExibir}</div>}

                <div className="produto-img-container">
                    <img
                        src={fotoProduto}
                        alt={props.nome}
                        onError={(e) => { e.target.onerror = null; e.target.src = imagemPadrao; }}
                    />
                </div>

                <div className="produto-info">
                    <h2>{props.nome}</h2>
                </div>

                <div style={{ width: '100%' }}>
                    <div className="prod-vitrine-preco">{formatar(props.preco)}</div>
                    
                    {/* Botão de adicionar direto - handleAddDireto resolve o problema */}
                    <button className="btn-cart" onClick={handleAddDireto}>
                        Adicionar
                    </button>
                </div>
            </div>

            {aberto && (
                <div className="modal-overlay" onClick={() => setAberto(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <span className="modal-close" onClick={() => setAberto(false)}>&times;</span>

                        <div className="modal-img-container">
                            <img
                                src={fotoProduto}
                                className="modal-img"
                                alt={props.nome}
                                onError={(e) => { e.target.onerror = null; e.target.src = imagemPadrao; }}
                            />
                        </div>

                        <h2>{props.nome}</h2>
                        <p className="modal-descricao-texto">{props.descricao}</p>

                        {carregando && <p style={{ color: '#999', fontSize: '0.9rem' }}>Carregando opções...</p>}

                        {opcoes.map(opcao => (
                            <div key={opcao.id_opcao} className="modal-opcao-grupo">
                                <div className="modal-opcao-header">
                                    <span className="modal-opcao-titulo">{opcao.descricao}</span>
                                    {opcao.ind_obrigatorio === 'S'
                                        ? <span className="badge-obrigatorio">Obrigatório</span>
                                        : <span className="badge-opcional">Opcional</span>
                                    }
                                    {opcao.qtd_max_escolha > 1 && (
                                        <span className="modal-opcao-max">Escolha até {opcao.qtd_max_escolha}</span>
                                    )}
                                </div>

                                {opcao.itens.map(item => {
                                    const marcado = (selecionados[opcao.id_opcao] || []).some(i => i.id_item === item.id_item);
                                    return (
                                        <div
                                            key={item.id_item}
                                            className={`modal-opcao-item ${marcado ? 'marcado' : ''}`}
                                            onClick={() => toggleItem(opcao.id_opcao, item, opcao.qtd_max_escolha)}
                                        >
                                            <div className="modal-opcao-item-check">
                                                {marcado ? '✓' : ''}
                                            </div>
                                            <span className="modal-opcao-item-nome">{item.nome_item}</span>
                                            {item.vl_item > 0 && (
                                                <span className="modal-opcao-item-preco">+ {formatar(item.vl_item)}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        <div className="modal-obs-container">
                            <label>Observações</label>
                            <textarea
                                className="modal-obs"
                                placeholder="Ex: sem cebola, ponto da carne, etc..."
                                value={obs}
                                onChange={(e) => setObs(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="modal-footer">
                            <div className="contador">
                                <button className="btn-qtd" onClick={() => qtd > 1 && setQtd(qtd - 1)}>-</button>
                                <b>{qtd}</b>
                                <button className="btn-qtd" onClick={() => setQtd(qtd + 1)}>+</button>
                            </div>
                            <button className="btn-add-modal" onClick={handleAdicionarModal}>
                                Adicionar {formatar(totalFinal)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProdutoVitrine;