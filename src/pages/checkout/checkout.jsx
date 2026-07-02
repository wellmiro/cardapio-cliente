import "./checkout.css";
import Navbar from "../../components/navbar/navbar.jsx";
import AlertModal from "../../components/alert-modal/AlertModal.jsx";
import { useEffect, useState, useContext } from "react";
import { CartContext } from "../../contexts/cart-context.jsx";
import api from "../../services/api.js";
import { useNavigate } from "react-router-dom";

import { MapContainer, TileLayer, Marker, useMap, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// =========================================================================
// Funções Utilitárias (Fora do Componente - OK)
// =========================================================================
function calcularFrete(lat2, lon2, latOrigem, lngOrigem, vTaxaBase, vPrecoKm) {
    const R = 6371; // Raio da Terra em KM
    const dLat = (lat2 - latOrigem) * Math.PI / 180;
    const dLon = (lon2 - lngOrigem) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(latOrigem * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const km = Math.ceil(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R);
    
    // Agora a conta usa o que veio do seu banco de dados!
    return vTaxaBase + (km * vPrecoKm);
}

function parsearLocalizacao(texto) {
    const t = texto.trim();
    
    // 1. Tenta o formato do Google Maps
    const googleRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)|[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const gm = t.match(googleRegex);
    if (gm) {
        const lat = parseFloat(gm[1] || gm[3]);
        const lng = parseFloat(gm[2] || gm[4]);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    // 2. Tenta coordenadas diretas (aceita ponto ou vírgula)
    const coordRegex = /(-?\d{1,3}[.,]\d+)[,\s]+(-?\d{1,3}[.,]\d+)/;
    const cm = t.match(coordRegex);
    if (cm) {
        const lat = parseFloat(cm[1].replace(',', '.'));
        const lng = parseFloat(cm[2].replace(',', '.'));
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }

    // 3. Tenta o formato Apple Maps (aceita ponto ou vírgula)
    const appleRegex = /ll=(-?\d+[.,]\d+),(-?\d+[.,]\d+)/;
    const am = t.match(appleRegex);
    if (am) {
        return { 
            lat: parseFloat(am[1].replace(',', '.')), 
            lng: parseFloat(am[2].replace(',', '.')) 
        };
    }

    return null; 
}

function MapRefresher({ center }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, 15);
        setTimeout(() => map.invalidateSize(), 300);
    }, [center, map]);
    return null;
}

