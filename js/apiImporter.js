// apiImporter.js - VERSÃO TOTALMENTE CORRIGIDA
// Lê uma SR Key, vai ao worker Cloudflare (ogapi-proxy)
// e importa: classe, classe da aliança, coords, techs, LF bónus por nave e LF bónus globais.

(() => {
  "use strict";

  // TEU WORKER CLOUDFLARE
  const WORKER_URL = "https://ogapi-proxy.m0nicker.workers.dev";

  // ✅ ORDEM CORRIGIDA: Alinhada com BASE_SHIPS do app.js
  // Índice no array DEVE corresponder ao índice em BASE_SHIPS/SHIP_LABELS
  const SHIP_IDS = [
    202, // 0  - Cargueiro Pequeno
    203, // 1  - Cargueiro Grande
    204, // 2  - Caça Ligeiro
    205, // 3  - Caça Pesado
    206, // 4  - Cruzador
    207, // 5  - Nave de Batalha
    208, // 6  - Nave de Colonização
    209, // 7  - Reciclador
    210, // 8  - Sonda de Espionagem
    211, // 9  - Bombardeiro
    212, // 10 - Satélite Solar
    213, // 11 - Destruidor
    214, // 12 - Estrela da Morte
    215, // 13 - Interceptor (Battlecruiser)
    218, // 14 - Ceifeira (Reaper)
    219  // 15 - Exploradora (Pathfinder)
  ];

  const $ = (id) => document.getElementById(id);

  function getSRKey() {
    const el = $("api-code");
    return el ? el.value.trim() : "";
  }

  function alertError(msg) {
    console.error("[apiImporter] " + msg);
    alert(msg);
  }

  function parseCoords(str) {
    if (!str || typeof str !== "string") return null;
    const parts = str.split(":").map((v) => parseInt(v, 10));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
      return null;
    }
    return parts;
  }

  async function fetchSR(token) {
    const url = `${WORKER_URL}/report/${encodeURIComponent(token)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
      },
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    return await res.json();
  }

  // ----------------------------------------------------------
  //        APLICAR DADOS GENÉRICOS (classe, coords, etc)
  // ----------------------------------------------------------

  function applyGeneric(data) {
    if (typeof window.FlightCalc === "undefined" || !window.FlightCalc.state) {
      console.warn("[apiImporter] FlightCalc.state ainda não existe.");
      return;
    }

    const state = window.FlightCalc.state;
    const g = data.generic || {};

    // Classe do jogador (defensor por omissão; se não houver, tenta atacante)
    const clsId = Number(
      g.defender_character_class_id ||
        g.attacker_character_class_id ||
        0
    );

    // OGame IDs: 1 = Coletor, 2 = General, 3 = Descobridor
    // Select values: 0 = Coletor, 1 = General, 2 = Descobridor
    let playerClass = 0;
    if (clsId === 1) playerClass = 0;      // Coletor
    else if (clsId === 2) playerClass = 1; // General
    else if (clsId === 3) playerClass = 2; // Descobridor

    state.player.class = playerClass;
    const selPlayer = $("player-class");
    if (selPlayer) selPlayer.value = String(playerClass);

    // Classe da aliança
    const aId = Number(
      g.defender_alliance_class_id ||
        g.attacker_alliance_class_id ||
        0
    );

    // OGame IDs vs Select values:
    // 0 = Nenhuma → 0
    // 2 = Traders → 1
    // 1 = Guerreiros → 2
    // 3 = Outros (tratamos como Guerreiros) → 2
    let allianceClass = 0;
    if (aId === 2) allianceClass = 1;           // Traders
    else if (aId === 1 || aId === 3) allianceClass = 2; // Guerreiros

    state.player.allianceClass = allianceClass;
    const selAlliance = $("alliance-class");
    if (selAlliance) selAlliance.value = String(allianceClass);

    // COORDENADAS: Origem = atacante, Destino = defensor (isto é uma suposição comum)
    const originStr =
      g.attacker_planet_coordinates || g.defender_planet_coordinates || "";
    const destStr =
      g.defender_planet_coordinates || g.attacker_planet_coordinates || "";

    const originInput = $("coord-origin");
    if (originInput) originInput.value = originStr;

    const destInput = $("coord-destiny");
    if (destInput) destInput.value = destStr;

    const origin = parseCoords(originStr);
    if (origin) {
      state.coords.origin = origin;
    }

    const dest = parseCoords(destStr);
    if (dest) {
      state.coords.dest = dest;
    }
  }

  // ----------------------------------------------------------
  //                   PESQUISAS (techs)
  // ----------------------------------------------------------

  function getResearchLevelFromArray(list, id) {
    if (!Array.isArray(list)) return null;
    const found = list.find((r) => r.research_type === id);
    return found ? Number(found.level) : null;
  }

  function getResearchLevel(data, id) {
    const direct = getResearchLevelFromArray(data.research, id);
    if (direct !== null) return direct;

    const ci =
      data.combatInformation ||
      (data.details && data.details.combatInformation) ||
      {};
    if (ci.researches && typeof ci.researches[id] === "number") {
      return Number(ci.researches[id]);
    }

    return 0;
  }

  function applyResearch(data) {
    const combustion = getResearchLevel(data, 115);
    const impulse = getResearchLevel(data, 117);
    const hyperspace = getResearchLevel(data, 118);
    const hyperTech = getResearchLevel(data, 114); // Tecnologia de Hiperespaço (ID 114)

    const inComb = $("tech-combustion");
    if (inComb) inComb.value = combustion;

    const inImp = $("tech-impulse");
    if (inImp) inImp.value = impulse;

    const inHyp = $("tech-hyperspace");
    if (inHyp) inHyp.value = hyperspace;

    const inHypTech = $("tech-hyperspace-tech");
    if (inHypTech) inHypTech.value = hyperTech;

    // Atualiza state diretamente
    if (window.FlightCalc && window.FlightCalc.state) {
      const state = window.FlightCalc.state;
      state.tech.combustion = combustion;
      state.tech.impulse = impulse;
      state.tech.hyperspace = hyperspace;
      state.tech.hyperTech = hyperTech;
    }
  }

  // ----------------------------------------------------------
  //            LF BÓNUS POR NAVE (speed/cargo/deut)
  // ----------------------------------------------------------

  function applyLFPerShip(data) {
    if (typeof window.FlightCalc === "undefined" || !window.FlightCalc.state) {
      console.warn("[apiImporter] FlightCalc.state ainda não existe.");
      return;
    }

    const state = window.FlightCalc.state;
    const details = data.details || {};
    const lfRoot = details.lifeformBonuses || {};
    const baseStats = lfRoot.BaseStatsBooster || null;

    const ci =
      data.combatInformation ||
      (details.combatInformation || {});

    const ciShips = ci.ships || {};

    if (!baseStats && !ciShips) {
      console.warn("[apiImporter] Sem dados de LF por nave.");
      return;
    }

    // ITERA SOBRE OS 16 TIPOS DE NAVES (0-15)
    SHIP_IDS.forEach((shipId, index) => {
      const src =
        (baseStats && baseStats[shipId]) ||
        (ciShips && ciShips[shipId]) ||
        (ciShips && ciShips[String(shipId)]) ||
        (baseStats && baseStats[String(shipId)]);

      if (!src) return;

      // Converte de decimal para percentagem
      const speedPct = Number(src.speed || 0) * 100;
      const cargoPct = Number(src.cargo || 0) * 100;
      const fuelPct = Number(src.fuel || 0) * 100;

      // Atualiza state
      state.lfBonuses[index] = [speedPct, cargoPct, fuelPct];

      // Atualiza inputs HTML
      const speedInput = $(`lf-speed-${index}`);
      if (speedInput) speedInput.value = speedPct.toFixed(3);

      const cargoInput = $(`lf-cargo-${index}`);
      if (cargoInput) cargoInput.value = cargoPct.toFixed(3);

      const deutInput = $(`lf-deut-${index}`);
      if (deutInput) deutInput.value = fuelPct.toFixed(3);
    });
  }
  
  // ----------------------------------------------------------
  //            LF BÓNUS GLOBAIS (NOVOS)
  // ----------------------------------------------------------

  function applyLFGlobal(data) {
    if (typeof window.FlightCalc === "undefined" || !window.FlightCalc.state) {
      console.warn("[apiImporter] FlightCalc.state ainda não existe.");
      return;
    }

    const state = window.FlightCalc.state;
    const details = data.details || {};
    const lfRoot = details.lifeformBonuses || {};
    
    // Mecaniq General Engineering (lfMechanGE) - Global Speed Bonus (velocidade em %)
    const lfMechanGE = Number(lfRoot.MechaniqGeneralEngineering || 0);
    
    // Rock'tal Crystal Engines (lfRocktalCE) - Global Deut Reduction Bonus (consumo em %)
    const lfRocktalCE = Number(lfRoot.RocktalCrystalEngines || 0);

    // Spatium Cargo Hold (spCargohold) - Pathfinder Cargo Bonus (carga em %)
    const lfSpCargohold = Number(lfRoot.SpatiumCargoHold || 0); 
    
    // Atualiza state
    state.tech.lfMechanGE = lfMechanGE;
    state.tech.lfRocktalCE = lfRocktalCE;
    state.tech.lfSpCargohold = lfSpCargohold;

    // Atualiza inputs HTML
    const inGE = $("lf-mechan-ge");
    if (inGE) inGE.value = lfMechanGE.toFixed(3);

    const inCE = $("lf-rocktal-ce");
    if (inCE) inCE.value = lfRocktalCE.toFixed(3);
    
    const inCH = $("lf-sp-cargohold");
    if (inCH) inCH.value = lfSpCargohold.toFixed(3);
  }


  // ----------------------------------------------------------
  //                     APLICAR TUDO
  // ----------------------------------------------------------

  function applySRData(data) {
    try {
      console.log("[apiImporter] 🚀 Iniciando import...");
      
      applyGeneric(data);
      console.log("[apiImporter] ✅ Dados genéricos aplicados");
      
      applyResearch(data);
      console.log("[apiImporter] ✅ Pesquisas aplicadas");
      
      applyLFPerShip(data);
      console.log("[apiImporter] ✅ Bónus de LF por nave aplicados");

      applyLFGlobal(data); // NOVO: Chamada para bónus LF Globais
      console.log("[apiImporter] ✅ Bónus de LF globais aplicados");


      // Recalcula tudo
      if (window.FlightCalc && typeof window.FlightCalc.recalc === "function") {
        window.FlightCalc.recalc();
        console.log("[apiImporter] ✅ Cálculos executados");
      } else {
        console.warn("[apiImporter] FlightCalc.recalc() não disponível.");
      }

      // Relatório de sucesso
      const report = {
        "Classe Jogador": ["Coletor", "General", "Descobridor"][window.FlightCalc.state.player.class],
        "Classe Aliança": ["Nenhuma", "Traders", "Guerreiros"][window.FlightCalc.state.player.allianceClass],
        "Coordenadas Origem": window.FlightCalc.state.coords.origin.join(":"),
        "Coordenadas Destino": window.FlightCalc.state.coords.dest.join(":"),
        "Motor Combustão": window.FlightCalc.state.tech.combustion,
        "Motor Impulso": window.FlightCalc.state.tech.impulse,
        "Motor Hiperespaço": window.FlightCalc.state.tech.hyperspace,
        "Tec. Hiperespaço (114)": window.FlightCalc.state.tech.hyperTech,
        "LF General Eng. (%)": window.FlightCalc.state.tech.lfMechanGE.toFixed(3),
        "LF Crystal Eng. (%)": window.FlightCalc.state.tech.lfRocktalCE.toFixed(3),
        "LF Cargo Pathfinder (%)": window.FlightCalc.state.tech.lfSpCargohold.toFixed(3),
        "Bónus LF por Nave": window.FlightCalc.state.lfBonuses.filter(b => b[0] > 0 || b[1] > 0 || b[2] > 0).length + " naves"
      };
      
      console.table(report);
      alert("✅ Dados importados com sucesso!\n\nVerifica a consola para detalhes.");
      
    } catch (err) {
      console.error("[apiImporter] ❌ Erro ao aplicar SR:", err);
      alertError("Falha ao aplicar dados da SR. Vê a consola para mais detalhes.");
    }
  }

  // ----------------------------------------------------------
  //                       HANDLERS
  // ----------------------------------------------------------

  async function handleImportJSON(ev) {
    ev && ev.preventDefault();
    const token = getSRKey();
    if (!token) {
      alertError("Introduz uma SR Key primeiro.");
      return;
    }

    const btn = ev.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "A importar...";

    try {
      const data = await fetchSR(token);
      console.log("[apiImporter] JSON recebido:", data);
      applySRData(data);
    } catch (err) {
      console.error("[apiImporter] Erro no fetch/import:", err);
      alertError("Erro ao importar SR: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  function handleOpenJSON(ev) {
    ev && ev.preventDefault();
    const token = getSRKey();
    if (!token) {
      alertError("Introduz uma SR Key primeiro.");
      return;
    }
    const url = `${WORKER_URL}/report/${encodeURIComponent(token)}`;
    window.open(url, "_blank", "noopener");
  }

  function handleImportTrashSim(ev) {
    ev && ev.preventDefault();
    alert("Import TrashSim ainda não está implementado neste importer.");
  }

  // ----------------------------------------------------------
  //                    BOOTSTRAP / EVENTOS
  // ----------------------------------------------------------

  function setupImporter() {
    const btnJson = $("api-import-json");
    const btnOpen = $("api-open");
    const btnTrash = $("api-import-trashsim");

    if (btnJson) {
      btnJson.addEventListener("click", handleImportJSON);
    }
    if (btnOpen) {
      btnOpen.addEventListener("click", handleOpenJSON);
    }
    if (btnTrash) {
      btnTrash.addEventListener("click", handleImportTrashSim);
    }

    console.log("[apiImporter] Inicializado com " + SHIP_IDS.length + " tipos de naves.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupImporter);
  } else {
    setupImporter();
  }
})();
