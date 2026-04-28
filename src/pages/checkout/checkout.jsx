import "./checkout.css";
import Navbar from "../../components/navbar/navbar.jsx";
import AlertModal from "../../components/alert-modal/AlertModal.jsx";
import { useContext, useState, useEffect } from "react";
import { CartContext } from "../../contexts/cart-context.jsx";
import api from "../../services/api.js";
import { useNavigate } from "react-router-dom";

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// --- CONFIGURAÇÃO DE ORIGEM ---
const ORIGEM = { lat: -24.0189, lng: -47.4988 }; // Turvo, Tapiraí
const TAXA_BASE_RURAL = 5.00; // Valor fixo só para sair da lanchonete
const PRECO_POR_KM = 2.50;    // Aumentei um pouco para compensar o terreno

function calcularFrete(lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - ORIGEM.lat) * Math.PI / 180;
    const dLon = (lon2 - ORIGEM.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(ORIGEM.lat * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    const distanciaKm = c * R; 
    
    // Arredonda SEMPRE para cima (Ex: 2.1km vira 3km)
    // Isso ajuda a compensar as curvas das estradas de terra
    const kmFinal = Math.ceil(distanciaKm);

    return TAXA_BASE_RURAL + (kmFinal * PRECO_POR_KM);
}

function MapRefresher({ center }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, 15);
        setTimeout(() => map.invalidateSize(), 300);
    }, [center, map]);
    return null;
}

