// FlightCalc - lógica principal da calculadora de voo
// VERSÃO COMPLETA: Inclui importação de servers.json e lógica Lifeform

// =========================
// 1. Estado base
// =========================

const SHIP_KEYS = [
  "smallCargo",
  "largeCargo",
  "lightFighter",
  "heavyFighter",
  "cruiser",
  "battleship",
  "colonyShip",
  "recycler",
  "espProbe",
  "bomber",
  "solarSatellite",
  "destroyer",
  "deathstar",
  "battlecruiser",
  "reaper",
  "pathfinder"
];

const SHIP_LABELS = [
  "Pequeno Cargueiro",
  "Grande Cargueiro",
  "Caça Ligeiro",
  "Caça Pesado",
  "Cruzador",
  "Nave de Batalha",
  "Nave de Colonização",
  "Reciclador",
  "Sonda de Espionagem",
  "Bombardeiro",
  "Satélite Solar",
  "Destruidor",
  "Estrela da Morte",
  "Interceptor",
  "Ceifeiro",
  "Explorador"
];

// Dados base das naves: [key, baseSpeed, drive, deut, cargo]
const BASE_SHIPS = [
  { key: "smallCargo",    baseSpeed: 5000,   drive: 0, deut: 10,   cargo: 5000 },
  { key: "largeCargo",    baseSpeed: 7500,   drive: 0, deut: 50,   cargo: 25000 },
  { key: "lightFighter",  baseSpeed: 12500,  drive: 0, deut: 20,   cargo: 50 },
  { key: "heavyFighter",  baseSpeed: 10000,  drive: 1, deut: 75,   cargo: 100 },
  { key: "cruiser",       baseSpeed: 15000,  drive: 1, deut: 300,  cargo: 800 },
  { key: "battleship",    baseSpeed: 10000,  drive: 2, deut: 1000, cargo: 1500 },
  { key: "colonyShip",    baseSpeed: 2500,   drive: 0, deut: 1000, cargo: 75000 },
  { key: "recycler",      baseSpeed: 2000,   drive: 0, deut: 300,  cargo: 20000 },
  { key: "espProbe",      baseSpeed: 100000000, drive: 0, deut: 1, cargo: 0 },
  { key: "bomber",        baseSpeed: 5000,   drive: 1, deut: 700,  cargo: 500 },
  { key: "solarSatellite", baseSpeed: 0,     drive: 0, deut: 0,    cargo: 0 },
  { key: "destroyer",     baseSpeed: 5000,   drive: 2, deut: 1000, cargo: 2000 },
  { key: "deathstar",     baseSpeed: 100,    drive: 2, deut: 0.1,  cargo: 1000000 },
  { key: "battlecruiser", baseSpeed: 10000,  drive: 2, deut: 250,  cargo: 750 },
  { key: "reaper",        baseSpeed: 7000,   drive: 2, deut: 700,  cargo: 10000 },
  { key: "pathfinder",    baseSpeed: 12000,  drive: 0, deut: 300,  cargo: 10000 }
];

let state = {
  // Configuração do Universo (preenchida por servers.json)
  universe: {
    speed: 1,
    fleetSpeedPeaceful: 1,
    fleetSpeedWar: 1,
    fleetSpeedHolding: 1,
    galaxies: 9,
    systems: 499,
    donutGalaxy: false,
    donutSystem: false,
  },
  // Techs do Jogador (preenchida pelos inputs)
  techs: {
    combustion: 0,
    impulse: 0,
    hyperspace: 0,
    hyperspaceTech: 0,
  },
  // Bónus de Lifeform (por nave)
  lfBonuses: Array(16).fill({ speed: 0, cargo: 0, deut: 0 }),
  // Bónus Globais de Lifeform (adicionado)
  lfGlobalBonuses: {
    lfMechanGE: 0, // General Engineering (Speed)
    lfRocktalCE: 0, // Crystal Engines (Deut reduction)
    lfSpCargohold: 0, // Pathfinder Cargohold
  },
  // Frota
  fleet: Array(16).fill(0),
  // Configuração de Voo
  flight: {
    playerClass: 0, // 0: Coletor, 1: General, 2: Descobridor
    allianceClass: 0, // 0: Nenhuma, 1: Traders, 2: Guerreiros
    origin: { g: 1, s: 1, p: 1 },
    destiny: { g: 1, s: 1, p: 1 },
    missionType: "peaceful", // "peaceful", "war", "holding"
    speedPercent: 100,
    universeSpeedOverride: 0, // 0: usar por missão, >0: override
  },
};

