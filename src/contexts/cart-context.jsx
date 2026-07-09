import { createContext, useState } from "react";

export const CartContext = createContext();

// Considera "o mesmo item" quando é o mesmo produto E tem a mesma observação
// (a observação já carrega o texto dos adicionais/opcionais escolhidos).
function mesmoItem(a, b) {
    const idA = a.id ?? a.id_produto;
    const idB = b.id ?? b.id_produto;
    if (idA !== idB) return false;
    return (a.observacao || "") === (b.observacao || "");
}

function calcularTotal(itens) {
    return itens.reduce((acc, item) => {
        const preco = Number(item.preco ?? item.valor ?? 0);
        const qtd = Number(item.qtd ?? 1);
        return acc + preco * qtd;
    }, 0);
}

export function CartProvider({ children }) {
    const [cartItems, setCartItems] = useState([]);
    const [totalCart, setTotalCart] = useState(0);
    const [showCart, setShowCart] = useState(false);

    // Adiciona um item novo, ou soma a quantidade se já existir um igual (mesmo produto + mesma observação)
    function AddItemCart(produto) {
        setCartItems(prev => {
            const qtdAdicionar = Number(produto.qtd ?? 1);
            const existente = prev.find(item => mesmoItem(item, produto));

            let novo;
            if (existente) {
                novo = prev.map(item =>
                    mesmoItem(item, produto)
                        ? { ...item, qtd: Number(item.qtd ?? 1) + qtdAdicionar }
                        : item
                );
            } else {
                novo = [...prev, { ...produto, qtd: qtdAdicionar }];
            }

            setTotalCart(calcularTotal(novo));
            return novo;
        });
    }

    // Remove 1 unidade do item (identificado por id + observação). Se chegar a 0, remove o item da lista.
    function RemoveItemCart(id, observacao) {
        setCartItems(prev => {
            const alvo = prev.find(item =>
                (item.id ?? item.id_produto) === id &&
                (item.observacao || "") === (observacao || "")
            );

            if (!alvo) return prev;

            let novo;
            if (Number(alvo.qtd ?? 1) <= 1) {
                novo = prev.filter(item => item !== alvo);
            } else {
                novo = prev.map(item =>
                    item === alvo ? { ...item, qtd: Number(item.qtd) - 1 } : item
                );
            }

            setTotalCart(calcularTotal(novo));
            return novo;
        });
    }

    return (
        <CartContext.Provider
            value={{
                cartItems,
                setCartItems,
                totalCart,
                setTotalCart,
                showCart,
                setShowCart,
                AddItemCart,
                RemoveItemCart
            }}
        >
            {children}
        </CartContext.Provider>
    );
}
