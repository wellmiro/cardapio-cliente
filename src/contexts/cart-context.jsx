import { createContext, useState, useEffect } from "react";

const CartContext = createContext();

function CartProvider(props) {
    const [showCart, setShowCart] = useState(false);

    // Pegamos o estabelecimento atual para criar uma chave única no localStorage
    const getCartKey = () => {
        const slugAtual = localStorage.getItem("slug") || "default";
        return `99burger:cart_${slugAtual}`;
    };

    const getTimestampKey = () => {
        const slugAtual = localStorage.getItem("slug") || "default";
        return `99burger:cart_timestamp_${slugAtual}`;
    };

    const [cartItems, setCartItems] = useState(() => {
        // Agora busca a sacola específica deste estabelecimento
        const cartKey = localStorage.getItem("slug") ? `99burger:cart_${localStorage.getItem("slug")}` : "99burger:cart_default";
        const timeKey = localStorage.getItem("slug") ? `99burger:cart_timestamp_${localStorage.getItem("slug")}` : "99burger:cart_timestamp_default";
        
        const itensSalvos = localStorage.getItem(cartKey);
        const dataSalva = localStorage.getItem(timeKey);

        if (itensSalvos && dataSalva) {
            const agora = new Date().getTime();
            const tresHoras = 3 * 60 * 60 * 1000;

            if (agora - parseInt(dataSalva) > tresHoras) {
                localStorage.removeItem(cartKey);
                localStorage.removeItem(timeKey);
                return [];
            }
            return JSON.parse(itensSalvos);
        }
        return [];
    });

    const [totalCart, setTotalCart] = useState(0);

    // Efeito para recarregar o carrinho caso o usuário mude de página/estabelecimento
    useEffect(() => {
        const cartKey = getCartKey();
        const itensSalvos = localStorage.getItem(cartKey);
        if (itensSalvos) {
            setCartItems(JSON.parse(itensSalvos));
        } else {
            setCartItems([]);
        }
    }, [window.location.pathname]); // Monitora a mudança de rota

    useEffect(() => {
        // Salva na chave única do estabelecimento atual
        const cartKey = getCartKey();
        const timeKey = getTimestampKey();
        
        localStorage.setItem(cartKey, JSON.stringify(cartItems));
        localStorage.setItem(timeKey, new Date().getTime().toString());
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
        setShowCart(true); 
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
        const cartKey = getCartKey();
        const timeKey = getTimestampKey();
        
        setCartItems([]);
        setTotalCart(0);
        localStorage.removeItem(cartKey);
        localStorage.removeItem(timeKey);
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
            setCartItems, 
            AddItemCart, 
            RemoveItemCart, 
            totalCart, 
            setTotalCart, 
            LimparCart,
            showCart,    
            setShowCart  
        }}>
            {props.children}
        </CartContext.Provider>
    );
}

export { CartContext, CartProvider };