// =========================
// 2. Variáveis Globais de Configuração
// =========================

const SERVER_CONFIG_PATH = "./servers.json";
let ALL_SERVERS = [];
let COMMUNITY_DATA = {}; // { 'pt': [{uni1}, {uni2}], 'en': [...] }

// =========================
// 3. Funções Utilitárias
// =========================

const $ = (id) => document.getElementById(id);
const getNumber = (id) => parseFloat($(id)?.value || 0) || 0;
const setText = (id, text) => {
  const el = $(id);
  if (el) el.textContent = text;
};

// Formatação para Deutério ou Carga
const formatNumber = (num) => {
  if (num === 0) return "0";
  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum >= 1000000000) return sign + (absNum / 1000000000).toFixed(1).replace(/\.0$/, '') + ' B';
  if (absNum >= 1000000) return sign + (absNum / 1000000).toFixed(1).replace(/\.0$/, '') + ' M';
  if (absNum >= 1000) return sign + (absNum / 1000).toFixed(1).replace(/\.0$/, '') + ' K';

  return sign + Math.round(absNum).toLocaleString('pt-PT');
};

// =========================
// 4. Lógica de População e Configuração do Universo (NOVO!)
// =========================

function populateCommunitySelect() {
  const select = $('select-community');
  select.innerHTML = '<option value="">Seleciona a comunidade</option>';
  const communities = Object.keys(COMMUNITY_DATA).sort();

  communities.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang.toUpperCase();
    select.appendChild(option);
  });
}

function populateUniverseSelect(language) {
  const select = $('select-universe');
  select.innerHTML = '<option value="">Seleciona o universo</option>';

  if (language && COMMUNITY_DATA[language]) {
    COMMUNITY_DATA[language]
      .sort((a, b) => a.number - b.number)
      .forEach(uni => {
        const option = document.createElement('option');
        // Usa uma string com o formato "lang_number" como value para facilitar a pesquisa
        option.value = `${uni.language}_${uni.number}`; 
        option.textContent = `${uni.name} (${uni.number})`;
        select.appendChild(option);
      });
  }
}

function handleUniverseChange() {
  const commSelect = $('select-community');
  const uniSelect = $('select-universe');
  const selectedLang = commSelect.value;
  const selectedUniValue = uniSelect.value;

  // 1. Atualizar o seletor de universo quando a comunidade muda
  if (this.id === 'select-community') {
    populateUniverseSelect(selectedLang);
    // Limpa os dados do universo anterior se a comunidade mudar
    FlightCalc.setUniverseConfig(null); 
    return;
  }
  
  // 2. Atualizar o estado da calculadora quando o universo muda
  if (this.id === 'select-universe' && selectedUniValue) {
    const [lang, number] = selectedUniValue.split('_');
    const uni = ALL_SERVERS.find(s => s.language === lang && s.number.toString() === number);

    if (uni && uni.settings) {
        // Mapeamento dos settings para o nosso estado
        const settings = uni.settings;
        const config = {
            speed: settings.fleetSpeedWar || 1, // Usar war speed como base para uni speed
            fleetSpeedPeaceful: settings.fleetSpeedPeaceful,
            fleetSpeedWar: settings.fleetSpeedWar,
            fleetSpeedHolding: settings.fleetSpeedHolding,
            galaxies: settings.universeSize,
            systems: settings.numberOfSystems,
            // A API usa 1 para circular, 0 para linear, mas só se for relevante (ogame API docs)
            donutGalaxy: settings.donutGalaxy === 1,
            donutSystem: settings.donutSystem === 1,
        };
        FlightCalc.setUniverseConfig(config);
    }
  }
}

