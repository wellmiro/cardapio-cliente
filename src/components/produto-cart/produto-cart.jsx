import "./produto-cart.css";
import { CartContext } from "../../contexts/cart-context";
import { useContext } from "react";

function ProdutoCart(props) {
    // Importamos as funções do contexto para manipular a sacola
    const { AddItemCart, RemoveItemCart } = useContext(CartContext);

    // Função interna para formatar os valores em Reais (R$)
    const formatar = (v) => new Intl.NumberFormat('pt-BR', { 
        style: 'currency', currency: 'BRL' 
    }).format(v);

    return (
        <div className="produto-cart-box">
            {/* Foto do produto na sacola */}
            <img src={props.foto} alt={props.nome} />

            <div style={{ flexGrow: 1 }}>
                <p className="produto-cart-nome">{props.nome}</p>
                <p className="produto-cart-valor">{formatar(props.preco)}</p>
                
                {/* Exibe a observação se o usuário tiver escrito algo */}
                {props.observacao && (
                    <div className="produto-cart-obs-exibicao">
                        <strong>Obs:</strong> {props.observacao}
                    </div>
                )}

                <div className="footer-produto-cart">
                    <div className="contador-sacola">
                        {/* Botão MENOS: Passa ID e Obs para remover corretamente e zerar a bolinha */}
                        <button 
                            onClick={() => RemoveItemCart(props.id, props.observacao)} 
                            className="footer-produto-btn"
                        >
                            -
                        </button>

                        <span className="footer-produto-qtd">{props.qtd}</span>

                        {/* Botão MAIS: Adiciona mais uma unidade do mesmo item */}
                        <button 
                            onClick={() => AddItemCart({ ...props, qtd: 1 })} 
                            className="footer-produto-btn"
                        >
                            +
                        </button>
                    </div>

                    {/* Preço total (Preço x Quantidade) */}
                    <p className="footer-produto-preco">
                        {formatar(props.preco * props.qtd)}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ProdutoCart;