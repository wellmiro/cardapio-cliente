import { useEffect, useState, useContext, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar/navbar.jsx";
import api from "../../services/api.js";
import { CartContext } from "../../contexts/cart-context.jsx";
import AlertModal from "../../components/alert-modal/AlertModal.jsx";

import { MapContainer, TileLayer, Marker, useMap, LayersControl, LayerGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import "./checkout.css";

// Agrupa os adicionais escolhidos pelo nome do grupo (ex: "Tamanho", "Complementos")
function agruparAdicionais(lista = []) {
    const mapa = new Map();
    lista.forEach(a => {
        const chave = a.id_opcao ?? a.descricao_opcao ?? a.grupo ?? "";
        if (!mapa.has(chave)) {
            mapa.set(chave, { descricao: a.descricao_opcao ?? a.grupo ?? "", itens: [] });
        }
        mapa.get(chave).itens.push(a);
    });
    return Array.from(mapa.values());
}

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Posição padrão do mapa quando ainda não há localização (Pilar do Sul - SP)
const POSICAO_PADRAO = [-23.8136, -47.7156];

// Camadas do mapa: Satélite (padrão) e Mapa normal
function CamadasMapa() {
    return (
        <LayersControl position="topright">
            <LayersControl.BaseLayer name="Mapa">
                <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer checked name="Satélite">
                <LayerGroup>
                    <TileLayer
                        attribution="Tiles &copy; Esri"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxZoom={19}
                    />
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        maxZoom={19}
                    />
                </LayerGroup>
            </LayersControl.BaseLayer>
        </LayersControl>
    );
}

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

function formatarCPF(v) {
    const nums = String(v).replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

// ===== Pix pendente (sobrevive a reload / aba descartada pelo navegador do celular) =====
const PIX_PENDENTE_KEY = "pix_pendente";
const PIX_PENDENTE_TTL_MS = 60 * 60 * 1000; // 1 hora

function salvarPixPendente(dados) {
    try {
        localStorage.setItem(PIX_PENDENTE_KEY, JSON.stringify({ ...dados, criadoEm: Date.now() }));
    } catch (e) {
        console.error("Não foi possível salvar o Pix pendente:", e);
    }
}

function lerPixPendente() {
    try {
        const bruto = localStorage.getItem(PIX_PENDENTE_KEY);
        if (!bruto) return null;

        const dados = JSON.parse(bruto);
        if (!dados?.mpPaymentId || Date.now() - (dados.criadoEm || 0) > PIX_PENDENTE_TTL_MS) {
            localStorage.removeItem(PIX_PENDENTE_KEY);
            return null;
        }
        return dados;
    } catch (e) {
        localStorage.removeItem(PIX_PENDENTE_KEY);
        return null;
    }
}

function limparPixPendente() {
    try {
        localStorage.removeItem(PIX_PENDENTE_KEY);
    } catch (e) { /* ignora */ }
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
    const [pedidoBloqueado, setPedidoBloqueado] = useState(false);

    // Trava SÍNCRONA contra duplo clique
    const envioEmAndamentoRef = useRef(false);
    // Chave de idempotência
    const idempotencyKeyRef = useRef(null);
    const [step, setStep] = useState(1);

    const [configFrete, setConfigFrete] = useState({
        latOrigem: null,
        lngOrigem: null,
        taxaBase: 0,
        precoKm: 1
    });

    const [configCarregada, setConfigCarregada] = useState(false);
    const [idEstabelecimento, setIdEstabelecimento] = useState(null);

    const [somenteRetirada, setSomenteRetirada] = useState(false);

    const [nome, setNome] = useState("");
    const [fone, setFone] = useState("");
    const [email, setEmail] = useState("");
    const [cpf, setCpf] = useState("");

    const [tipoEntrega, setTipoEntrega] = useState(null);

    const [entregaEtapa, setEntregaEtapa] = useState("metodo");
    const [metodoEntrega, setMetodoEntrega] = useState("endereco");
    const [enderecoConfirmado, setEnderecoConfirmado] = useState(false);

    const [posicao, setPosicao] = useState(null);
    const [frete, setFrete] = useState(0);
    // Frete calculado pelo backend (/cardapio_digital/:slug/frete)
    const [freteCalculado, setFreteCalculado] = useState(false);
    const [calculandoFrete, setCalculandoFrete] = useState(false);
    const [freteInfo, setFreteInfo] = useState(null); // { origem, zona, distancia_km }
    const freteReqRef = useRef(0); // ignora respostas antigas se o pino for arrastado várias vezes
    const sugestoesReqRef = useRef(0); // ignora sugestões antigas enquanto o cliente digita

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

    const [pagamento, setPagamento] = useState("pix");
    const [tipoCartao, setTipoCartao] = useState("");
    const [dinheiro, setDinheiro] = useState("");

    // Estados do Mercado Pago (PIX)
    const [pixGerado, setPixGerado] = useState(false);
    const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");
    const [pixCopiaECola, setPixCopiaECola] = useState("");
    const [mpPaymentId, setMpPaymentId] = useState(null);
    const [copiado, setCopiado] = useState(false);

    // Notificação do Pix fica GUARDADA aqui e só é enviada depois que o pagamento for aprovado
    const notificacaoPixRef = useRef(null);
    const pixConfirmadoRef = useRef(false);

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

                const res = await api.get(`/estabelecimentos/${slugAtual}`);
                const dadosLoja = res.data || {};

                setIdEstabelecimento(dadosLoja.id_estabelecimento || null);

                const latOrigem = parseCoord(dadosLoja.latitude);
                const lngOrigem = parseCoord(dadosLoja.longitude);
                const taxaBase = parseCoord(dadosLoja.taxa_base) || 0;
                const precoKmBanco = parseCoord(dadosLoja.preco_km) || 0;
                const precoKm = precoKmBanco > 0 ? precoKmBanco : 1;

                setConfigFrete({
                    latOrigem,
                    lngOrigem,
                    taxaBase,
                    precoKm
                });

                const semNenhumaConfigDeEntrega =
                    latOrigem === null &&
                    lngOrigem === null &&
                    taxaBase <= 0 &&
                    precoKmBanco <= 0;

                if (semNenhumaConfigDeEntrega) {
                    setSomenteRetirada(true);
                    setTipoEntrega("retirada");
                }

                if (latOrigem !== null && lngOrigem !== null) {
                    setPosicao([latOrigem, lngOrigem]);
                }

                // O frete só é calculado (pelo backend) depois que o cliente confirmar a localização.
            } catch (err) {
                console.error("Erro ao carregar configurações de entrega", err);
            } finally {
                setConfigCarregada(true);
            }
        }

        carregarConfiguracoesLoja();
    }, []);

    // Refs de apoio ao monitoramento do Pix
    const verificandoDesdeRef = useRef(0);
    const ultimoRetornoRef = useRef(0);
    const redirectTimerRef = useRef(null);

    // Restaura um Pix pendente se a página foi recarregada / descartada no celular
    useEffect(() => {
        const pendente = lerPixPendente();
        if (!pendente) return;

        const slugAtual = localStorage.getItem("slug");
        if (pendente.slug && slugAtual && pendente.slug !== slugAtual) return;

        pixConfirmadoRef.current = false;
        notificacaoPixRef.current = pendente.notificacao || null;
        envioEmAndamentoRef.current = true;

        setPagamento("pix");
        setPixQrCodeBase64(pendente.qrBase64 || "");
        setPixCopiaECola(pendente.copiaECola || "");
        setMpPaymentId(pendente.mpPaymentId);
        setPedidoBloqueado(true);
        setPixGerado(true);
        setStep(4);
    }, []);

    // Limpa o timer de redirecionamento ao sair da tela
    useEffect(() => {
        return () => {
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        };
    }, []);

    // Pix aprovado: notifica (uma única vez), limpa sacola e leva pro histórico
    const finalizarPixAprovado = useCallback(async () => {
        // trava síncrona: várias verificações podem voltar juntas
        if (pixConfirmadoRef.current) return;
        pixConfirmadoRef.current = true;

        // O servidor já cria a notificação ao confirmar o Pix; aqui é só reforço.
        // A rota /notificacoes/publico ignora duplicadas.
        if (notificacaoPixRef.current) {
            try {
                await api.post("/notificacoes/publico", notificacaoPixRef.current);
            } catch (errNotif) {
                console.error("Erro ao enviar notificação do Pix:", errNotif.response?.data || errNotif);
            }
            notificacaoPixRef.current = null;
        }

        limparPixPendente();
        setCartItems([]);
        setTotalCart(0);
        setShowSucesso(true);

        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = setTimeout(() => {
            navigate("/historico", { replace: true });
        }, 2500);
    }, [navigate, setCartItems, setTotalCart]);

    // Consulta o status do Pix. force=true ignora a trava de "consulta em andamento"
    // (no celular uma requisição pode ficar pendurada quando o navegador vai pra segundo plano).
    const verificarPix = useCallback(async (force = false) => {
        if (!mpPaymentId || pixConfirmadoRef.current) return;

        const agora = Date.now();
        if (!force && agora - verificandoDesdeRef.current < 4000) return;
        verificandoDesdeRef.current = agora;

        try {
            const res = await api.get(`/pix/status/${mpPaymentId}`, {
                timeout: 10000,
                params: { _t: agora }
            });

            if (res.data?.pago || res.data?.status === "approved") {
                await finalizarPixAprovado();
            }
        } catch (err) {
            console.error("Erro ao verificar status do Pix:", err);
        } finally {
            verificandoDesdeRef.current = 0;
        }
    }, [mpPaymentId, finalizarPixAprovado]);

    // Polling a cada 3s + verificação imediata quando o cliente volta do app do banco
    useEffect(() => {
        if (!pixGerado || !mpPaymentId) return;

        const timers = [];

        verificarPix(true);
        const interval = setInterval(() => verificarPix(false), 3000);

        const aoVoltar = () => {
            if (document.visibilityState === "hidden") return;

            // visibilitychange + focus + pageshow costumam disparar juntos
            const agora = Date.now();
            if (agora - ultimoRetornoRef.current < 800) return;
            ultimoRetornoRef.current = agora;

            verificarPix(true);
            // a rede do celular pode demorar a voltar: reforça algumas tentativas
            timers.push(setTimeout(() => verificarPix(true), 1500));
            timers.push(setTimeout(() => verificarPix(true), 4000));
        };

        document.addEventListener("visibilitychange", aoVoltar);
        window.addEventListener("focus", aoVoltar);
        window.addEventListener("pageshow", aoVoltar);
        window.addEventListener("online", aoVoltar);

        return () => {
            clearInterval(interval);
            timers.forEach(clearTimeout);
            document.removeEventListener("visibilitychange", aoVoltar);
            window.removeEventListener("focus", aoVoltar);
            window.removeEventListener("pageshow", aoVoltar);
            window.removeEventListener("online", aoVoltar);
        };
    }, [pixGerado, mpPaymentId, verificarPix]);

    const alerta = (msg, tipo = "erro") => {
        setMsgAlert(msg);
        setTipoAlert(tipo);
        setShowAlert(true);
    };

    function limparFrete() {
        freteReqRef.current += 1; // invalida qualquer consulta em andamento
        setFrete(0);
        setFreteCalculado(false);
        setFreteInfo(null);
        setCalculandoFrete(false);
    }

    // Consulta o frete no backend (motoboy/zonas/regra do estabelecimento).
    async function calcularFreteBackend(lat, lng) {
        const slugAtual = localStorage.getItem("slug");
        const reqId = ++freteReqRef.current;

        setFreteCalculado(false);
        setFreteInfo(null);

        if (!slugAtual) {
            setCalculandoFrete(false);
            return false;
        }

        setCalculandoFrete(true);

        try {
            const res = await api.get(`/cardapio_digital/${slugAtual}/frete`, {
                params: { lat, lng }
            });

            if (reqId !== freteReqRef.current) return false;

            const valor = Number(res.data?.valor);

            if (!Number.isFinite(valor) || valor < 0) {
                throw new Error("Resposta de frete inválida");
            }

            const distancia = Number(res.data?.distancia_km);

            setFrete(valor);
            setFreteInfo({
                origem: res.data?.origem || null,
                zona: res.data?.zona || null,
                distancia_km: Number.isFinite(distancia) ? distancia : null
            });
            setFreteCalculado(true);
            return true;
        } catch (err) {
            if (reqId !== freteReqRef.current) return false;

            console.error("Erro ao calcular frete", err?.response?.data || err);
            setFrete(0);
            setFreteInfo(null);
            setFreteCalculado(false);
            return false;
        } finally {
            if (reqId === freteReqRef.current) setCalculandoFrete(false);
        }
    }

    function rolarParaMapa(ref) {
        setTimeout(() => {
            ref.current?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }, 150);
    }

    // preferido: valores vindos da sugestão escolhida (têm prioridade quando existem)
    async function aplicarCoordenadas(lat, lng, origem = "mapa", preferido = {}) {
        setPosicao([lat, lng]);
        setEnderecoConfirmado(true);

        // dispara o cálculo do frete no backend sem travar o reverse geocode
        calcularFreteBackend(lat, lng);

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            const data = await res.json();

            if (data.address) {
                setEndereco(data.address.road || data.address.pedestrian || preferido.endereco || endereco);
                setBairro(preferido.bairro || data.address.suburb || data.address.neighbourhood || bairro);
                setCidade(data.address.city || data.address.town || data.address.village || preferido.cidade || cidade);
                setUf(estadoParaUf(data.address) || preferido.uf || uf);
            }
        } catch (e) {
            console.error("Erro reverse geocode", e);
        }

        if (origem !== "drag") {
            rolarParaMapa(mapaPreviewRef);
        }
    }

    // Fallback silencioso: Nominatim, normalizado para o mesmo formato do backend
    async function buscarSugestoesNominatim(texto) {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=br&limit=5&q=${encodeURIComponent(texto)}`
        );

        const data = await res.json();

        return (Array.isArray(data) ? data : []).map(item => {
            const addr = item.address || {};
            const partes = String(item.display_name || "").split(",").map(p => p.trim());
            const rua = addr.road || addr.pedestrian || partes[0] || "";

            return {
                principal: rua,
                secundario: partes.slice(1).join(", "),
                bairro: addr.suburb || addr.neighbourhood || "",
                cidade: addr.city || addr.town || addr.village || "",
                uf: estadoParaUf(addr),
                label: item.display_name || rua,
                lat: item.lat,
                lng: item.lon
            };
        });
    }

    async function buscarSugestoesEndereco(texto) {
        if (!texto || texto.trim().length < 3) {
            sugestoesReqRef.current += 1;
            setSugestoesEndereco([]);
            return;
        }

        const reqId = ++sugestoesReqRef.current;
        setBuscandoSugestoes(true);

        try {
            let lista = [];

            try {
                const res = await api.get("/geocode/buscar", {
                    params: {
                        q: texto.trim(),
                        lat: configFrete.latOrigem,
                        lng: configFrete.lngOrigem
                    }
                });

                lista = Array.isArray(res.data) ? res.data : [];
            } catch (errBackend) {
                console.error("Erro em /geocode/buscar, usando Nominatim", errBackend?.response?.data || errBackend);
                lista = await buscarSugestoesNominatim(texto.trim());
            }

            if (reqId !== sugestoesReqRef.current) return;
            setSugestoesEndereco(lista);
        } catch (e) {
            if (reqId !== sugestoesReqRef.current) return;
            console.error("Erro ao buscar sugestões de endereço", e);
            setSugestoesEndereco([]);
        } finally {
            if (reqId === sugestoesReqRef.current) setBuscandoSugestoes(false);
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
        const lng = parseFloat(sugestao.lng ?? sugestao.lon);

        if (isNaN(lat) || isNaN(lng)) return;

        const ruaSugestao = sugestao.principal || "";
        const bairroSugestao = sugestao.bairro || "";
        const cidadeSugestao = sugestao.cidade || "";
        const ufSugestao = sugestao.uf || "";

        setMetodoEntrega("endereco");
        setEnderecoBusca(sugestao.label || [sugestao.principal, sugestao.secundario].filter(Boolean).join(", "));
        setMostrarSugestoes(false);
        setSugestoesEndereco([]);

        setEndereco(ruaSugestao);
        setBairro(bairroSugestao);
        if (cidadeSugestao) setCidade(cidadeSugestao);
        if (ufSugestao) setUf(ufSugestao);

        await aplicarCoordenadas(lat, lng, "mapa", {
            endereco: ruaSugestao,
            bairro: bairroSugestao,
            cidade: cidadeSugestao,
            uf: ufSugestao
        });
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
                limparFrete();
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

        if (!tipoEntrega) {
            alerta("Escolha se o pedido é para entrega ou retirada no local.");
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

        if (calculandoFrete) {
            alerta("Aguarde um instante, estamos calculando a taxa de entrega.");
            return;
        }

        // frete 0 é válido (ex.: entrega grátis numa zona), desde que o backend tenha confirmado o cálculo
        if (!freteCalculado || !Number.isFinite(frete) || frete < 0) {
            alerta("Não foi possível calcular a entrega. Confira a localização no mapa.");
            return;
        }

        setEntregaEtapa("detalhes");
        rolarParaMapa(mapaDetalhesRef);
    }

    function validarStep2() {
        if (tipoEntrega === "retirada") return true;

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
        if (step === 1) {
            if (!validarStep1()) return;

            if (tipoEntrega === "retirada") {
                limparFrete();
                setEnderecoConfirmado(true);
                setStep(3);
                return;
            }

            setStep(2);
            return;
        }

        if (step === 2 && !validarStep2()) return;
        if (step === 3 && !validarStep3()) return;

        setStep(s => Math.min(s + 1, 4));
    };

    const navigateBack = () => {
        if (step === 3 && tipoEntrega === "retirada") {
            setStep(1);
            return;
        }

        if (step === 2 && entregaEtapa === "detalhes") {
            setEntregaEtapa("metodo");
            return;
        }

        setStep(s => Math.max(s - 1, 1));
    };

    // Monta o payload da notificação (sem enviar)
    function montarPayloadNotificacao(enderecoCompleto, idPedido) {
        let formaPagamentoTexto = "PIX";

        if (pagamento === "cartao") {
            formaPagamentoTexto = `Cartao (${tipoCartao === "credito" ? "Credito" : "Debito"})`;
        } else if (pagamento === "dinheiro") {
            formaPagamentoTexto = "Dinheiro";
        }

        const nomeFormatado = formatarNomeProprio(nome);

        const itensResumo = cartItems
            .map(item => {
                const qtd = Number(item.qtd ?? 1);
                const linhasAdic = (item.adicionais || [])
                    .map(a => `   - ${a.nome_formatado ?? a.nome ?? a.nome_item}`)
                    .join("\n");
                return linhasAdic
                    ? `${qtd}x ${item.nome}\n${linhasAdic}`
                    : `${qtd}x ${item.nome}`;
            })
            .join("\n");

        const linhaEndereco = tipoEntrega === "retirada"
            ? "RETIRADA NO LOCAL"
            : `Endereco:\n${enderecoCompleto}`;

        const vlEntregaNotif = tipoEntrega === "retirada" ? 0 : frete;

        const mensagem =
            `NOVO PEDIDO #${idPedido}\n\n` +
            `Cliente: ${nomeFormatado}\n` +
            `WhatsApp: ${fone}\n\n` +
            `Itens:\n${itensResumo}\n\n` +
            `Total: ${fmt(totalCart + vlEntregaNotif)}\n` +
            `Pagamento: ${formaPagamentoTexto}\n\n` +
            `${linhaEndereco}`;

        return {
            id_estabelecimento: idEstabelecimento,
            mensagem,
            id_pedido: idPedido,
            id_produto: null
        };
    }

    // Envia na hora (usado só por Dinheiro / Cartão na entrega)
    async function enviarNotificacaoNovoPedidoDireto(enderecoCompleto, idPedido) {
        try {
            const payload = montarPayloadNotificacao(enderecoCompleto, idPedido);
            await api.post("/notificacoes/publico", payload);
        } catch (err) {
            console.error("=== ERRO AO ENVIAR NOTIFICACAO ===");
            console.error(err.response?.data || err);
        }
    }

    async function finalizarPedido() {
        if (envioEmAndamentoRef.current || enviando || pedidoBloqueado) return;

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

        envioEmAndamentoRef.current = true;
        setEnviando(true);
        setPedidoBloqueado(true);

        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = crypto.randomUUID();
        }

        try {
            let forma_pagamento = pagamento === "pix" ? "PIX (Online)" : pagamento;

            if (pagamento === "cartao") {
                forma_pagamento = `Cartão (${tipoCartao})`;
            }

            const nomeFormatado = formatarNomeProprio(nome);
            const ehRetirada = tipoEntrega === "retirada";

            const enderecoCompleto = ehRetirada
                ? "Retirada no estabelecimento"
                : [
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
                    observacao: i.observacao,
                    adicionais: i.adicionais || []
                };
            });

            const vlEntrega = ehRetirada ? 0 : frete;
            const vlTotalFinal = totalCart + vlEntrega;

            const payload = {
                slug: slugAtual,
                session_id,
                idempotency_key: idempotencyKeyRef.current,
                nome_cliente: nomeFormatado,
                fone_cliente: fone,
                vl_subtotal: totalCart,
                vl_entrega: vlEntrega,
                vl_total: vlTotalFinal,
                endereco_entrega: ehRetirada
                    ? enderecoCompleto
                    : enderecoCompleto + (referencia ? ` | Ref: ${referencia}` : ""),
                rota: (!ehRetirada && posicao) ? `https://www.google.com/maps?q=${posicao[0]},${posicao[1]}` : "",
                forma_pagamento,
                dinheiro: pagamento === "dinheiro" ? Number(dinheiro) : 0,
                troco: pagamento === "dinheiro" ? Number(dinheiro) - vlTotalFinal : 0,
                local_consumo: ehRetirada ? "RETIRADA" : "DELIVERY",
                itens: itensPedido
            };

            // FLUXO DO PIX ONLINE (Agora envia slug e id_estabelecimento dinâmicos)
            if (pagamento === "pix") {
                const emailCliente = email || `${fone.replace(/\D/g, "")}@cliente99burger.com`;

                const pixRes = await api.post("/pix/gerar", {
                    id_pedido: 0,
                    slug: slugAtual,
                    id_estabelecimento: idEstabelecimento,
                    transaction_amount: vlTotalFinal,
                    description: `Pedido 99Burger - ${nomeFormatado}`,
                    payer: {
                        email: emailCliente,
                        first_name: nomeFormatado,
                        cpf: cpf.replace(/\D/g, "")
                    }
                });

                const paymentId = pixRes.data.mp_payment_id;

                const payloadComMpId = { ...payload, mp_payment_id: paymentId };
                const respostaPedido = await api.post("/pedidos/publico", payloadComMpId);
                const idPed = respostaPedido.data.id_pedido;

                // NÃO notifica agora: só guarda. O envio acontece quando o Pix for aprovado.
                pixConfirmadoRef.current = false;
                notificacaoPixRef.current = montarPayloadNotificacao(enderecoCompleto, idPed);

                setPixQrCodeBase64(pixRes.data.mp_qr_code_base64);
                setPixCopiaECola(pixRes.data.mp_qr_code);
                setMpPaymentId(paymentId);

                salvarPixPendente({
                    mpPaymentId: paymentId,
                    idPedido: idPed,
                    slug: slugAtual,
                    qrBase64: pixRes.data.mp_qr_code_base64,
                    copiaECola: pixRes.data.mp_qr_code,
                    notificacao: notificacaoPixRef.current
                });

                setPixGerado(true);
                setEnviando(false);
                return;
            }

            // FLUXO DE OUTROS PAGAMENTOS (Dinheiro / Cartão na entrega)
            const respostaPedido = await api.post("/pedidos/publico", payload);
            const idPed = respostaPedido.data.id_pedido;

            await enviarNotificacaoNovoPedidoDireto(enderecoCompleto, idPed);

            setCartItems([]);
            setTotalCart(0);
            setShowSucesso(true);
        } catch (err) {
            alerta(err?.response?.data?.error || "Erro ao enviar pedido. Tente novamente.");
            if (err?.response) {
                idempotencyKeyRef.current = null;
            }
            envioEmAndamentoRef.current = false;
            setEnviando(false);
            setPedidoBloqueado(false);
        }
    }

    const irParaHistorico = () => {
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        navigate("/historico", { replace: true });
    };

    const copiarChavePix = () => {
        navigator.clipboard.writeText(pixCopiaECola);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
    };

    const STEPS = ["Dados", "Entrega", "Pagamento", "Revisão"];
    const totalPedido = totalCart + (tipoEntrega === "retirada" ? 0 : frete);

    const renderFreteBadge = () => (
        <>
            <div className="frete-badge">
                Taxa de entrega:{" "}
                <strong>
                    {calculandoFrete ? "Calculando..." : freteCalculado ? fmt(frete) : "A calcular"}
                </strong>

                {freteCalculado && freteInfo?.origem === "fixo" && (
                    <span className="tag-info" style={{ marginLeft: 6 }}>fixa</span>
                )}

                {freteCalculado && freteInfo?.zona && (
                    <span className="tag-info" style={{ marginLeft: 6 }}>{freteInfo.zona}</span>
                )}

                {freteCalculado && Number.isFinite(freteInfo?.distancia_km) && (
                    <span className="tag-info" style={{ marginLeft: 6 }}>
                        {freteInfo.distancia_km.toFixed(1).replace(".", ",")} km
                    </span>
                )}
            </div>

            {enderecoConfirmado && !calculandoFrete && !freteCalculado && (
                <div className="frete-aviso">
                    Não conseguimos calcular a taxa para este local. Ajuste o pino no mapa e tente de novo.
                </div>
            )}
        </>
    );

    const stepVisual = (tipoEntrega === "retirada" && step >= 3) ? step - 1 : step;

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
                <ModalSucesso onClose={irParaHistorico} />
            )}

            <div className="checkout-wrapper">
                <div className="stepper">
                    {STEPS.map((label, i) => {
                        const num = i + 1;
                        const done = stepVisual > num;
                        const active = stepVisual === num;

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

                        <div className="input-group espacamento-top">
                            <label>CPF <span className="opcional">(opcional - para identificação do Pix)</span></label>
                            <input
                                value={cpf}
                                onChange={e => setCpf(formatarCPF(e.target.value))}
                                placeholder="000.000.000-00"
                                maxLength={14}
                            />
                        </div>

                        <div className="input-group espacamento-top">
                            <label>E-mail <span className="opcional">(opcional - para comprovante Pix)</span></label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="exemplo@email.com"
                            />
                        </div>

                        <div className="input-group espacamento-top">
                            <label>Como você quer receber seu pedido? <span className="obrig">*</span></label>

                            {somenteRetirada ? (
                                <p className="campo-dica-erro" style={{ color: "inherit" }}>
                                    Este estabelecimento funciona apenas por retirada no local.
                                </p>
                            ) : (
                                <div className="payment-selector">
                                    <button
                                        type="button"
                                        className={`pay-btn ${tipoEntrega === "entrega" ? "active" : ""}`}
                                        onClick={() => {
                                            setTipoEntrega("entrega");
                                            if (!freteCalculado) setEnderecoConfirmado(false);
                                        }}
                                    >
                                        Entrega
                                    </button>

                                    <button
                                        type="button"
                                        className={`pay-btn ${tipoEntrega === "retirada" ? "active" : ""}`}
                                        onClick={() => setTipoEntrega("retirada")}
                                    >
                                        Retirada no local
                                    </button>
                                </div>
                            )}
                        </div>

                        <button className="btn-checkout espacamento-top" onClick={navigateNext}>
                            Continuar
                        </button>
                    </div>
                )}

                {step === 2 && tipoEntrega === "entrega" && entregaEtapa === "metodo" && (
                    <div className="box-checkout">
                        <h3 className="box-title">Entrega</h3>

                        {renderFreteBadge()}

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
                                                    key={`${s.lat}-${s.lng}-${i}`}
                                                    className="sugestao-item"
                                                    onMouseDown={() => selecionarSugestaoEndereco(s)}
                                                >
                                                    <strong>{s.principal || s.label}</strong>
                                                    {(s.secundario || s.bairro) && (
                                                        <span style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>
                                                            {s.secundario || s.bairro}
                                                        </span>
                                                    )}
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
                                            center={posicao || POSICAO_PADRAO}
                                            zoom={16}
                                            style={{ height: "230px", width: "100%" }}
                                        >
                                            <CamadasMapa />

                                            <MapRefresher center={posicao} />

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

                {step === 2 && tipoEntrega === "entrega" && entregaEtapa === "detalhes" && (
                    <div className="box-checkout">
                        <h3 className="box-title">Conferir entrega</h3>

                        {renderFreteBadge()}

                        <div className="loc-opcao" ref={mapaDetalhesRef}>
                            <div className="loc-opcao-titulo">Ajuste fino no mapa</div>

                            <div className="mapa-container" style={{ position: "relative" }}>
                                <MapContainer
                                    center={posicao || POSICAO_PADRAO}
                                    zoom={16}
                                    style={{ height: "100%", width: "100%" }}
                                >
                                    <CamadasMapa />

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
                                { id: "pix", label: "PIX Online" },
                                { id: "cartao", label: "Cartão (Entrega)" },
                                { id: "dinheiro", label: "Dinheiro (Entrega)" }
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

                        {pagamento === "pix" && (
                            <div className="pix-info espacamento-top">
                                O QR Code Pix será gerado após você clicar em <strong>Revisar Pedido</strong> e confirmar no final.
                            </div>
                        )}

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

                        {!pixGerado ? (
                            <>
                                <div className="revisao-secao">
                                    <p><strong>{formatarNomeProprio(nome)}</strong> — {fone}</p>
                                    {tipoEntrega === "retirada" ? (
                                        <p><strong>Retirada no estabelecimento</strong></p>
                                    ) : (
                                        <>
                                            <p>{endereco}, {numero} {complemento && `- ${complemento}`}</p>
                                            <p>{bairro} - {cidade}/{uf}</p>
                                        </>
                                    )}
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

                                                    {(item.adicionais || []).length > 0 && (
                                                        <div className="revisao-adicionais-lista">
                                                            {agruparAdicionais(item.adicionais).map((grupo, gi) => (
                                                                <div key={gi} className="revisao-grupo">
                                                                    {grupo.descricao && (
                                                                        <span className="revisao-grupo-titulo">{grupo.descricao}</span>
                                                                    )}
                                                                    {grupo.itens.map((a, ai) => {
                                                                        const vl = Number(a.vl_item ?? a.valor ?? 0) * Number(a.qtd_item ?? 1);
                                                                        return (
                                                                            <div key={ai} className="revisao-adicional-linha">
                                                                                <span>+ {a.nome_formatado ?? a.nome ?? a.nome_item}</span>
                                                                                <span>{vl > 0 ? fmt(vl) : "incluso"}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {(item.removidos || []).map((r, ri) => (
                                                        <p key={ri} className="revisao-obs">SEM {String(r).toUpperCase()}</p>
                                                    ))}

                                                    {(() => {
                                                        const obsCliente = item.obs_cliente !== undefined
                                                            ? item.obs_cliente
                                                            : ((item.adicionais || []).length > 0 ? "" : item.observacao);
                                                        return obsCliente ? <p className="revisao-obs">Obs: {obsCliente}</p> : null;
                                                    })()}
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
                                        <span>{tipoEntrega === "retirada" ? "Grátis (retirada)" : fmt(frete)}</span>
                                    </div>

                                    <div className="valor-linha total">
                                        <span>Total</span>
                                        <span>{fmt(totalPedido)}</span>
                                    </div>
                                </div>

                                <div className="footer-buttons">
                                    <button className="btn-back" onClick={navigateBack} disabled={enviando || pedidoBloqueado}>
                                        Voltar
                                    </button>

                                    <button
                                        className={`btn-checkout ${enviando ? "enviando" : ""}`}
                                        onClick={finalizarPedido}
                                        disabled={enviando || pedidoBloqueado}
                                    >
                                        {enviando ? (
                                            <>
                                                <span className="spinner"></span> Gerando Pedido...
                                            </>
                                        ) : (
                                            pagamento === "pix" ? "Gerar Pix e Pagar" : "Finalizar Pedido"
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="pix-box-container">
                                <h4 className="pix-titulo">Aguardando Pagamento Pix</h4>
                                <p className="pix-subtitulo">
                                    Escaneie o QR Code ou copie o código abaixo para pagar no seu aplicativo do banco.
                                </p>

                                <div className="pix-qr-wrapper">
                                    <img
                                        src={`data:image/jpeg;base64,${pixQrCodeBase64}`}
                                        alt="QR Code Pix"
                                        className="pix-qr-img"
                                    />
                                </div>

                                <div className="pix-copia-cola-wrapper">
                                    <textarea
                                        readOnly
                                        value={pixCopiaECola}
                                        className="pix-textarea"
                                    />
                                    <button
                                        type="button"
                                        className={`btn-checkout ${copiado ? "btn-copiado" : ""}`}
                                        onClick={copiarChavePix}
                                    >
                                        {copiado ? "Copiado com Sucesso! ✓" : "Copiar Chave Pix"}
                                    </button>
                                </div>

                                <div className="pix-status-loading">
                                    <span className="spinner-pix"></span>
                                    <span>Identificando pagamento automaticamente...</span>
                                </div>

                                <button
                                    type="button"
                                    className="btn-back"
                                    style={{ marginTop: 12 }}
                                    onClick={() => verificarPix(true)}
                                >
                                    Já paguei, verificar agora
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Checkout;