async function loadServersJson() {
  try {
    const response = await fetch(SERVER_CONFIG_PATH);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const servers = await response.json();
    ALL_SERVERS = servers;

    // Agrupar por língua
    servers.forEach(server => {
      const lang = server.language;
      if (!COMMUNITY_DATA[lang]) {
        COMMUNITY_DATA[lang] = [];
      }
      COMMUNITY_DATA[lang].push(server);
    });

    populateCommunitySelect();
    
    // Adicionar listeners
    $('select-community')?.addEventListener('change', handleUniverseChange);
    $('select-universe')?.addEventListener('change', handleUniverseChange);

  } catch (error) {
    console.error("Erro ao carregar servers.json:", error);
    alert("Erro ao carregar a lista de universos. Verifique se 'servers.json' existe na raiz do projeto.");
  }
}

// =========================
// 5. Lógica de Cálculo (Mantida e Corrigida)
// =========================

function parseCoord(coordString) {
  const parts = (coordString || "1:1:1").split(":").map(Number);
  return { g: parts[0] || 1, s: parts[1] || 1, p: parts[2] || 1 };
}

function calculateDistance(origin, destiny) {
  const { galaxies, systems, donutGalaxy, donutSystem } = state.universe;
  let dist = 0;

  if (origin.g !== destiny.g) {
    let diff = Math.abs(origin.g - destiny.g) * 20000;
    if (donutGalaxy) {
      diff = Math.min(diff, Math.abs(galaxies - Math.abs(origin.g - destiny.g)) * 20000);
    }
    dist = dist + diff;
  }

  if (origin.s !== destiny.s) {
    let diff = Math.abs(origin.s - destiny.s) * 95;
    if (donutSystem) {
      diff = Math.min(diff, Math.abs(systems - Math.abs(origin.s - destiny.s)) * 95);
    }
    dist = dist + diff;
  }

  if (origin.p !== destiny.p) {
    dist = dist + Math.abs(origin.p - destiny.p) * 5 + 100;
  } else if (origin.s === destiny.s && origin.g === destiny.g) {
    dist = 5;
  }

  return Math.max(20, dist);
}

function getShipSpeed(ship, baseSpeed, driveLevel) {
  const { playerClass } = state.flight;
  const { lfBonuses, techs, lfGlobalBonuses } = state;

  const techLevel = driveLevel === 0 ? techs.combustion : driveLevel === 1 ? techs.impulse : techs.hyperspace;
  const lfBonus = lfBonuses[ship.index].speed;
  const shipBaseSpeed = ship.baseSpeed;

  let speed = shipBaseSpeed + (shipBaseSpeed * techLevel * 0.1);

  // Bónus de classe
  if (playerClass === 0 && ship.key === 'largeCargo') { // Coletor: CG * 2
    speed = speed * 2; 
  } else if (playerClass === 1) { // General: +25%
    speed = speed * 1.25;
  }
  
  // Bónus LF Global: General Engineering (afeta Cargos, Recycler, Pathfinder)
  const isLFGEAffected = ['smallCargo', 'largeCargo', 'recycler', 'pathfinder'].includes(ship.key);
  if (isLFGEAffected && lfGlobalBonuses.lfMechanGE > 0) {
      speed = speed * (1 + lfGlobalBonuses.lfMechanGE / 100);
  }

  // Bónus LF por Nave
  speed = speed * (1 + lfBonus / 100);

  return Math.floor(speed);
}

