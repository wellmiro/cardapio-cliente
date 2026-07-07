import { useEffect, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar/navbar.jsx";
import api from "../../services/api.js";
import { CartContext } from "../../contexts/cart-context.jsx";
import AlertModal from "../../components/alert-modal/AlertModal.jsx";

import { MapContainer, TileLayer, Marker, useMap, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import "./checkout.css";

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
});

function parseCoord(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const num = parseFloat(String(valor).replace(",", "."));
    return isNaN(num) ? null : num;
}

function parsearLocalizacao(texto) {
    const t = texto.trim();

    const googleRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)|[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const gm = t.match(googleRegex);

    if (gm) {
        const lat = parseFloat(gm[1] || gm[3]);
        const lng = parseFloat(gm[2] || gm[4]);

        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    const coordRegex = /(-?\d{1,3}[.,]\d+)[,\s]+(-?\d{1,3}[.,]\d+)/;
    const cm = t.match(coordRegex);

    if (cm) {
        const lat = parseFloat(cm[1].replace(",", "."));
        const lng = parseFloat(cm[2].replace(",", "."));

        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng };
        }
    }

    const appleRegex = /ll=(-?\d+[.,]\d+),(-?\d+[.,]\d+)/;
    const am = t.match(appleRegex);

    if (am) {
        return {
            lat: parseFloat(am[1].replace(",", ".")),
            lng: parseFloat(am[2].replace(",", "."))
        };
    }

    return null;
}

function estadoParaUf(addr) {
    let estado = addr.state_code || "";

    if (!estado && addr.state) {
        const statesMap = {
            "São Paulo": "SP",
            "Rio de Janeiro": "RJ",
            "Minas Gerais": "MG",
            "Paraná": "PR"
        };

        estado = statesMap[addr.state] || addr.state.substring(0, 2).toUpperCase();
    }

    return estado.toUpperCase();
}

function formatarNomeProprio(valor) {
    const palavrasMinusculas = ["da", "de", "do", "das", "dos", "e"];

    return valor
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .map((parte, index) => {
            if (index > 0 && palavrasMinusculas.includes(parte)) {
                return parte;
            }

            return parte.charAt(0).toUpperCase() + parte.slice(1);
        })
        .join(" ");
}

function MapRefresher({ center }) {
    const map = useMap();

    useEffect(() => {
        if (!center) return;

        map.setView(center, 16);
        setTimeout(() => map.invalidateSize(), 300);
    }, [center, map]);

    return null;
}

function ModalSucesso({ onClose }) {
    return (
        <div className="modal-sucesso" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <span className="check">OK</span>
                <h3>Pedido Enviado!</h3>
                <p>Em breve o restaurante começará a preparar!</p>
                <button className="btn-checkout" style={{ marginTop: 18 }} onClick={onClose}>
                    Ver meus pedidos
                </button>
            </div>
        </div>
    );
}