export default function Checkout() {
    const { cartItems, totalCart, setCartItems, setTotalCart } = useContext(CartContext);
    const navigate = useNavigate();

    const [msgAlert, setMsgAlert] = useState("");
    const [showAlert, setShowAlert] = useState(false);
    const [tipoAlert, setTipoAlert] = useState("erro");

    const [step, setStep] = useState(1);
    const [nome, setNome] = useState("");
    const [fone, setFone] = useState("");
    const [endereco, setEndereco] = useState("");
    const [numero, setNumero] = useState("");
    const [bairro, setBairro] = useState("");
    const [cidade, setCidade] = useState("");
    const [uf, setUf] = useState("");
    const [posicao, setPosicao] = useState([ORIGEM.lat, ORIGEM.lng]);
    const [frete, setFrete] = useState(0); 

    const [pagamento, setPagamento] = useState("");
    const [tipoCartao, setTipoCartao] = useState("");
    const [dinheiro, setDinheiro] = useState("");

    const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    async function buscarEndereco(lat, lng) {
        const novoFrete = calcularFrete(lat, lng);
        setFrete(novoFrete);

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            const data = await response.json();

            if (data.address) {
                setEndereco(data.address.road || data.address.pedestrian || "");
                setBairro(data.address.suburb || data.address.neighbourhood || "");
                setCidade(data.address.city || data.address.town || "");
                
                let estado = data.address.state_code || "";
                if (!estado && data.address.state) {
                    const estados = { "São Paulo": "SP", "Rio de Janeiro": "RJ", "Minas Gerais": "MG" };
                    estado = estados[data.address.state] || data.address.state.substring(0, 2).toUpperCase();
                }
                setUf(estado.toUpperCase());
            }
        } catch (error) {
            console.error("Erro ao buscar endereço:", error);
        }
    }

    const navigateNext = () => {
        if (step === 1 && (!nome || !fone)) {
            setMsgAlert("Por favor, preencha seu nome e telefone.");
            setShowAlert(true);
            return;
        }
        if (step === 2 && (!endereco || !numero)) {
            setMsgAlert("O endereço e o número da casa são obrigatórios.");
            setShowAlert(true);
            return;
        }
        setStep(s => Math.min(s + 1, 4));
    };

    const navigateBack = () => setStep(s => Math.max(s - 1, 1));

    function finalizarPedido() {
        const slugAtual = localStorage.getItem("slug");
        const session_id = localStorage.getItem("session_id") || crypto.randomUUID();

        if (!slugAtual) {
            setTipoAlert("erro");
            setMsgAlert("Erro: Estabelecimento não encontrado.");
            setShowAlert(true);
            return;
        }

        // Validação obrigatória do número e campos de entrega
        if (!nome || !fone || !endereco || !numero) {
            setTipoAlert("erro");
            setMsgAlert("Preencha todos os campos de entrega, incluindo o número da casa.");
            setShowAlert(true);
            return;
        }

        if (!pagamento) {
            setTipoAlert("erro");
            setMsgAlert("Escolha uma forma de pagamento.");
            setShowAlert(true);
            return;
        }

        let forma_pagamento = pagamento;
        if (pagamento === "cartao") forma_pagamento = `Cartão (${tipoCartao})`;

        const payload = {
            slug: slugAtual,
            session_id,
            nome_cliente: nome,
            vl_subtotal: totalCart,
            vl_entrega: frete,
            vl_total: totalCart + frete,
            endereco_entrega: `${endereco}, ${numero} - ${bairro}, ${cidade}/${uf}`,
            forma_pagamento,
            dinheiro: pagamento === "dinheiro" ? Number(dinheiro || 0) : 0,
            troco: pagamento === "dinheiro" ? Number(dinheiro || 0) - (totalCart + frete) : 0,
            local_consumo: "DELIVERY",
            itens: cartItems.map(i => ({
                id_produto: i.id,
                qtd: i.qtd,
                vl_unitario: i.preco,
                vl_total: i.preco * i.qtd,
                obs: i.observacao,
                adicionais: i.adicionais // Enviando os adicionais para o banco
            }))
        };

        api.post("/pedidos/publico", payload)
            .then(() => {
                setTipoAlert("sucesso");
                setMsgAlert("Pedido enviado com sucesso! Bom apetite!");
                setShowAlert(true);
                setCartItems([]);
                setTotalCart(0);
                setTimeout(() => {
                    navigate(`/cardapio_digital/${slugAtual}`);
                }, 3500);
            })
            .catch(err => {
                setTipoAlert("erro");
                setMsgAlert(err?.response?.data?.error || "Erro ao enviar pedido");
                setShowAlert(true);
            });
    }

    return (
        <div className="checkout-page">
            <Navbar />

            {showAlert && (
                <AlertModal 
                    tipo={tipoAlert}
                    mensagem={msgAlert} 
                    onClose={() => setShowAlert(false)} 
                />
            )}

            <div className="checkout-wrapper">
                
                <div className="stepper">
                    <div className={`stepper-item ${step >= 1 ? "active" : ""}`}>
                        <div className={`stepper-circle ${step >= 1 ? "active" : ""}`}>1</div>
                        <span className="stepper-label">Dados</span>
                    </div>
                    <div className={`stepper-item ${step >= 2 ? "active" : ""}`}>
                        <div className={`stepper-circle ${step >= 2 ? "active" : ""}`}>2</div>
                        <span className="stepper-label">Entrega</span>
                    </div>
                    <div className={`stepper-item ${step >= 3 ? "active" : ""}`}>
                        <div className={`stepper-circle ${step >= 3 ? "active" : ""}`}>3</div>
                        <span className="stepper-label">Pagamento</span>
                    </div>
                </div>

                {step === 1 && (
                    <div className="box-checkout">
                        <h3 className="box-title">Seus Dados</h3>
                        <div className="input-group">
                            <label>Nome Completo</label>
                            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Wellington Miranda" />
                        </div>
                        <div className="input-group espacamento-top">
                            <label>WhatsApp / Telefone</label>
                            <input value={fone} onChange={e => setFone(e.target.value)} placeholder="(15) 99999-9999" />
                        </div>
                        <button className="btn-checkout espacamento-top" onClick={navigateNext}>Continuar</button>
                    </div>
                )}

                {step === 2 && (
                    <div className="box-checkout">
                        <h3 className="box-title">Onde entregamos?</h3>
                        <div className="mapa-container">
                            <MapContainer center={posicao} zoom={15} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Marker 
                                    position={posicao} 
                                    draggable={true}
                                    eventHandlers={{
                                        dragend: (e) => {
                                            const marker = e.target;
                                            const { lat, lng } = marker.getLatLng();
                                            setPosicao([lat, lng]);
                                            buscarEndereco(lat, lng);
                                        }
                                    }} 
                                />
                                <MapRefresher center={posicao} />
                            </MapContainer>
                        </div>

                        <div className="input-row">
                            <div className="input-group" style={{ flex: 4 }}>
                                <label>Rua / Logradouro</label>
                                <input value={endereco} onChange={e => setEndereco(e.target.value)} />
                            </div>
                            <div className="input-group" style={{ flex: 1 }}>
                                <label>Nº *</label>
                                <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="123" required />
                            </div>
                        </div>

                        <div className="input-group espacamento-top">
                            <label>Bairro</label>
                            <input value={bairro} onChange={e => setBairro(e.target.value)} />
                        </div>

                        <div className="input-row espacamento-top">
                            <div className="input-group" style={{ flex: 3 }}>
                                <label>Cidade</label>
                                <input value={cidade} onChange={e => setCidade(e.target.value)} />
                            </div>
                            <div className="input-group" style={{ flex: 1 }}>
                                <label>UF</label>
                                <input value={uf} onChange={e => setUf(e.target.value)} maxLength={2} />
                            </div>
                        </div>

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack}>Voltar</button>
                            <button className="btn-checkout" onClick={navigateNext}>Continuar</button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="box-checkout">
                        <h3 className="box-title">Forma de Pagamento</h3>
                        <div className="payment-selector">
                            <button className={`pay-btn ${pagamento === "pix" ? "active" : ""}`} onClick={() => setPagamento("pix")}>PIX</button>
                            <button className={`pay-btn ${pagamento === "cartao" ? "active" : ""}`} onClick={() => setPagamento("cartao")}>Cartão</button>
                            <button className={`pay-btn ${pagamento === "dinheiro" ? "active" : ""}`} onClick={() => setPagamento("dinheiro")}>Dinheiro</button>
                        </div>

                        {pagamento === "cartao" && (
                            <div className="cartao-opcoes">
                                <button className={`cartao-btn ${tipoCartao === "credito" ? "active" : ""}`} onClick={() => setTipoCartao("credito")}>Crédito</button>
                                <button className={`cartao-btn ${tipoCartao === "debito" ? "active" : ""}`} onClick={() => setTipoCartao("debito")}>Débito</button>
                            </div>
                        )}

                        {pagamento === "dinheiro" && (
                            <div className="input-group espacamento-top">
                                <label>Troco para quanto?</label>
                                <input type="number" value={dinheiro} onChange={e => setDinheiro(e.target.value)} placeholder="Ex: 50" />
                            </div>
                        )}

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack}>Voltar</button>
                            <button className="btn-checkout" onClick={navigateNext}>Revisar Pedido</button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="box-checkout">
                        <h3 className="box-title">Revisão do Pedido</h3>
                        
                        <div className="revisao-secao">
                            <p className="revisao-titulo">Itens do Pedido:</p>
                            <div className="resumo-produtos">
                                {cartItems.map((item, index) => (
                                    <div key={index} className="revisao-produto-item">
                                        <div className="revisao-produto-linha">
                                            <strong>{item.qtd}x {item.nome}</strong>
                                            <span>{formatarMoeda(item.preco * item.qtd)}</span>
                                        </div>
                                        {item.adicionais && item.adicionais.length > 0 && (
                                            <p className="revisao-adicionais">
                                                + {item.adicionais.map(ad => ad.nome_item).join(", ")}
                                            </p>
                                        )}
                                        {item.observacao && <p className="revisao-obs">Obs: {item.observacao}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="revisao-secao espacamento-top">
                            <p className="revisao-titulo">Entrega para:</p>
                            <p><strong>{nome}</strong> - {fone}</p>
                            <p style={{color: '#555'}}>{endereco}, {numero} - {bairro}, {cidade}/{uf}</p>
                        </div>

                        <div className="revisao-secao espacamento-top">
                            <p className="revisao-titulo">Pagamento:</p>
                            <p style={{textTransform: 'uppercase'}}><strong>{pagamento} {tipoCartao && `(${tipoCartao})`}</strong></p>
                            {pagamento === "dinheiro" && dinheiro && <p>Troco para: {formatarMoeda(Number(dinheiro))}</p>}
                        </div>

                        <div className="revisao-secao espacamento-top">
                            <p className="revisao-titulo">Resumo de Valores:</p>
                            <div className="revisao-item">
                                <span>Subtotal</span>
                                <span>{formatarMoeda(totalCart)}</span>
                            </div>
                            <div className="revisao-item">
                                <span>Taxa de Entrega</span>
                                <span>{formatarMoeda(frete)}</span>
                            </div>
                        </div>

                        <div className="valores-box">
                            <div className="valor-linha total">
                                <span>Total a Pagar</span>
                                <span>{formatarMoeda(totalCart + frete)}</span>
                            </div>
                        </div>

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack}>Voltar</button>
                            <button className="btn-checkout" onClick={finalizarPedido}>Finalizar e Enviar</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}