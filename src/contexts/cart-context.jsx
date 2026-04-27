import { createContext, useState, useEffect } from "react";

const CartContext = createContext();

function CartProvider(props) {
    const [showCart, setShowCart] = useState(false); // NOVO: Controle de visibilidade

    const [cartItems, setCartItems] = useState(() => {
        const itensSalvos = localStorage.getItem("99burger:cart");
        const dataSalva = localStorage.getItem("99burger:cart_timestamp");

        if (itensSalvos && dataSalva) {
            const agora = new Date().getTime();
            const tresHoras = 3 * 60 * 60 * 1000;

            if (agora - parseInt(dataSalva) > tresHoras) {
                localStorage.removeItem("99burger:cart");
                localStorage.removeItem("99burger:cart_timestamp");
                return [];
            }
            return JSON.parse(itensSalvos);
        }
        return [];
    });

    const [totalCart, setTotalCart] = useState(0);

    useEffect(() => {
        localStorage.setItem("99burger:cart", JSON.stringify(cartItems));
        localStorage.setItem("99burger:cart_timestamp", new Date().getTime().toString());
        CalculoTotal(cartItems);
    }, [cartItems]);

    function AddItemCart(item) {
        let cartItemsNovo = [...cartItems];
        let itemEncontrado = false;

        for (var i = 0; i < cartItemsNovo.length; i++) {
            if (cartItemsNovo[i].id === item.id && cartItemsNovo[i].observacao === item.observacao) {
                itemEncontrado = true;
                cartItemsNovo[i].qtd = cartItemsNovo[i].qtd + item.qtd;
            }
        }

        if (!itemEncontrado) {
            cartItemsNovo.push(item);
        }

        setCartItems(cartItemsNovo);
        setShowCart(true); // Abre a sacola automaticamente ao adicionar
    }

    function RemoveItemCart(id, observacao) {
        let cartItemsNovo = [...cartItems];

        cartItemsNovo = cartItemsNovo.map(item => {
            if (item.id === id && item.observacao === observacao) {
                return { ...item, qtd: item.qtd - 1 };
            }
            return item;
        });

        cartItemsNovo = cartItemsNovo.filter(item => item.qtd > 0);
        setCartItems(cartItemsNovo);
    }

    function LimparCart() {
        setCartItems([]);
        setTotalCart(0);
        localStorage.removeItem("99burger:cart");
        localStorage.removeItem("99burger:cart_timestamp");
    }

    function CalculoTotal(items) {
        let soma = 0;
        for (var i = 0; i < items.length; i++) {
            soma = soma + (items[i].preco * items[i].qtd);
        }
        setTotalCart(soma);
    }

    return (
        <CartContext.Provider value={{ 
            cartItems, 
            setCartItems, // Adicionado para o Checkout poder limpar
            AddItemCart, 
            RemoveItemCart, 
            totalCart, 
            setTotalCart, // Adicionado para o Checkout poder zerar
            LimparCart,
            showCart,    // NOVO
            setShowCart  // NOVO
        }}>
            {props.children}
        </CartContext.Provider>
    );
}

export { CartContext, CartProvider };