function ModalSucesso({ onClose }) {
    return (
        <div className="modal-sucesso" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <span className="check">🎉</span>
                <h3>Pedido Enviado!</h3>
                <p>Em breve o restaurante começará a preparar!</p>
                <button className="btn-checkout" style={{ marginTop: 18 }} onClick={onClose}>
                    Ver meus pedidos
                </button>
            </div>
        </div>
    );
}

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function Checkout() {
    // Hooks do Contexto e Navegação
    const { cartItems, totalCart, setCartItems, setTotalCart } = useContext(CartContext);
    const navigate = useNavigate();

    // ESTADOS DINÂMICOS DO ESTABELECIMENTO (Movidos para dentro do componente!)
    const [origem, setOrigem] = useState({ lat: -23.8204002, lng: -47.7118912 }); 
    const [precoPorKm, setPrecoPorKm] = useState(1.00); 
    const [taxaBase, setTaxaBase] = useState(5.00);

    // Estados de Controle de UI
    const [msgAlert, setMsgAlert] = useState("");
    const [showAlert, setShowAlert] = useState(false);
    const [tipoAlert, setTipoAlert] = useState("erro");
    const [showSucesso, setShowSucesso] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [step, setStep] = useState(1);

    // Step 1 - Dados Pessoais
    const [nome, setNome] = useState("");
    const [fone, setFone] = useState("");

    // Step 2 — Localização e Endereço
    const [posicao, setPosicao] = useState([-23.8204002, -47.7118912]); // Inicializado com Pilar do Sul seguro
    const [coordenadasConfirmadas, setCoordenadasConfirmadas] = useState(false);
    const [frete, setFrete] = useState(0); // Voltou a ser um estado estável
    const [cep, setCep] = useState("");
    const [cepStatus, setCepStatus] = useState(""); 
    const [locInput, setLocInput] = useState("");
    const [locStatus, setLocStatus] = useState("");

    const [endereco, setEndereco] = useState("");
    const [numero, setNumero] = useState("");
    const [complemento, setComplemento] = useState("");
    const [bairro, setBairro] = useState("");
    const [cidade, setCidade] = useState("");
    const [uf, setUf] = useState("");
    const [referencia, setReferencia] = useState("");

    // Step 3 - Pagamento
    const [pagamento, setPagamento] = useState("");
    const [tipoCartao, setTipoCartao] = useState("");
    const [dinheiro, setDinheiro] = useState("");

    // EFFECT PARA CARREGAR CONFIGURAÇÕES (Movido para dentro do componente!)
    useEffect(() => {
        async function carregarConfiguracoesRestaurante() {
            const slugAtual = localStorage.getItem("slug");
            if (!slugAtual) return;

            try {
                const res = await api.get(`/cardapio_digital/${slugAtual}`);
                const dados = res.data;

                if (dados.configuracoes) {
                    if (dados.configuracoes.latitude && dados.configuracoes.longitude) {
                        const latLng = {
                            lat: parseFloat(dados.configuracoes.latitude),
                            lng: parseFloat(dados.configuracoes.longitude)
                        };
                        setOrigem(latLng);
                        setPosicao([latLng.lat, latLng.lng]); // Ajusta o mapa para o centro da cidade do restaurante
                    }
                    if (dados.configuracoes.preco_km) {
                        setPrecoPorKm(parseFloat(dados.configuracoes.preco_km));
                    }
                    if (dados.configuracoes.taxa_base) {
                        setTaxaBase(parseFloat(dados.configuracoes.taxa_base));
                    }
                }
            } catch (err) {
                console.error("Erro ao carregar configurações dinâmicas de frete", err);
            }
        }
        carregarConfiguracoesRestaurante();
    }, []);

    const alerta = (msg, tipo = "erro") => { 
        setMsgAlert(msg); 
        setTipoAlert(tipo); 
        setShowAlert(true); 
    };

    async function aplicarCoordenadas(lat, lng) {
        setPosicao([lat, lng]);
        setCoordenadasConfirmadas(true);
        
        // Passando todas as variáveis necessárias para a conta fechar certo com o BD:
        setFrete(calcularFrete(lat, lng, origem.lat, origem.lng, taxaBase, precoPorKm));

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            if (data.address) {
                if (!endereco) setEndereco(data.address.road || data.address.pedestrian || "");
                if (!bairro) setBairro(data.address.suburb || data.address.neighbourhood || "");
                if (!cidade) setCidade(data.address.city || data.address.town || data.address.village || "");
                if (!uf) {
                    let estado = data.address.state_code || "";
                    if (!estado && data.address.state) {
                        const statesMap = { "São Paulo": "SP", "Rio de Janeiro": "RJ", "Minas Gerais": "MG", "Paraná": "PR" };
                        estado = statesMap[data.address.state] || data.address.state.substring(0, 2).toUpperCase();
                    }
                    setUf(estado.toUpperCase());
                }
            }
        } catch (e) { console.error("Erro reverse geocode", e); }
    }

    async function handleCep(e) {
        const v = e.target.value.replace(/\D/g, "");
        setCep(v);
        setCepStatus("");
        if (v.length < 8) return;

        setCepStatus("buscando");
        try {
            const res = await fetch(`https://viacep.com.br/ws/${v}/json/`);
            const data = await res.json();
            if (data.erro) throw new Error("CEP não encontrado");

            setEndereco(data.logradouro || "");
            setBairro(data.bairro || "");
            setCidade(data.localidade || "");
            setUf(data.uf || "");
            setCepStatus("ok");

            const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent((data.logradouro || "") + ", " + data.localidade)}`);
            const geoData = await geo.json();
            if (geoData.length > 0) {
                const lat = parseFloat(geoData[0].lat);
                const lng = parseFloat(geoData[0].lon);
                await aplicarCoordenadas(lat, lng);
            } else {
                setCoordenadasConfirmadas(false);
            }
        } catch {
            setCepStatus("erro");
        }
    }

    async function handleLocInput(e) {
        const v = e.target.value;
        setLocInput(v);
        setLocStatus("");
        if (!v.trim()) return;

        const coords = parsearLocalizacao(v);
        if (coords) {
            setLocStatus("ok");
            await aplicarCoordenadas(coords.lat, coords.lng);
        } else {
            setLocStatus("erro");
        }
    }

    // Validações por Step
    function validarStep1() {
        if (!nome.trim()) { alerta("Por favor, informe seu nome."); return false; }
        if (!fone.trim()) { alerta("Por favor, informe seu WhatsApp."); return false; }
        return true;
    }

    // ... (restante das validações e do retorno visual permanece idêntico e correto) ...
    function validarStep2() {
        if (!coordenadasConfirmadas) {
            alerta("Confirme sua localização pelo mapa, CEP ou colando o link.");
            return false;
        }
        if (!numero.trim()) { alerta("O número da casa é obrigatório."); return false; }
        if (!referencia.trim()) { alerta("Informe um ponto de referência para o entregador."); return false; }
        return true;
    }

    function validarStep3() {
        if (!pagamento) { alerta("Escolha uma forma de pagamento."); return false; }
        if (pagamento === "cartao" && !tipoCartao) { alerta("Selecione Crédito ou Débito."); return false; }
        if (pagamento === "dinheiro") {
            if (!dinheiro) { alerta("Informe o valor para o troco."); return false; }
            if (Number(dinheiro) < totalCart + frete) { alerta("O valor para troco é menor que o total."); return false; }
        }
        return true;
    }

    const navigateNext = () => {
        if (step === 1 && !validarStep1()) return;
        if (step === 2 && !validarStep2()) return;
        if (step === 3 && !validarStep3()) return;
        setStep(s => Math.min(s + 1, 4));
    };

    const navigateBack = () => setStep(s => Math.max(s - 1, 1));

    async function finalizarPedido() {
        const slugAtual = localStorage.getItem("slug");
        const session_id = localStorage.getItem("session_id") || crypto.randomUUID();
        if (!slugAtual) { alerta("Erro: Estabelecimento não encontrado."); return; }

        setEnviando(true);
        try {
            let forma_pagamento = pagamento;
            if (pagamento === "cartao") forma_pagamento = `Cartão (${tipoCartao})`;

            const enderecoCompleto = [endereco, numero, complemento, bairro, cidade && `${cidade}/${uf}`]
                .filter(Boolean).join(", ");

            const payload = {
                slug: slugAtual,
                session_id,
                nome_cliente: nome,
                fone_cliente: fone,
                vl_subtotal: totalCart,
                vl_entrega: frete,
                vl_total: totalCart + frete,
                endereco_entrega: enderecoCompleto + (referencia ? ` | Ref: ${referencia}` : ""),
                rota: `https://www.google.com/maps?q=${posicao[0]},${posicao[1]}`,
                forma_pagamento,
                dinheiro: pagamento === "dinheiro" ? Number(dinheiro) : 0,
                troco: pagamento === "dinheiro" ? Number(dinheiro) - (totalCart + frete) : 0,
                local_consumo: "DELIVERY",
                itens: cartItems.map(i => ({
                    id_produto: i.id,
                    qtd: i.qtd,
                    vl_unitario: i.preco,
                    vl_total: i.preco * i.qtd,
                    obs: i.observacao,
                    adicionais: i.adicionais
                }))
            };

            await api.post("/pedidos/publico", payload);
            setCartItems([]);
            setTotalCart(0);
            setShowSucesso(true);
        } catch (err) {
            alerta(err?.response?.data?.error || "Erro ao enviar pedido. Tente novamente.");
        } finally {
            setEnviando(false);
        }
    }

    const STEPS = ["Dados", "Entrega", "Pagamento", "Revisão"];

    return (
        <div className="checkout-page">
            <Navbar />

            {showAlert && <AlertModal tipo={tipoAlert} mensagem={msgAlert} onClose={() => setShowAlert(false)} />}
            {showSucesso && <ModalSucesso onClose={() => navigate("/historico")} />}

            <div className="checkout-wrapper">
                {/* STEPPER */}
                <div className="stepper">
                    {STEPS.map((label, i) => {
                        const num = i + 1;
                        const done = step > num;
                        const active = step === num;
                        return (
                            <div key={num} className={`stepper-item ${active ? "active" : ""} ${done ? "done" : ""}`}>
                                <div className={`stepper-circle ${active || done ? "active" : ""}`}>
                                    {done ? "✓" : num}
                                </div>
                                <span className={`stepper-label ${active ? "active" : ""}`}>{label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* STEP 1 — DADOS */}
                {step === 1 && (
                    <div className="box-checkout">
                        <h3 className="box-title">👤 Seus Dados</h3>
                        <div className="input-group">
                            <label>Nome Completo <span className="obrig">*</span></label>
                            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Wellington Miranda" />
                        </div>
                        <div className="input-group espacamento-top">
                            <label>WhatsApp / Telefone <span className="obrig">*</span></label>
                            <input value={fone} onChange={e => setFone(e.target.value)} placeholder="(15) 99999-9999" />
                        </div>
                        <button className="btn-checkout espacamento-top" onClick={navigateNext}>Continuar →</button>
                    </div>
                )}

                {/* STEP 2 — ENTREGA */}
                {step === 2 && (
                    <div className="box-checkout">
                        <h3 className="box-title">📍 Onde entregamos?</h3>

                        <div className="loc-opcao">
                            <div className="loc-opcao-titulo">Opção 1 — CEP</div>
                            <div className="input-group">
                                <label>
                                    CEP
                                    {cepStatus === "buscando" && <span className="tag-info">buscando...</span>}
                                    {cepStatus === "ok" && <span className="tag-ok">✓ encontrado</span>}
                                    {cepStatus === "erro" && <span className="tag-erro">✗ não encontrado</span>}
                                </label>
                                <input
                                    value={cep}
                                    onChange={handleCep}
                                    placeholder="00000-000- Digite Cep de onde você mora"
                                    maxLength={8}
                                    className={cepStatus === "erro" ? "input-erro" : cepStatus === "ok" ? "input-ok" : ""}
                                />
                                {cepStatus === "erro" && <p className="campo-dica-erro">CEP não encontrado. Use o mapa abaixo.</p>}
                            </div>
                        </div>

                        <div className="loc-opcao">
                            <div className="loc-opcao-titulo">Opção 2 — Colar localização</div>
                            <div className="input-group">
                                <label>
                                    Link ou coordenadas
                                    {locStatus === "ok" && <span className="tag-ok">✓ localização encontrada</span>}
                                    {locStatus === "erro" && <span className="tag-erro">✗ não reconhecido</span>}
                                </label>
                                <input
                                    value={locInput}
                                    onChange={handleLocInput}
                                    placeholder="Cole aqui o link do Google Maps ou coordenadas"
                                    className={locStatus === "erro" ? "input-erro" : locStatus === "ok" ? "input-ok" : ""}
                                />
                            </div>
                        </div>

                        <div className="loc-opcao">
                            <div className="loc-opcao-titulo">Opção 3 — Arraste o mapa</div>
                            <div className="mapa-container">
                                <MapContainer center={posicao} zoom={15} style={{ height: "100%", width: "100%" }}>
                                    <LayersControl position="topright">
                                        <LayersControl.BaseLayer checked name="Ruas">
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                                        </LayersControl.BaseLayer>
                                        <LayersControl.BaseLayer name="Satélite">
                                            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="© Esri" />
                                        </LayersControl.BaseLayer>
                                    </LayersControl>
                                    <Marker
                                        position={posicao}
                                        draggable={true}
                                        eventHandlers={{
                                            dragend: async (e) => {
                                                const { lat, lng } = e.target.getLatLng();
                                                await aplicarCoordenadas(lat, lng);
                                            }
                                        }}
                                    />
                                    <MapRefresher center={posicao} />
                                </MapContainer>
                            </div>
                        </div>

                        {coordenadasConfirmadas && (
                            <div className="frete-badge">🛵 Taxa de entrega: <strong>{fmt(frete)}</strong></div>
                        )}

                        <div className="secao-label espacamento-top">Detalhes do endereço</div>
                        <div className="input-row espacamento-top">
                            <div className="input-group" style={{ flex: 4 }}>
                                <label>Rua</label>
                                <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Nome da rua" />
                            </div>
                            <div className="input-group" style={{ flex: 1 }}>
                                <label>Nº <span className="obrig">*</span></label>
                                <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="123" />
                            </div>
                        </div>

                        <div className="input-group espacamento-top">
                            <label>Ponto de Referência <span className="obrig">*</span></label>
                            <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ex: Portão azul, próximo ao mercado..." />
                        </div>

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack}>← Voltar</button>
                            <button className="btn-checkout" onClick={navigateNext}>Continuar →</button>
                        </div>
                    </div>
                )}

                {/* STEP 3 — PAGAMENTO */}
                {step === 3 && (
                    <div className="box-checkout">
                        <h3 className="box-title">💳 Pagamento</h3>
                        <div className="payment-selector">
                            {[{ id: "pix", label: "⚡ PIX" }, { id: "cartao", label: "💳 Cartão" }, { id: "dinheiro", label: "💵 Dinheiro" }].map(op => (
                                <button key={op.id} className={`pay-btn ${pagamento === op.id ? "active" : ""}`} onClick={() => setPagamento(op.id)}>{op.label}</button>
                            ))}
                        </div>

                        {pagamento === "cartao" && (
                            <div className="cartao-opcoes">
                                <button className={`cartao-btn ${tipoCartao === "credito" ? "active" : ""}`} onClick={() => setTipoCartao("credito")}>💜 Crédito</button>
                                <button className={`cartao-btn ${tipoCartao === "debito" ? "active" : ""}`} onClick={() => setTipoCartao("debito")}>💙 Débito</button>
                            </div>
                        )}

                        {pagamento === "dinheiro" && (
                            <div className="input-group espacamento-top">
                                <label>Troco para quanto?</label>
                                <input type="number" value={dinheiro} onChange={e => setDinheiro(e.target.value)} placeholder="Valor em dinheiro" />
                                {dinheiro && Number(dinheiro) >= totalCart + frete && (
                                    <p className="troco-info">Troco: <strong>{fmt(Number(dinheiro) - (totalCart + frete))}</strong></p>
                                )}
                            </div>
                        )}

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack}>← Voltar</button>
                            <button className="btn-checkout" onClick={navigateNext}>Revisar Pedido →</button>
                        </div>
                    </div>
                )}

                {/* STEP 4 — REVISÃO */}
                {step === 4 && (
                    <div className="box-checkout">
                        <h3 className="box-title">🧾 Revisão</h3>
                        <div className="revisao-secao">
                            <p><strong>{nome}</strong> — {fone}</p>
                            <p>{endereco}, {numero} {complemento && `- ${complemento}`}</p>
                            <p>{bairro} - {cidade}/{uf}</p>
                        </div>                    

                        <div className="revisao-secao">
                            <p className="revisao-titulo">🛍️ Itens</p>
                            {cartItems.map((item, i) => (
                                <div key={i} className="revisao-produto-item">
                                    <div className="revisao-produto-linha">
                                        <span>{item.qtd}x {item.nome}</span>
                                        <span>{fmt(item.preco * item.qtd)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="valores-box">
                            <div className="valor-linha"><span>Subtotal</span><span>{fmt(totalCart)}</span></div>
                            <div className="valor-linha"><span>Entrega</span><span>{fmt(frete)}</span></div>
                            <div className="valor-linha total"><span>Total</span><span>{fmt(totalCart + frete)}</span></div>
                        </div>

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack} disabled={enviando}>← Voltar</button>
                            <button className="btn-checkout ${enviando ? 'enviando' : ''}" onClick={finalizarPedido} disabled={enviando}>
                                {enviando ? "Enviando..." : "🚀 Finalizar Pedido"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}