function getDeutConsumption(ship, baseSpeed, driveLevel, minSpeed) {
  const { techs, lfBonuses, flight, lfGlobalBonuses } = state;
  const { playerClass } = flight;
  
  const techLevel = driveLevel === 0 ? techs.combustion : driveLevel === 1 ? techs.impulse : techs.hyperspace;
  const hyperTech = techs.hyperspaceTech;
  const lfBonus = lfBonuses[ship.index].deut;
  
  let baseDeut = ship.deut;
  
  // Fórmula base de consumo:
  let consumption = baseDeut * (minSpeed / baseSpeed);
  consumption = consumption * (1 + (techLevel * 0.1));
  consumption = Math.round(consumption * consumption) + 1;

  // Modificadores de redução
  let reductionFactor = 1;
  
  // 1. Redução de Tecnologia de Hiperespaço (0.5% por nível)
  reductionFactor -= (hyperTech * 0.005); 
  
  // 2. Redução de Classe
  if (playerClass === 1) { // General: -25%
      reductionFactor -= 0.25; 
  }
  
  // 3. Redução LF Global: Crystal Engines (afeta Cruzador, Interceptor)
  const isLFCEAffected = ['cruiser', 'battlecruiser'].includes(ship.key);
  if (isLFCEAffected && lfGlobalBonuses.lfRocktalCE > 0) {
      reductionFactor -= (lfGlobalBonuses.lfRocktalCE / 100);
  }

  // 4. Redução LF por Nave
  reductionFactor -= (lfBonus / 100);

  // Aplica a redução total, mas nunca abaixo de 0
  consumption = consumption * Math.max(0, reductionFactor);

  return Math.round(consumption);
}

function getCargoCapacity(ship) {
  const { lfBonuses, techs, flight, lfGlobalBonuses } = state;
  const { playerClass } = flight;

  let capacity = ship.cargo;
  
  // 1. Capacidade base + Bónus LF por Nave
  capacity = capacity * (1 + lfBonuses[ship.index].cargo / 100);

  // 2. Bónus de Classe
  if (playerClass === 0) { // Coletor: +25%
    capacity = capacity * 1.25;
  } else if (playerClass === 2) { // Descobridor: +50%
    capacity = capacity * 1.50;
  }
  
  // 3. Bónus para Pathfinder
  if (ship.key === 'pathfinder') {
    // Bónus HyperTech Lvl * 5%
    capacity = capacity * (1 + techs.hyperspaceTech * 0.05);
    
    // Bónus LF Global: Cargo Pathfinder
    if (lfGlobalBonuses.lfSpCargohold > 0) {
        capacity = capacity * (1 + lfGlobalBonuses.lfSpCargohold / 100);
    }
  }
  
  return Math.floor(capacity);
}

function calculateFlightTime(distance, minSpeed, universeSpeed) {
  // A velocidade do universo aqui é a velocidade da missão
  const speed = minSpeed / (1000000000 / 3600); 
  const timeSeconds = Math.round((distance * 10) / (universeSpeed * speed));
  return timeSeconds;
}

function formatTime(totalSeconds) {
  if (totalSeconds < 0) return "—";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  let timeStr = "";
  if (hours > 0) timeStr += hours + "h ";
  if (minutes > 0 || hours > 0) timeStr += minutes + "m ";
  timeStr += seconds + "s";
  
  return timeStr.trim();
}

function getMissionSpeed(missionType) {
  const { fleetSpeedPeaceful, fleetSpeedWar, fleetSpeedHolding, speed } = state.universe;

  if (missionType === "peaceful") return fleetSpeedPeaceful;
  if (missionType === "war") return fleetSpeedWar;
  if (missionType === "holding") return fleetSpeedHolding;
  
  // Fallback (deve usar war speed se não houver um override de mission-type)
  return speed; 
}


// =========================
// 6. Função Principal de Recálculo
// =========================

