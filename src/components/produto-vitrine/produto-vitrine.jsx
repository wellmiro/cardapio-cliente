
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
    const fotoProduto = props.foto || "https://placehold.co/300x300?text=Sem+Foto";
    const formatar = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    useEffect(() => {
        if (!aberto) return;
        setCarregando(true);
        fetch(`${API}/opcoes_digital/${props.id_produto}`)
            .then(r => r.json())
            .then(d => setOpcoes(Array.isArray(d) ? d : []))
            .catch(() => setOpcoes([]))
            .finally(() => setCarregando(false));
    }, [aberto, props.id_produto]);

    const alterarQtdItem = (id_opcao, item, delta, qtd_max) => {
        setSelecionados(prev => {
            const copia = { ...prev };
            const atual = copia[item.id_item] || { ...item, qtd_item: 0, id_opcao };
            let novaQtd = atual.qtd_item + delta;
            
            // Limite mínimo de -1 (para o "SEM")
            if (novaQtd < -1) novaQtd = -1;
            
            const totalNoGrupo = Object.values(copia)
                .filter(i => i.id_opcao === id_opcao && i.id_item !== item.id_item)
                .reduce((acc, i) => acc + (i.qtd_item > 0 ? i.qtd_item : 0), 0);
            
            if (delta > 0 && qtd_max && (totalNoGrupo + (novaQtd > 0 ? novaQtd : 0)) > qtd_max) return prev;
            
            if (novaQtd === 0) {
                delete copia[item.id_item];
            } else {
                copia[item.id_item] = { ...atual, qtd_item: novaQtd };
            }
            return copia;
        });
    };

    const totalAdicionais = Object.values(selecionados).reduce((acc, i) => acc + (i.qtd_item > 0 ? i.vl_item * i.qtd_item : 0), 0);
    const totalFinal = (props.preco + totalAdicionais) * qtd;

    const handleAdicionarModal = () => {
        const todos = Object.values(selecionados);
        
        // 1. Mapeia os itens removidos (q === -1)
        const removidos = todos
            .filter(i => i.qtd_item === -1)
            .map(i => `SEM ${i.nome_item.toUpperCase()}`);
        
        // 2. Mapeia os itens adicionados (q > 0)
        const adicionadosTexto = todos
            .filter(i => i.qtd_item > 0)
            .map(i => `+${i.qtd_item} ${i.nome_item.toUpperCase()}`);

        // Junta tudo para a observação do item
        let arrayStatus = [...removidos, ...adicionadosTexto];
        let textoOpcionais = arrayStatus.join(", ");
        
        let obsFinal = obs.trim();
        if (textoOpcionais) {
            obsFinal = obsFinal ? `${obsFinal} (${textoOpcionais})` : textoOpcionais;
        }

        const novoProduto = {
    id: props.id_produto,
    nome: props.nome,
    preco: props.preco + totalAdicionais,
    foto: fotoProduto,
    qtd: qtd,
    observacao: obsFinal,
    adicionais: todos.filter(i => i.qtd_item > 0).map(i => ({
        ...i,
        nome_formatado: i.qtd_item > 1 ? `${i.qtd_item}x ${i.nome_item}` : i.nome_item
    }))
};

AddItemCart(novoProduto);

setQtd(1);
setObs("");
setSelecionados({});
setAberto(false);

setTimeout(() => {
    setShowCart(true);
}, 300);

}; // fecha handleAdicionarModal

return (
        <>
            <div className="produto-box" onClick={() => setAberto(true)}>
                {qtdExibir > 0 && <div className="badge-qtd">{qtdExibir}</div>}
                <div className="produto-img-container"><img src={fotoProduto} alt={props.nome} /></div>
                <div className="produto-info">
                    <h2 className="prod-vitrine-nome">{props.nome}</h2>
                    <p className="prod-vitrine-descricao">{props.descricao}</p>
                    <div className="prod-vitrine-preco">{formatar(props.preco)}</div>
                </div>
                <button className="btn-cart"><span>Adicionar</span></button>
            </div>

            {aberto && (
                <div className="modal-overlay" onClick={() => setAberto(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-img">
                             <img src={fotoProduto} alt={props.nome} />
                             <button className="btn-modal-close" onClick={() => setAberto(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <h2 className="modal-title">{props.nome}</h2>
                            <div className="modal-price-tag">{formatar(props.preco)}</div>
                            <p className="modal-desc-long">{props.descricao}</p>
                            <div className="modal-scroll-area">
                                {carregando ? <div className="loading-txt">Carregando opcionais...</div> :
                                    opcoes.map(opt => (
                                        <div key={opt.id_opcao} className="grupo-opcionais">
                                            <div className="grupo-titulo">{opt.descricao} {opt.qtd_max_escolha > 0 && <small>(Escolha até {opt.qtd_max_escolha})</small>}</div>
                                            {opt.itens.map(item => {
                                                const q = selecionados[item.id_item]?.qtd_item || 0;
                                                return (
                                                    <div key={item.id_item} className="item-linha">
                                                        <div className="item-nome-wrapper">
                                                            <div className={`check-box-visual ${q > 0 ? 'marcado' : q < 0 ? 'retirado' : ''}`}>
                                                                {q > 0 ? "✓" : q < 0 ? "✕" : ""}
                                                            </div>
                                                            <span className={`item-nome-texto ${q < 0 ? 'texto-retirado' : ''}`}>
                                                                {q < 0 ? `SEM ${item.nome_item}` : item.nome_item}
                                                            </span>
                                                        </div>
                                                        <div className="item-controles">
                                                            {item.vl_item > 0 && q >= 0 && <span className="item-valor-adicional">+ {formatar(item.vl_item)}</span>}
                                                            <div className="seletor-mini">
                                                                <button onClick={() => alterarQtdItem(opt.id_opcao, item, -1, opt.qtd_max_escolha)}>-</button>
                                                                <span className={q < 0 ? 'num-negativo' : ''}>{q}</span>
                                                                <button onClick={() => alterarQtdItem(opt.id_opcao, item, 1, opt.qtd_max_escolha)}>+</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ))
                                }
                                <div className="obs-container">
                                    <label>Observações</label>
                                    <textarea placeholder="Ex: Tirar cebola, ponto da carne, etc..." value={obs} onChange={e => setObs(e.target.value)} />
                                </div>
                            </div>
                            <div className="modal-footer-acoes">
                                <div className="contador-produto-principal">
                                    <button onClick={() => qtd > 1 && setQtd(qtd - 1)}>-</button>
                                    <span>{qtd}</span>
                                    <button onClick={() => setQtd(qtd + 1)}>+</button>
                                </div>
                                <button className="btn-enviar-carrinho" onClick={handleAdicionarModal}>
                                    ADICIONAR • {formatar(totalFinal)}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
export default ProdutoVitrine;