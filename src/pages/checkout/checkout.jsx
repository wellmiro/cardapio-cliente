import "./checkout.css";
import Navbar from "../../components/navbar/navbar.jsx";
import AlertModal from "../../components/alert-modal/AlertModal.jsx";
import { useContext, useState, useEffect, useRef } from "react";
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

const ORIGEM = { lat: -23.899753126604352, lng: -47.51519888650903 };
const TAXA_BASE = 5.00;
const PRECO_POR_KM = 2.50;

function calcularFrete(lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - ORIGEM.lat) * Math.PI / 180;
    const dLon = (lon2 - ORIGEM.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(ORIGEM.lat * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const km = Math.ceil(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R);
    return TAXA_BASE + km * PRECO_POR_KM;
}

// Tenta extrair lat/lng de várias formas de texto
function parsearLocalizacao(texto) {
    const t = texto.trim();

    // Google Maps link: @lat,lng ou q=lat,lng ou ll=lat,lng
    const googleRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)|[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const gm = t.match(googleRegex);
    if (gm) {
        const lat = parseFloat(gm[1] || gm[3]);
        const lng = parseFloat(gm[2] || gm[4]);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    // Coordenadas diretas: "-23.123, -47.456" ou "-23.123 -47.456"
    const coordRegex = /(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/;
    const cm = t.match(coordRegex);
    if (cm) {
        const lat = parseFloat(cm[1]);
        const lng = parseFloat(cm[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }

    // Apple Maps: maps.apple.com?ll=lat,lng
    const appleRegex = /ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const am = t.match(appleRegex);
    if (am) return { lat: parseFloat(am[1]), lng: parseFloat(am[2]) };

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

export default function Checkout() {
    const { cartItems, totalCart, setCartItems, setTotalCart } = useContext(CartContext);
    const navigate = useNavigate();

    const [msgAlert, setMsgAlert] = useState("");
    const [showAlert, setShowAlert] = useState(false);
    const [tipoAlert, setTipoAlert] = useState("erro");
    const [showSucesso, setShowSucesso] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const [step, setStep] = useState(1);

    // Step 1
    const [nome, setNome] = useState("");
    const [fone, setFone] = useState("");

    // Step 2 — localização
    const [posicao, setPosicao] = useState([ORIGEM.lat, ORIGEM.lng]);
    const [coordenadasConfirmadas, setCoordenadasConfirmadas] = useState(false);
    const [frete, setFrete] = useState(0);

    const [cep, setCep] = useState("");
    const [cepStatus, setCepStatus] = useState(""); // "ok" | "erro" | "buscando"

    const [locInput, setLocInput] = useState("");
    const [locStatus, setLocStatus] = useState(""); // "ok" | "erro"

    const [endereco, setEndereco] = useState("");
    const [numero, setNumero] = useState("");
    const [complemento, setComplemento] = useState("");
    const [bairro, setBairro] = useState("");
    const [cidade, setCidade] = useState("");
    const [uf, setUf] = useState("");
    const [referencia, setReferencia] = useState("");

    // Step 3
    const [pagamento, setPagamento] = useState("");
    const [tipoCartao, setTipoCartao] = useState("");
    const [dinheiro, setDinheiro] = useState("");

    const alerta = (msg, tipo = "erro") => { setMsgAlert(msg); setTipoAlert(tipo); setShowAlert(true); };

    // Quando obtém coordenadas de qualquer fonte, atualiza mapa, frete e tenta reverse geocode
    async function aplicarCoordenadas(lat, lng) {
        setPosicao([lat, lng]);
        setCoordenadasConfirmadas(true);
        setFrete(calcularFrete(lat, lng));

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
                        const map = { "São Paulo": "SP", "Rio de Janeiro": "RJ", "Minas Gerais": "MG", "Paraná": "PR" };
                        estado = map[data.address.state] || data.address.state.substring(0, 2).toUpperCase();
                    }
                    setUf(estado.toUpperCase());
                }
            }
        } catch { /* silencioso — campos continuam editáveis */ }
    }

    // CEP
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

            // Tenta mover o mapa
            const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent((data.logradouro || "") + ", " + data.localidade)}`);
            const geoData = await geo.json();
            if (geoData.length > 0) {
                const lat = parseFloat(geoData[0].lat);
                const lng = parseFloat(geoData[0].lon);
                await aplicarCoordenadas(lat, lng);
            } else {
                // CEP trouxe o endereço mas não achou no mapa — campos preenchidos mas frete não calculado
                setCoordenadasConfirmadas(false);
            }
        } catch {
            setCepStatus("erro");
        }
    }

    // Colar localização
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

    function validarStep1() {
        if (!nome.trim()) { alerta("Por favor, informe seu nome."); return false; }
        if (!fone.trim()) { alerta("Por favor, informe seu WhatsApp."); return false; }
        return true;
    }

    function validarStep2() {
        if (!coordenadasConfirmadas) {
            alerta("Confirme sua localização pelo mapa, CEP ou colando o link. O frete é calculado pela sua localização real.");
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
            if (Number(dinheiro) < totalCart + frete) { alerta("O valor para troco é menor que o total do pedido."); return false; }
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

                        {/* OPÇÃO 1 — CEP */}
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
                                    placeholder="00000-000"
                                    maxLength={8}
                                    className={cepStatus === "erro" ? "input-erro" : cepStatus === "ok" ? "input-ok" : ""}
                                />
                                {cepStatus === "erro" && (
                                    <p className="campo-dica-erro">CEP não encontrado. Use o mapa ou cole sua localização abaixo.</p>
                                )}
                            </div>
                        </div>

                        {/* OPÇÃO 2 — COLAR LOCALIZAÇÃO */}
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
                                    placeholder="Cole aqui o link do Google Maps, Apple Maps ou coordenadas (-23.456, -47.123)"
                                    className={locStatus === "erro" ? "input-erro" : locStatus === "ok" ? "input-ok" : ""}
                                />
                                <p className="campo-dica">
                                    No Google Maps: toque no pino → compartilhar → copiar link. Ou toque e segure no mapa → copie as coordenadas.
                                </p>
                                {locStatus === "erro" && (
                                    <p className="campo-dica-erro">Formato não reconhecido. Tente um link do Google Maps ou coordenadas como: -23.456, -47.123</p>
                                )}
                            </div>
                        </div>

                        {/* OPÇÃO 3 — MAPA */}
                        <div className="loc-opcao">
                            <div className="loc-opcao-titulo">Opção 3 — Arraste o mapa</div>
                            <p className="campo-dica" style={{ marginBottom: 8 }}>
                                Arraste o marcador vermelho até a sua casa. O frete será calculado pela distância real.
                            </p>
                            <div className="mapa-container">
                                <MapContainer center={posicao} zoom={15} style={{ height: "100%", width: "100%" }}>
                                    <LayersControl position="topright">
                                        <LayersControl.BaseLayer checked name="Ruas">
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                                        </LayersControl.BaseLayer>
                                        <LayersControl.BaseLayer name="Satélite">
                                            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="© Esri" />
                                        </LayersControl.BaseLayer>
                                        <LayersControl.BaseLayer name="Terreno">
                                            <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="© OpenTopoMap" />
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

                        {/* FRETE CALCULADO */}
                        {coordenadasConfirmadas && (
                            <div className="frete-badge">
                                🛵 Taxa de entrega calculada: <strong>{fmt(frete)}</strong>
                            </div>
                        )}

                        {!coordenadasConfirmadas && (
                            <div className="frete-aviso">
                                ⚠️ Confirme sua localização acima para calcular o frete.
                            </div>
                        )}

                        {/* CAMPOS DE ENDEREÇO — sempre editáveis */}
                        <div className="secao-label espacamento-top">Detalhes do endereço</div>

                        <div className="input-row espacamento-top">
                            <div className="input-group" style={{ flex: 4 }}>
                                <label>Rua / Logradouro</label>
                                <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Nome da rua (opcional)" />
                            </div>
                            <div className="input-group" style={{ flex: 1 }}>
                                <label>Nº <span className="obrig">*</span></label>
                                <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="123" />
                            </div>
                        </div>

                        <div className="input-group espacamento-top">
                            <label>Complemento <span className="opcional">(opcional)</span></label>
                            <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Apto, bloco, casa..." />
                        </div>

                        <div className="input-group espacamento-top">
                            <label>Ponto de Referência <span className="obrig">*</span></label>
                            <input
                                value={referencia}
                                onChange={e => setReferencia(e.target.value)}
                                placeholder="Ex: próximo ao mercado X, portão azul, casa da esquina..."
                            />
                        </div>

                        <div className="input-row espacamento-top">
                            <div className="input-group" style={{ flex: 1 }}>
                                <label>Bairro</label>
                                <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" />
                            </div>
                            <div className="input-group" style={{ flex: 2 }}>
                                <label>Cidade</label>
                                <input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade" />
                            </div>
                            <div className="input-group" style={{ flex: 0.6 }}>
                                <label>UF</label>
                                <input value={uf} onChange={e => setUf(e.target.value)} maxLength={2} placeholder="SP" />
                            </div>
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
                        <h3 className="box-title">💳 Forma de Pagamento</h3>

                        <div className="payment-selector">
                            {[
                                { id: "pix", label: "⚡ PIX" },
                                { id: "cartao", label: "💳 Cartão" },
                                { id: "dinheiro", label: "💵 Dinheiro" }
                            ].map(op => (
                                <button
                                    key={op.id}
                                    className={`pay-btn ${pagamento === op.id ? "active" : ""}`}
                                    onClick={() => setPagamento(op.id)}
                                >
                                    {op.label}
                                </button>
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
                                <label>Troco para quanto? <span className="obrig">*</span></label>
                                <input
                                    type="number"
                                    value={dinheiro}
                                    onChange={e => setDinheiro(e.target.value)}
                                    placeholder={`Mínimo ${fmt(totalCart + frete)}`}
                                />
                                {dinheiro && Number(dinheiro) >= totalCart + frete && (
                                    <p className="troco-info">
                                        Troco: <strong>{fmt(Number(dinheiro) - (totalCart + frete))}</strong>
                                    </p>
                                )}
                            </div>
                        )}

                        {pagamento === "pix" && (
                            <div className="pix-info espacamento-top">
                                ⚡ Você receberá as instruções de pagamento após confirmar o pedido.
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
                        <h3 className="box-title">🧾 Revisão do Pedido</h3>

                        <div className="revisao-secao">
                            <p className="revisao-titulo">👤 Cliente</p>
                            <p><strong>{nome}</strong> — {fone}</p>
                        </div>

                        <div className="revisao-secao">
                            <p className="revisao-titulo">📍 Endereço</p>
                            <p>{[endereco, numero, complemento].filter(Boolean).join(", ")}</p>
                            <p style={{ color: '#777', fontSize: '0.85rem' }}>{[bairro, cidade, uf].filter(Boolean).join(" — ")}</p>
                            {referencia && <p style={{ color: '#E84F3D', fontSize: '0.85rem', marginTop: 4 }}>📌 {referencia}</p>}
                            <a
                                href={`https://www.google.com/maps?q=${posicao[0]},${posicao[1]}`}
                                target="_blank"
                                rel="noreferrer"
                                className="link-mapa"
                            >
                                🗺️ Ver no mapa
                            </a>
                        </div>

                        <div className="revisao-secao">
                            <p className="revisao-titulo">💳 Pagamento</p>
                            <p style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                                {pagamento} {tipoCartao && `(${tipoCartao})`}
                            </p>
                            {pagamento === "dinheiro" && dinheiro && (
                                <p style={{ color: '#555', fontSize: '0.85rem' }}>
                                    Troco para {fmt(Number(dinheiro))} — Troco: {fmt(Number(dinheiro) - (totalCart + frete))}
                                </p>
                            )}
                        </div>

                        <div className="revisao-secao">
                            <p className="revisao-titulo">🛍️ Itens</p>
                            {cartItems.map((item, i) => (
                                <div key={i} className="revisao-produto-item">
                                    <div className="revisao-produto-linha">
                                        <span><strong>{item.qtd}x</strong> {item.nome}</span>
                                        <span>{fmt(item.preco * item.qtd)}</span>
                                    </div>
                                    {item.adicionais?.length > 0 && (
                                        <p className="revisao-adicionais">+ {item.adicionais.map(a => a.nome_item).join(", ")}</p>
                                    )}
                                    {item.observacao && <p className="revisao-obs">Obs: {item.observacao}</p>}
                                </div>
                            ))}
                        </div>

                        <div className="valores-box">
                            <div className="valor-linha">
                                <span>Subtotal</span>
                                <span>{fmt(totalCart)}</span>
                            </div>
                            <div className="valor-linha">
                                <span>🛵 Entrega</span>
                                <span>{fmt(frete)}</span>
                            </div>
                            <div className="valor-linha total">
                                <span>Total a Pagar</span>
                                <span>{fmt(totalCart + frete)}</span>
                            </div>
                        </div>

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack} disabled={enviando}>← Voltar</button>
                            <button
                                className={`btn-checkout btn-finalizar ${enviando ? "enviando" : ""}`}
                                onClick={finalizarPedido}
                                disabled={enviando}
                            >
                                {enviando ? (
                                    <><span className="spinner" /> Enviando...</>
                                ) : (
                                    "🚀 Finalizar e Enviar"
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}