function recalc() {
  // 1. Atualizar o estado (Techs, LF Globais, Frota, Coordenadas, Config de Voo)
  state.techs.combustion = getNumber("tech-combustion");
  state.techs.impulse = getNumber("tech-impulse");
  state.techs.hyperspace = getNumber("tech-hyperspace");
  state.techs.hyperspaceTech = getNumber("tech-hyperspace-tech");

  state.lfGlobalBonuses.lfMechanGE = getNumber("lf-mechan-ge");
  state.lfGlobalBonuses.lfRocktalCE = getNumber("lf-rocktal-ce");
  state.lfGlobalBonuses.lfSpCargohold = getNumber("lf-sp-cargohold");
  
  state.flight.playerClass = getNumber("player-class");
  state.flight.allianceClass = getNumber("alliance-class");
  state.flight.origin = parseCoord($("coord-origin").value);
  state.flight.destiny = parseCoord($("coord-destiny").value);
  state.flight.missionType = $("mission-type").value;
  state.flight.speedPercent = getNumber("speed-percent");
  state.flight.universeSpeedOverride = getNumber("universe-speed-override");

  // LF Bónus por nave e Quantidade de Frota
  for (let i = 0; i < 16; i++) {
    state.lfBonuses[i].speed = getNumber("lf-speed-" + i);
    state.lfBonuses[i].cargo = getNumber("lf-cargo-" + i);
    state.lfBonuses[i].deut = getNumber("lf-deut-" + i);
    state.fleet[i] = getNumber("fleet-ship-" + i);
  }

  // 2. Calcular Distância
  const distance = calculateDistance(state.flight.origin, state.flight.destiny);
  setText("distance-read", formatNumber(distance) + " km");

  // 3. Determinar a Velocidade Mínima da Frota
  let minSpeed = Infinity;
  let totalConsumption = 0;
  let totalCargoCapacity = 0;
  let hasFleet = false;
  
  // Determinar a velocidade do universo (baseada na missão ou override)
  const missionSpeedFactor = state.flight.universeSpeedOverride > 0
    ? state.flight.universeSpeedOverride
    : getMissionSpeed(state.flight.missionType);

  BASE_SHIPS.forEach((ship, index) => {
    ship.index = index; // Adicionar índice para lookup

    const count = state.fleet[index];
    if (count > 0) {
      hasFleet = true;

      // Calcular a velocidade efetiva
      const effectiveSpeed = getShipSpeed(ship, ship.baseSpeed, ship.drive);
      minSpeed = Math.min(minSpeed, effectiveSpeed);

      // Calcular Consumo e Capacidade (usando a velocidade base da nave para o cálculo do consumo)
      // O consumo é calculado no final com base na minSpeed. Por agora, apenas o Total Cargo
      totalCargoCapacity += getCargoCapacity(ship) * count;
    }
  });

  if (!hasFleet) {
    minSpeed = 0; // Se não houver frota, a velocidade é 0.
  }
  
  setText("minspeed-read", formatNumber(minSpeed) + " km/h");
  
  // 4. Calcular Resultados Finais e Tabela
  const tableBody = $("flight-times-table");
  tableBody.innerHTML = "";
  
  if (distance === 5 && minSpeed === 0) { // Sonda no mesmo planeta
      totalConsumption = 0;
  } else if (!hasFleet) {
      // Se não houver frota, não há tempo de voo/consumo.
      totalConsumption = 0;
  } else {
      // Recalcular consumo usando a minSpeed para todas as naves com frota.
      BASE_SHIPS.forEach((ship, index) => {
          const count = state.fleet[index];
          if (count > 0) {
              const consumptionPerShip = getDeutConsumption(ship, ship.baseSpeed, ship.drive, minSpeed);
              totalConsumption += consumptionPerShip * count;
          }
      });
  }

  // Multiplicador de velocidade para a tabela
  const speedMultipliers = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
  
  // Calcular consumo base (100% de velocidade)
  const baseConsumption = totalConsumption;
  
  // Bónus de classe de Aliança (Traders -50% deut)
  if (state.flight.allianceClass === 1) {
    totalConsumption = totalConsumption * 0.5;
  }

  // Aplicar velocidade percentual do input
  const effectiveMinSpeed = minSpeed * (state.flight.speedPercent / 100);

  speedMultipliers.forEach(percent => {
    const timeSeconds = calculateFlightTime(distance, effectiveMinSpeed * (percent / 100), missionSpeedFactor);
    const consumptionForSpeed = totalConsumption * (Math.pow((100 / percent), 2));
    
    const row = tableBody.insertRow();
    row.innerHTML = `
      <td>${percent}%</td>
      <td>${formatTime(timeSeconds)}</td>
      <td>${formatNumber(Math.round(consumptionForSpeed))}</td>
      <td>${formatNumber(totalCargoCapacity)}</td>
    `;
  });
}


// =========================
// 7. Inicialização da Tabela de Naves
// =========================