export function Checkout() {
    const { cartItems, totalCart, setCartItems, setTotalCart } = useContext(CartContext);
    const navigate = useNavigate();

    const [msgAlert, setMsgAlert] = useState("");
    const [showAlert, setShowAlert] = useState(false);
    const [tipoAlert, setTipoAlert] = useState("erro");
    const [showSucesso, setShowSucesso] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [step, setStep] = useState(1);

    const [configFrete, setConfigFrete] = useState({
        latOrigem: null,
        lngOrigem: null,
        taxaBase: 0,
        precoKm: 1
    });

    const [configCarregada, setConfigCarregada] = useState(false);
    const [idEstabelecimento, setIdEstabelecimento] = useState(null);

    const [nome, setNome] = useState("");
    const [fone, setFone] = useState("");

    const [entregaEtapa, setEntregaEtapa] = useState("metodo");
    const [metodoEntrega, setMetodoEntrega] = useState("endereco");
    const [enderecoConfirmado, setEnderecoConfirmado] = useState(false);

    const [posicao, setPosicao] = useState(null);
    const [frete, setFrete] = useState(0);

    const [cep, setCep] = useState("");
    const [cepStatus, setCepStatus] = useState("");
    const [locInput, setLocInput] = useState("");
    const [locStatus, setLocStatus] = useState("");

    const [enderecoBusca, setEnderecoBusca] = useState("");
    const [sugestoesEndereco, setSugestoesEndereco] = useState([]);
    const [buscandoSugestoes, setBuscandoSugestoes] = useState(false);
    const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
    const debounceRef = useRef(null);

    const [endereco, setEndereco] = useState("");
    const [numero, setNumero] = useState("");
    const [complemento, setComplemento] = useState("");
    const [bairro, setBairro] = useState("");
    const [cidade, setCidade] = useState("");
    const [uf, setUf] = useState("");
    const [referencia, setReferencia] = useState("");

    const [pagamento, setPagamento] = useState("");
    const [tipoCartao, setTipoCartao] = useState("");
    const [dinheiro, setDinheiro] = useState("");

    const mapaPreviewRef = useRef(null);
    const mapaDetalhesRef = useRef(null);

    useEffect(() => {
        async function carregarConfiguracoesLoja() {
            try {
                const slugAtual = localStorage.getItem("slug");

                if (!slugAtual) {
                    setConfigCarregada(true);
                    return;
                }

                const res = await api.get(`/cardapio_digital/${slugAtual}`);
                const dadosLoja = res.data || {};

                const latOrigem = parseCoord(dadosLoja.latitude);
                const lngOrigem = parseCoord(dadosLoja.longitude);
                const taxaBase = parseCoord(dadosLoja.taxa_base) || 0;
                const precoKmBanco = parseCoord(dadosLoja.preco_km) || 0;
                const precoKm = precoKmBanco > 0 ? precoKmBanco : 1;

                setIdEstabelecimento(dadosLoja.id_estabelecimento || null);

                setConfigFrete({
                    latOrigem,
                    lngOrigem,
                    taxaBase,
                    precoKm
                });

                if (latOrigem !== null && lngOrigem !== null) {
                    setPosicao([latOrigem, lngOrigem]);
                }

                if (taxaBase > 0) {
                    setFrete(taxaBase);
                }
            } catch (err) {
                console.error("Erro ao carregar configurações de entrega", err);
            } finally {
                setConfigCarregada(true);
            }
        }

        carregarConfiguracoesLoja();
    }, []);

    const alerta = (msg, tipo = "erro") => {
        setMsgAlert(msg);
        setTipoAlert(tipo);
        setShowAlert(true);
    };

    function calcularFrete(lat2, lon2) {
        if (configFrete.taxaBase > 0) {
            return configFrete.taxaBase;
        }

        if (configFrete.latOrigem === null || configFrete.lngOrigem === null) {
            return 0;
        }

        const R = 6371;
        const dLat = (lat2 - configFrete.latOrigem) * Math.PI / 180;
        const dLon = (lon2 - configFrete.lngOrigem) * Math.PI / 180;

        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(configFrete.latOrigem * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;

        const km = Math.ceil(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R);
        return km * configFrete.precoKm;
    }

    function rolarParaMapa(ref) {
        setTimeout(() => {
            ref.current?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }, 150);
    }

    async function aplicarCoordenadas(lat, lng, origem = "mapa") {
        setPosicao([lat, lng]);
        setEnderecoConfirmado(true);

        const novoFrete = calcularFrete(lat, lng);
        setFrete(novoFrete);

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            const data = await res.json();

            if (data.address) {
                setEndereco(data.address.road || data.address.pedestrian || endereco);
                setBairro(data.address.suburb || data.address.neighbourhood || bairro);
                setCidade(data.address.city || data.address.town || data.address.village || cidade);
                setUf(estadoParaUf(data.address) || uf);
            }
        } catch (e) {
            console.error("Erro reverse geocode", e);
        }

        if (origem !== "drag") {
            rolarParaMapa(mapaPreviewRef);
        }
    }

    async function buscarSugestoesEndereco(texto) {
        if (!texto || texto.trim().length < 3) {
            setSugestoesEndereco([]);
            return;
        }

        setBuscandoSugestoes(true);

        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=br&limit=5&q=${encodeURIComponent(texto)}`
            );

            const data = await res.json();
            setSugestoesEndereco(data || []);
        } catch (e) {
            console.error("Erro ao buscar sugestões de endereço", e);
            setSugestoesEndereco([]);
        } finally {
            setBuscandoSugestoes(false);
        }
    }

    function handleEnderecoBuscaChange(e) {
        const v = e.target.value;
        setEnderecoBusca(v);
        setMostrarSugestoes(true);
        setEnderecoConfirmado(false);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => buscarSugestoesEndereco(v), 400);
    }

    async function selecionarSugestaoEndereco(sugestao) {
        const lat = parseFloat(sugestao.lat);
        const lng = parseFloat(sugestao.lon);

        if (isNaN(lat) || isNaN(lng)) return;

        const addr = sugestao.address || {};

        setMetodoEntrega("endereco");
        setEnderecoBusca(sugestao.display_name || "");
        setMostrarSugestoes(false);
        setSugestoesEndereco([]);

        setEndereco(addr.road || addr.pedestrian || "");
        setBairro(addr.suburb || addr.neighbourhood || "");
        setCidade(addr.city || addr.town || addr.village || "");
        setUf(estadoParaUf(addr));

        await aplicarCoordenadas(lat, lng);
    }

    async function handleCep(e) {
        const v = e.target.value.replace(/\D/g, "");
        setCep(v);
        setCepStatus("");
        setEnderecoConfirmado(false);

        if (v.length < 8) return;

        setCepStatus("buscando");

        try {
            const res = await fetch(`https://viacep.com.br/ws/${v}/json/`);
            const data = await res.json();

            if (data.erro) throw new Error("CEP não encontrado");

            setMetodoEntrega("cep");
            setEndereco(data.logradouro || "");
            setBairro(data.bairro || "");
            setCidade(data.localidade || "");
            setUf(data.uf || "");
            setCepStatus("ok");

            const consulta = [
                data.logradouro,
                data.bairro,
                data.localidade,
                data.uf,
                "Brasil"
            ].filter(Boolean).join(", ");

            const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(consulta)}`);
            const geoData = await geo.json();

            if (geoData.length > 0) {
                await aplicarCoordenadas(parseFloat(geoData[0].lat), parseFloat(geoData[0].lon));
            } else {
                setEnderecoConfirmado(true);
                setFrete(configFrete.taxaBase > 0 ? configFrete.taxaBase : 0);
            }
        } catch {
            setCepStatus("erro");
        }
    }

    async function handleLocInput(e) {
        const v = e.target.value;
        setLocInput(v);
        setLocStatus("");
        setEnderecoConfirmado(false);

        if (!v.trim()) return;

        const coords = parsearLocalizacao(v);

        if (coords) {
            setMetodoEntrega("link");
            setLocStatus("ok");
            await aplicarCoordenadas(coords.lat, coords.lng);
        } else {
            setLocStatus("erro");
        }
    }

    async function handleMapaManualDrag(lat, lng) {
        setMetodoEntrega("mapa");
        await aplicarCoordenadas(lat, lng, "drag");
    }

    function validarStep1() {
        if (!nome.trim()) {
            alerta("Por favor, informe seu nome.");
            return false;
        }

        if (!fone.trim()) {
            alerta("Por favor, informe seu WhatsApp.");
            return false;
        }

        setNome(formatarNomeProprio(nome));
        return true;
    }

    function continuarEntregaMetodo() {
        if (!enderecoConfirmado) {
            alerta("Escolha uma opção válida de entrega antes de continuar.");
            return;
        }

        if (configFrete.taxaBase <= 0 && (!frete || frete <= 0)) {
            alerta("Não foi possível calcular a entrega. Confira a localização no mapa.");
            return;
        }

        setEntregaEtapa("detalhes");
        rolarParaMapa(mapaDetalhesRef);
    }

    function validarStep2() {
        if (entregaEtapa === "metodo") {
            continuarEntregaMetodo();
            return false;
        }

        if (!enderecoConfirmado) {
            alerta("Confirme a localização da entrega.");
            return false;
        }

        if (!endereco.trim()) {
            alerta("Informe a rua.");
            return false;
        }

        if (!numero.trim()) {
            alerta("O número da casa é obrigatório.");
            return false;
        }

        if (!bairro.trim()) {
            alerta("Informe o bairro.");
            return false;
        }

        if (!cidade.trim()) {
            alerta("Informe a cidade.");
            return false;
        }

        if (!uf.trim()) {
            alerta("Informe o estado.");
            return false;
        }

        if (!referencia.trim()) {
            alerta("Informe um ponto de referência para o entregador.");
            return false;
        }

        return true;
    }

    function validarStep3() {
        if (!pagamento) {
            alerta("Escolha uma forma de pagamento.");
            return false;
        }

        if (pagamento === "cartao" && !tipoCartao) {
            alerta("Selecione Crédito ou Débito.");
            return false;
        }

        if (pagamento === "dinheiro") {
            if (!dinheiro) {
                alerta("Informe o valor para o troco.");
                return false;
            }

            if (Number(dinheiro) < totalCart + frete) {
                alerta("O valor para troco é menor que o total.");
                return false;
            }
        }

        return true;
    }

    const navigateNext = () => {
        if (step === 1 && !validarStep1()) return;
        if (step === 2 && !validarStep2()) return;
        if (step === 3 && !validarStep3()) return;

        setStep(s => Math.min(s + 1, 4));
    };

    const navigateBack = () => {
        if (step === 2 && entregaEtapa === "detalhes") {
            setEntregaEtapa("metodo");
            return;
        }

        setStep(s => Math.max(s - 1, 1));
    };

    async function enviarNotificacaoNovoPedido(enderecoCompleto, idPedido) {
        try {
            let formaPagamentoTexto = "PIX";

            if (pagamento === "cartao") {
                formaPagamentoTexto = `Cartão (${tipoCartao === "credito" ? "Crédito" : "Débito"})`;
            } else if (pagamento === "dinheiro") {
                formaPagamentoTexto = "Dinheiro";
            }

            const nomeFormatado = formatarNomeProprio(nome);

            const mensagem =
                `Pedido #${idPedido} - ` +
                `${nomeFormatado} - ` +
                `${fmt(totalCart + frete)} - ` +
                `${formaPagamentoTexto} - ` +
                `${enderecoCompleto}`;

            const payload = {
                id_estabelecimento: idEstabelecimento,
                mensagem,
                id_pedido: idPedido,
                id_produto: null
            };

            await api.post("/notificacoes/publico", payload);
        } catch (err) {
            console.error("=== ERRO AO ENVIAR NOTIFICAÇÃO ===");
            console.error(err.response?.data || err);
        }
    }

    async function finalizarPedido() {
        if (!cartItems || cartItems.length === 0 || totalCart <= 0) {
            alerta("Sua sacola está vazia. Adicione pelo menos um item antes de finalizar.");
            return;
        }

        const slugAtual = localStorage.getItem("slug");
        const session_id = localStorage.getItem("session_id") || crypto.randomUUID();

        if (!slugAtual) {
            alerta("Erro: Estabelecimento não encontrado.");
            return;
        }

        setEnviando(true);

        try {
            let forma_pagamento = pagamento;

            if (pagamento === "cartao") {
                forma_pagamento = `Cartão (${tipoCartao})`;
            }

            const nomeFormatado = formatarNomeProprio(nome);

            const enderecoCompleto = [
                endereco,
                numero,
                complemento,
                bairro,
                cidade && `${cidade}/${uf}`
            ].filter(Boolean).join(", ");

            const itensPedido = cartItems.map(i => {
                const precoItem = Number(i.preco ?? i.valor ?? 0);
                const qtdItem = Number(i.qtd ?? 1);

                return {
                    id_produto: i.id_produto ?? i.id,
                    qtd: qtdItem,
                    vl_unitario: precoItem,
                    vl_total: precoItem * qtdItem,
                    obs: i.observacao,
                    adicionais: i.adicionais || []
                };
            });

            const payload = {
                slug: slugAtual,
                session_id,
                nome_cliente: nomeFormatado,
                fone_cliente: fone,
                vl_subtotal: totalCart,
                vl_entrega: frete,
                vl_total: totalCart + frete,
                endereco_entrega: enderecoCompleto + (referencia ? ` | Ref: ${referencia}` : ""),
                rota: posicao ? `https://www.google.com/maps?q=${posicao[0]},${posicao[1]}` : "",
                forma_pagamento,
                dinheiro: pagamento === "dinheiro" ? Number(dinheiro) : 0,
                troco: pagamento === "dinheiro" ? Number(dinheiro) - (totalCart + frete) : 0,
                local_consumo: "DELIVERY",
                itens: itensPedido
            };

            const respostaPedido = await api.post("/pedidos/publico", payload);

            await enviarNotificacaoNovoPedido(
                enderecoCompleto,
                respostaPedido.data.id_pedido
            );

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
    const totalPedido = totalCart + frete;
    const freteFixoAtivo = configFrete.taxaBase > 0;

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

            {showSucesso && (
                <ModalSucesso onClose={() => navigate("/historico")} />
            )}

            <div className="checkout-wrapper">
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

                {step === 1 && (
                    <div className="box-checkout">
                        <h3 className="box-title">Seus Dados</h3>

                        <div className="input-group">
                            <label>Nome Completo <span className="obrig">*</span></label>
                            <input
                                value={nome}
                                onChange={e => setNome(e.target.value)}
                                onBlur={() => setNome(formatarNomeProprio(nome))}
                                placeholder="Ex: Wellington Miranda"
                            />
                        </div>

                        <div className="input-group espacamento-top">
                            <label>WhatsApp / Telefone <span className="obrig">*</span></label>
                            <input
                                value={fone}
                                onChange={e => setFone(e.target.value)}
                                placeholder="(15) 99999-9999"
                            />
                        </div>

                        <button className="btn-checkout espacamento-top" onClick={navigateNext}>
                            Continuar
                        </button>
                    </div>
                )}

                {step === 2 && entregaEtapa === "metodo" && (
                    <div className="box-checkout">
                        <h3 className="box-title">Entrega</h3>

                        <div className="frete-badge">
                            Taxa de entrega: <strong>{fmt(frete)}</strong>
                            {freteFixoAtivo && <span className="tag-info"> fixa</span>}
                        </div>

                        <div className="payment-selector espacamento-top">
                            {[
                                { id: "endereco", label: "Endereço" },
                                { id: "cep", label: "CEP" },
                                { id: "link", label: "Link" },
                                { id: "mapa", label: "Mapa" }
                            ].map(op => (
                                <button
                                    key={op.id}
                                    type="button"
                                    className={`pay-btn ${metodoEntrega === op.id ? "active" : ""}`}
                                    onClick={() => setMetodoEntrega(op.id)}
                                >
                                    {op.label}
                                </button>
                            ))}
                        </div>

                        {metodoEntrega === "endereco" && (
                            <div className="loc-opcao">
                                <div className="loc-opcao-titulo">Procure seu endereço</div>

                                <div className="input-group" style={{ position: "relative" }}>
                                    <label>
                                        Endereço
                                        {buscandoSugestoes && <span className="tag-info">buscando...</span>}
                                    </label>

                                    <input
                                        value={enderecoBusca}
                                        onChange={handleEnderecoBuscaChange}
                                        onFocus={() => {
                                            if (sugestoesEndereco.length > 0) setMostrarSugestoes(true);
                                        }}
                                        onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
                                        placeholder="Digite rua, bairro e cidade"
                                        autoComplete="off"
                                    />

                                    {mostrarSugestoes && sugestoesEndereco.length > 0 && (
                                        <ul className="sugestoes-lista">
                                            {sugestoesEndereco.map((s, i) => (
                                                <li
                                                    key={i}
                                                    className="sugestao-item"
                                                    onMouseDown={() => selecionarSugestaoEndereco(s)}
                                                >
                                                    {s.display_name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}

                        {metodoEntrega === "cep" && (
                            <div className="loc-opcao">
                                <div className="loc-opcao-titulo">Informe seu CEP</div>

                                <div className="input-group">
                                    <label>
                                        CEP
                                        {cepStatus === "buscando" && <span className="tag-info">buscando...</span>}
                                        {cepStatus === "ok" && <span className="tag-ok">encontrado</span>}
                                        {cepStatus === "erro" && <span className="tag-erro">não encontrado</span>}
                                    </label>

                                    <input
                                        value={cep}
                                        onChange={handleCep}
                                        placeholder="00000-000"
                                        maxLength={8}
                                        className={cepStatus === "erro" ? "input-erro" : cepStatus === "ok" ? "input-ok" : ""}
                                    />

                                    {cepStatus === "erro" && (
                                        <p className="campo-dica-erro">CEP não encontrado. Confira o número ou escolha outro método.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {metodoEntrega === "link" && (
                            <div className="loc-opcao">
                                <div className="loc-opcao-titulo">Cole uma localização</div>

                                <div className="input-group">
                                    <label>
                                        Link ou coordenadas
                                        {locStatus === "ok" && <span className="tag-ok">localização encontrada</span>}
                                        {locStatus === "erro" && <span className="tag-erro">não reconhecido</span>}
                                    </label>

                                    <input
                                        value={locInput}
                                        onChange={handleLocInput}
                                        placeholder="Cole aqui o link do Google Maps ou coordenadas"
                                        className={locStatus === "erro" ? "input-erro" : locStatus === "ok" ? "input-ok" : ""}
                                    />
                                </div>
                            </div>
                        )}

                        {metodoEntrega === "mapa" && (
                            <div className="loc-opcao">
                                <div className="loc-opcao-titulo">Arraste o marcador até o local da entrega</div>
                            </div>
                        )}

                        <div className="loc-opcao" ref={mapaPreviewRef}>
                            <div className="loc-opcao-titulo">Mapa da entrega</div>

                            <div className="mapa-container" style={{ position: "relative" }}>
                                {!configCarregada ? (
                                    <div className="mapa-carregando">Carregando mapa...</div>
                                ) : (
                                    <>
                                        <MapContainer
                                            center={posicao || [0, 0]}
                                            zoom={posicao ? 16 : 2}
                                            style={{ height: "100%", width: "100%" }}
                                        >
                                            <LayersControl position="topright">
                                                <LayersControl.BaseLayer checked name="Ruas">
                                                    <TileLayer
                                                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                                        attribution="© OpenStreetMap"
                                                    />
                                                </LayersControl.BaseLayer>

                                                <LayersControl.BaseLayer name="Satélite">
                                                    <TileLayer
                                                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                                        attribution="© Esri"
                                                    />
                                                </LayersControl.BaseLayer>
                                            </LayersControl>

                                            {posicao && (
                                                <Marker
                                                    position={posicao}
                                                    draggable={true}
                                                    eventHandlers={{
                                                        dragend: async (e) => {
                                                            const { lat, lng } = e.target.getLatLng();
                                                            await handleMapaManualDrag(lat, lng);
                                                        }
                                                    }}
                                                />
                                            )}

                                            <MapRefresher center={posicao} />
                                        </MapContainer>

                                        {!posicao && (
                                            <div className="mapa-overlay-vazio">
                                                Escolha endereço, CEP, link ou arraste no mapa.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {enderecoConfirmado && (
                            <div className="revisao-secao">
                                <p><strong>Local selecionado</strong></p>
                                <p>{endereco || "Endereço pelo mapa"} {bairro && `- ${bairro}`}</p>
                                <p>{cidade && uf ? `${cidade}/${uf}` : ""}</p>
                            </div>
                        )}

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack}>Voltar</button>
                            <button className="btn-checkout" onClick={continuarEntregaMetodo}>Continuar</button>
                        </div>
                    </div>
                )}

                {step === 2 && entregaEtapa === "detalhes" && (
                    <div className="box-checkout">
                        <h3 className="box-title">Conferir entrega</h3>

                        <div className="frete-badge">
                            Taxa de entrega: <strong>{fmt(frete)}</strong>
                            {freteFixoAtivo && <span className="tag-info"> fixa</span>}
                        </div>

                        <div className="loc-opcao" ref={mapaDetalhesRef}>
                            <div className="loc-opcao-titulo">Ajuste fino no mapa</div>

                            <div className="mapa-container" style={{ position: "relative" }}>
                                <MapContainer
                                    center={posicao || [0, 0]}
                                    zoom={posicao ? 16 : 2}
                                    style={{ height: "100%", width: "100%" }}
                                >
                                    <LayersControl position="topright">
                                        <LayersControl.BaseLayer checked name="Ruas">
                                            <TileLayer
                                                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                                attribution="© OpenStreetMap"
                                            />
                                        </LayersControl.BaseLayer>

                                        <LayersControl.BaseLayer name="Satélite">
                                            <TileLayer
                                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                                attribution="© Esri"
                                            />
                                        </LayersControl.BaseLayer>
                                    </LayersControl>

                                    {posicao && (
                                        <Marker
                                            position={posicao}
                                            draggable={true}
                                            eventHandlers={{
                                                dragend: async (e) => {
                                                    const { lat, lng } = e.target.getLatLng();
                                                    await handleMapaManualDrag(lat, lng);
                                                }
                                            }}
                                        />
                                    )}

                                    <MapRefresher center={posicao} />
                                </MapContainer>
                            </div>
                        </div>

                        <div className="secao-label espacamento-top">Dados do endereço</div>

                        <div className="input-row espacamento-top">
                            <div className="input-group" style={{ flex: 4 }}>
                                <label>Rua <span className="obrig">*</span></label>
                                <input
                                    value={endereco}
                                    onChange={e => setEndereco(e.target.value)}
                                    placeholder="Nome da rua"
                                />
                            </div>

                            <div className="input-group" style={{ flex: 1 }}>
                                <label>Nº <span className="obrig">*</span></label>
                                <input
                                    value={numero}
                                    onChange={e => setNumero(e.target.value)}
                                    placeholder="123"
                                />
                            </div>
                        </div>

                        <div className="input-row espacamento-top">
                            <div className="input-group" style={{ flex: 2 }}>
                                <label>Bairro <span className="obrig">*</span></label>
                                <input
                                    value={bairro}
                                    onChange={e => setBairro(e.target.value)}
                                    placeholder="Bairro"
                                />
                            </div>

                            <div className="input-group" style={{ flex: 2 }}>
                                <label>Cidade <span className="obrig">*</span></label>
                                <input
                                    value={cidade}
                                    onChange={e => setCidade(e.target.value)}
                                    placeholder="Cidade"
                                />
                            </div>

                            <div className="input-group" style={{ flex: 1 }}>
                                <label>UF <span className="obrig">*</span></label>
                                <input
                                    value={uf}
                                    onChange={e => setUf(e.target.value.toUpperCase())}
                                    placeholder="SP"
                                    maxLength={2}
                                />
                            </div>
                        </div>

                        <div className="input-group espacamento-top">
                            <label>Complemento</label>
                            <input
                                value={complemento}
                                onChange={e => setComplemento(e.target.value)}
                                placeholder="Apto, bloco, casa dos fundos..."
                            />
                        </div>

                        <div className="input-group espacamento-top">
                            <label>Ponto de Referência <span className="obrig">*</span></label>
                            <input
                                value={referencia}
                                onChange={e => setReferencia(e.target.value)}
                                placeholder="Ex: Portão azul, próximo ao mercado..."
                            />
                        </div>

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack}>Voltar</button>
                            <button className="btn-checkout" onClick={navigateNext}>Continuar</button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="box-checkout">
                        <h3 className="box-title">Pagamento</h3>

                        <div className="payment-selector">
                            {[
                                { id: "pix", label: "PIX" },
                                { id: "cartao", label: "Cartão" },
                                { id: "dinheiro", label: "Dinheiro" }
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
                                <button
                                    className={`cartao-btn ${tipoCartao === "credito" ? "active" : ""}`}
                                    onClick={() => setTipoCartao("credito")}
                                >
                                    Crédito
                                </button>

                                <button
                                    className={`cartao-btn ${tipoCartao === "debito" ? "active" : ""}`}
                                    onClick={() => setTipoCartao("debito")}
                                >
                                    Débito
                                </button>
                            </div>
                        )}

                        {pagamento === "dinheiro" && (
                            <div className="input-group espacamento-top">
                                <label>Troco para quanto? Total do pedido: {fmt(totalPedido)}</label>
                                <input
                                    type="number"
                                    value={dinheiro}
                                    onChange={e => setDinheiro(e.target.value)}
                                    placeholder={`Ex: ${Math.ceil(totalPedido)}`}
                                />

                                {dinheiro && Number(dinheiro) >= totalPedido && (
                                    <p className="troco-info">
                                        Troco: <strong>{fmt(Number(dinheiro) - totalPedido)}</strong>
                                    </p>
                                )}
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
                        <h3 className="box-title">Revisão</h3>

                        <div className="revisao-secao">
                            <p><strong>{formatarNomeProprio(nome)}</strong> — {fone}</p>
                            <p>{endereco}, {numero} {complemento && `- ${complemento}`}</p>
                            <p>{bairro} - {cidade}/{uf}</p>
                        </div>

                        <div className="revisao-secao">
                            <p className="revisao-titulo">Itens</p>

                            {cartItems.length === 0 ? (
                                <p>Nenhum item na sacola.</p>
                            ) : (
                                cartItems.map((item, i) => {
                                    const precoItem = Number(item.preco ?? item.valor ?? 0);
                                    const qtdItem = Number(item.qtd ?? 1);

                                    return (
                                        <div key={i} className="revisao-produto-item">
                                            <div className="revisao-produto-linha">
                                                <span>{qtdItem}x {item.nome}</span>
                                                <span>{fmt(precoItem * qtdItem)}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="valores-box">
                            <div className="valor-linha">
                                <span>Subtotal</span>
                                <span>{fmt(totalCart)}</span>
                            </div>

                            <div className="valor-linha">
                                <span>Entrega</span>
                                <span>{fmt(frete)}</span>
                            </div>

                            <div className="valor-linha total">
                                <span>Total</span>
                                <span>{fmt(totalPedido)}</span>
                            </div>
                        </div>

                        <div className="footer-buttons">
                            <button className="btn-back" onClick={navigateBack} disabled={enviando}>
                                Voltar
                            </button>

                            <button
                                className={`btn-checkout ${enviando ? "enviando" : ""}`}
                                onClick={finalizarPedido}
                                disabled={enviando}
                            >
                                {enviando ? "Enviando..." : "Finalizar Pedido"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Checkout;