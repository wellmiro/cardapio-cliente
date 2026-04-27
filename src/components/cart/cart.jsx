import { useEffect, useContext } from "react";
import { Dock } from "react-dock";
import ProdutoCart from "../produto-cart/produto-cart.jsx";
import "./cart.css";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../../contexts/cart-context.jsx";
import back from "../../assets/back.png";

function Cart() {
    const navigate = useNavigate();
    const { cartItems, totalCart, showCart, setShowCart } = useContext(CartContext);

    // Gerencia as classes do corpo da página (para o layout não quebrar)
    useEffect(() => {
        if (showCart) {
            document.body.classList.add("cart-open");
        } else {
            document.body.classList.remove("cart-open");
        }
    }, [showCart]);

    // Ouvinte para abertura manual por eventos (opcional)
    useEffect(() => {
        const handleOpen = () => setShowCart(true);
        window.addEventListener('openSidebar', handleOpen);
        return () => window.removeEventListener('openSidebar', handleOpen);
    }, [setShowCart]);

    function checkout() {
        setShowCart(false); // Fecha antes de ir para o checkout
        navigate('/checkout');
    }

    const fecharCarrinho = () => {
        setShowCart(false);
    };

    return (
        <Dock 
            position="right"
            isVisible={showCart} // Agora ele obedece APENAS ao contexto
            fluid={false}
            size={360}
            dimMode="none"
            onVisibleChange={(visible) => {
                setShowCart(visible);
            }}
        >
            <div className="text-center">
                <img onClick={fecharCarrinho} src={back} className="cart-btn-close" alt="Fechar" style={{cursor: 'pointer'}} />
                <h1>Meu Pedido</h1>
            </div>

            <div className="lista-produtos">
                {cartItems.map((item) => (
                    <ProdutoCart 
                        key={item.id}
                        id={item.id}
                        foto={item.foto}
                        nome={item.nome}
                        qtd={item.qtd}
                        preco={item.preco} 
                        observacao={item.observacao}
                    />
                ))}
            </div>

            <div className="footer-cart">
                <div className="footer-cart-valor">
                    <span>Total</span>
                    <span><strong>{new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(totalCart)}</strong></span>
                </div>   
                <button onClick={checkout} className="btn-checkout">Finalizar Pedido</button>
            </div>
        </Dock>
    );
}

export default Cart;