function initLfTable() {
  const tableBody = $("lf-table-body");
  if (!tableBody) return;
  
  tableBody.innerHTML = "";

  SHIP_LABELS.forEach((label, index) => {
    const ship = BASE_SHIPS[index];
    const row = tableBody.insertRow();
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${label}</td>
      <td><input id="lf-speed-${index}" type="number" min="-100" max="100" step="0.001" value="0"/></td>
      <td><input id="lf-cargo-${index}" type="number" min="-100" max="100" step="0.001" value="0"/></td>
      <td><input id="lf-deut-${index}" type="number" min="-100" max="100" step="0.001" value="0"/></td>
    `;
  });
}

function initFleetTable() {
  const tableBody = $("fleet-table-body");
  if (!tableBody) return;
  
  tableBody.innerHTML = "";

  SHIP_LABELS.forEach((label, index) => {
    const ship = BASE_SHIPS[index];
    const driveTech = ship.drive === 0 ? "Combustão" : ship.drive === 1 ? "Impulso" : "Hiperespaço";
    
    const row = tableBody.insertRow();
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${label}</td>
      <td><input id="fleet-ship-${index}" type="number" min="0" step="1" value="0" placeholder="0"/></td>
      <td>${driveTech}</td>
    `;
  });
}


// =========================
// 8. API para o Importer
// =========================

window.FlightCalc = {
  state: state,
  recalc: recalc,
  // Define a função de configuração de universo para ser chamada após a seleção
  setUniverseConfig: (config) => {
    if (!config) { // Se for null, limpa os campos
        state.universe.speed = 1;
        state.universe.fleetSpeedPeaceful = 1;
        state.universe.fleetSpeedWar = 1;
        state.universe.fleetSpeedHolding = 1;
        state.universe.galaxies = 9;
        state.universe.systems = 499;
        state.universe.donutGalaxy = false;
        state.universe.donutSystem = false;
        
        setText("fleet-speed-peaceful", "—");
        setText("fleet-speed-war", "—");
        setText("fleet-speed-holding", "—");
        setText("universe-galaxies", "—");
        setText("universe-systems", "—");
        setText("donut-galaxy", "—");
        setText("donut-system", "—");
        recalc();
        return;
    }
    
    state.universe = { ...state.universe, ...config };

    setText("fleet-speed-peaceful", state.universe.fleetSpeedPeaceful + "x");
    setText("fleet-speed-war", state.universe.fleetSpeedWar + "x");
    setText("fleet-speed-holding", state.universe.fleetSpeedHolding + "x");
    setText("universe-galaxies", state.universe.galaxies);
    setText("universe-systems", state.universe.systems);
    setText("donut-galaxy", state.universe.donutGalaxy ? "Sim" : "Não");
    setText("donut-system", state.universe.donutSystem ? "Sim" : "Não");

    recalc();
  },
};

// =========================
// 9. Boot
// =========================

document.addEventListener("DOMContentLoaded", () => {
  initLfTable();
  initFleetTable();
  loadServersJson(); // CARREGAMENTO DO SERVERS.JSON (NOVO)

  $("recalc")?.addEventListener("click", recalc);

  const idsToWatch = [
    "player-class",
    "alliance-class",
    "tech-combustion",
    "tech-impulse",
    "tech-hyperspace",
    "tech-hyperspace-tech",
    "lf-mechan-ge", // NOVO
    "lf-rocktal-ce", // NOVO
    "lf-sp-cargohold", // NOVO
    "coord-origin",
    "coord-destiny",
    "mission-type",
    "speed-percent",
    "universe-speed-override",
  ];

  idsToWatch.forEach(id => {
    const el = $(id);
    if (!el) return;
    // Usa 'input' em vez de 'keyup' para capturar alterações via API/código também
    el.addEventListener("change", recalc); 
    el.addEventListener("input", recalc);
  });

  for (let i = 0; i < 16; i++) {
    ["lf-speed-", "lf-cargo-", "lf-deut-", "fleet-ship-"].forEach(prefix => {
      const el = $(prefix + i);
      if (el) {
        el.addEventListener("change", recalc);
        el.addEventListener("input", recalc);
      }
    });
  }
});
