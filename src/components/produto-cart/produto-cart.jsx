import "./produto-cart.css";
import { CartContext } from "../../contexts/cart-context";
import { useContext } from "react";

function ProdutoCart(props) {
    const { AddItemCart, RemoveItemCart } = useContext(CartContext);

    const preco = Number(props.preco ?? props.valor ?? 0);
    const qtd = Number(props.qtd ?? 1);
    const idProduto = props.id ?? props.id_produto;

    const formatar = (v) => new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(v || 0));

    function adicionarMaisUm() {
        AddItemCart({
            ...props,
            id: idProduto,
            id_produto: idProduto,
            preco,
            valor: preco,
            qtd: 1
        });
    }

    function removerUm() {
        RemoveItemCart(idProduto, props.observacao);
    }

    return (
        <div className="produto-cart-box">
            <img
                src={props.foto || "https://placehold.co/80x80?text=Produto"}
                alt={props.nome || "Produto"}
            />

            <div style={{ flexGrow: 1 }}>
                <p className="produto-cart-nome">{props.nome}</p>
                <p className="produto-cart-valor">{formatar(preco)}</p>

                {props.observacao && (
                    <div className="produto-cart-obs-exibicao">
                        <strong>Obs:</strong> {props.observacao}
                    </div>
                )}

                {props.adicionais && props.adicionais.length > 0 && (
                    <div className="produto-cart-obs-exibicao">
                        <strong>Adicionais:</strong>{" "}
                        {props.adicionais
                            .map(item => item.nome_formatado || item.nome_item)
                            .filter(Boolean)
                            .join(", ")}
                    </div>
                )}

                <div className="footer-produto-cart">
                    <div className="contador-sacola">
                        <button
                            onClick={removerUm}
                            className="footer-produto-btn"
                            type="button"
                        >
                            -
                        </button>

                        <span className="footer-produto-qtd">{qtd}</span>

                        <button
                            onClick={adicionarMaisUm}
                            className="footer-produto-btn"
                            type="button"
                        >
                            +
                        </button>
                    </div>

                    <p className="footer-produto-preco">
                        {formatar(preco * qtd)}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ProdutoCart;