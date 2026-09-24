/**
 * Bellum Penumbrum - Gestione Effetti Dinamici
 * Gli effetti vengono salvati in localStorage e possono essere creati/eliminati dall'interfaccia
 */

// Effetti di default (se non ce ne sono già salvati)
const DEFAULT_EFFECTS = [
    {
        id: 'draw',
        name: '📚 Pesca carte',
        description: 'Fa pescare un numero di carte',
        params: [
            {
                name: 'amount',
                label: 'Quantità',
                type: 'number',
                min: 1,
                max: 10,
                default: 1
            },
            {
                name: 'target',
                label: 'Target',
                type: 'select',
                options: [
                    { value: 'self', label: 'Se stesso' },
                    { value: 'opponent', label: 'Avversario' }
                ],
                default: 'self'
            }
        ],
        generateJSON: '(params) => ({ type: "draw", amount: parseInt(params.amount) || 1, target: params.target || "self", timing: "on_play" })',
        generateText: '(params) => `Pesca ${params.amount || 1} carta${(params.amount || 1) > 1 ? "e" : ""}`'
    },
    
    {
        id: 'damage_creature',
        name: '⚔️ Danno a creatura',
        description: 'Infligge danno a una creatura',
        params: [
            {
                name: 'amount',
                label: 'Danno',
                type: 'number',
                min: 1,
                max: 20,
                default: 2
            },
            {
                name: 'target',
                label: 'Target',
                type: 'select',
                options: [
                    { value: 'any_creature', label: 'Una creatura' },
                    { value: 'all_creatures', label: 'Tutte le creature' },
                    { value: 'random_creature', label: 'Creatura casuale' }
                ],
                default: 'any_creature'
            }
        ],
        generateJSON: '(params) => ({ type: "damage", amount: parseInt(params.amount) || 1, target: params.target || "any_creature", timing: "on_play" })',
        generateText: '(params) => { const amount = params.amount || 1; const target = params.target || "any_creature"; if (target === "all_creatures") return `Infliggi ${amount} danno a tutte le creature`; else if (target === "random_creature") return `Infliggi ${amount} danno a una creatura casuale`; else return `Infliggi ${amount} danno a una creatura`; }'
    },
    
    {
        id: 'damage_opponent',
        name: '💥 Danno diretto',
        description: 'Infligge danno direttamente all\'avversario',
        params: [
            {
                name: 'amount',
                label: 'Danno',
                type: 'number',
                min: 1,
                max: 20,
                default: 3
            }
        ],
        generateJSON: '(params) => ({ type: "damage", amount: parseInt(params.amount) || 1, target: "opponent", timing: "on_play" })',
        generateText: '(params) => `Infliggi ${params.amount || 3} danno all\'avversario`'
    },
    
    {
        id: 'heal',
        name: '❤️ Cura',
        description: 'Ripristina punti vita',
        params: [
            {
                name: 'amount',
                label: 'Cura',
                type: 'number',
                min: 1,
                max: 20,
                default: 3
            },
            {
                name: 'target',
                label: 'Target',
                type: 'select',
                options: [
                    { value: 'self', label: 'Se stesso' },
                    { value: 'any_creature', label: 'Una creatura' },
                    { value: 'all_creatures', label: 'Tutte le creature amiche' }
                ],
                default: 'self'
            }
        ],
        generateJSON: '(params) => ({ type: "heal", amount: parseInt(params.amount) || 1, target: params.target || "self", timing: "on_play" })',
        generateText: '(params) => { const amount = params.amount || 3; const target = params.target || "self"; if (target === "all_creatures") return `Cura ${amount} HP a tutte le tue creature`; else if (target === "any_creature") return `Cura ${amount} HP a una creatura`; else return `Guadagna ${amount} vita`; }'
    },
    
    {
        id: 'buff_attack',
        name: '💪 Buff Attack',
        description: 'Aumenta l\'attack di una creatura',
        params: [
            {
                name: 'amount',
                label: 'Bonus Attack',
                type: 'number',
                min: 1,
                max: 20,
                default: 2
            },
            {
                name: 'duration',
                label: 'Durata',
                type: 'select',
                options: [
                    { value: 'permanent', label: 'Permanente' },
                    { value: 'turn', label: 'Fine turno' },
                    { value: 'game', label: 'Fino a fine partita' }
                ],
                default: 'permanent'
            },
            {
                name: 'target',
                label: 'Target',
                type: 'select',
                options: [
                    { value: 'any_creature', label: 'Una creatura' },
                    { value: 'all_creatures', label: 'Tutte le tue creature' }
                ],
                default: 'any_creature'
            }
        ],
        generateJSON: '(params) => ({ type: "buff", stat: "attack", amount: parseInt(params.amount) || 2, duration: params.duration || "permanent", target: params.target || "any_creature", timing: "on_play" })',
        generateText: '(params) => { const amount = params.amount || 2; const target = params.target || "any_creature"; const duration = params.duration || "permanent"; let text = `Una creatura guadagna +${amount} attack`; if (target === "all_creatures") text = `Tutte le tue creature guadagnano +${amount} attack`; if (duration === "permanent") text += " permanente"; else if (duration === "turn") text += " fino alla fine del turno"; return text; }'
    },
    
    {
        id: 'buff_hp',
        name: '🛡️ Buff HP',
        description: 'Aumenta gli HP di una creatura',
        params: [
            {
                name: 'amount',
                label: 'Bonus HP',
                type: 'number',
                min: 1,
                max: 20,
                default: 2
            },
            {
                name: 'duration',
                label: 'Durata',
                type: 'select',
                options: [
                    { value: 'permanent', label: 'Permanente' },
                    { value: 'turn', label: 'Fine turno' },
                    { value: 'game', label: 'Fino a fine partita' }
                ],
                default: 'permanent'
            },
            {
                name: 'target',
                label: 'Target',
                type: 'select',
                options: [
                    { value: 'any_creature', label: 'Una creatura' },
                    { value: 'all_creatures', label: 'Tutte le tue creature' }
                ],
                default: 'any_creature'
            }
        ],
        generateJSON: '(params) => ({ type: "buff", stat: "hp", amount: parseInt(params.amount) || 2, duration: params.duration || "permanent", target: params.target || "any_creature", timing: "on_play" })',
        generateText: '(params) => { const amount = params.amount || 2; const target = params.target || "any_creature"; const duration = params.duration || "permanent"; let text = `Una creatura guadagna +${amount} HP`; if (target === "all_creatures") text = `Tutte le tue creature guadagnano +${amount} HP`; if (duration === "permanent") text += " permanente"; else if (duration === "turn") text += " fino alla fine del turno"; return text; }'
    },
    
    {
        id: 'destroy_creature',
        name: '💀 Distruggi creatura',
        description: 'Distrugge una creatura',
        params: [
            {
                name: 'target',
                label: 'Target',
                type: 'select',
                options: [
                    { value: 'any_creature', label: 'Una creatura' },
                    { value: 'weak_creature', label: 'Creatura con 3 o meno HP' },
                    { value: 'strong_creature', label: 'Creatura con 5 o più HP' }
                ],
                default: 'any_creature'
            }
        ],
        generateJSON: '(params) => ({ type: "destroy", target: params.target || "any_creature", timing: "on_play" })',
        generateText: '(params) => { const target = params.target || "any_creature"; if (target === "weak_creature") return "Distruggi una creatura con 3 o meno HP"; else if (target === "strong_creature") return "Distruggi una creatura con 5 o più HP"; else return "Distruggi una creatura"; }'
    },
    
    {
        id: 'return_hand',
        name: '🔄 Ritorna in mano',
        description: 'Fa tornare una creatura in mano al proprietario',
        params: [
            {
                name: 'target',
                label: 'Target',
                type: 'select',
                options: [
                    { value: 'any_creature', label: 'Una creatura' },
                    { value: 'opponent_creature', label: 'Una creatura avversaria' }
                ],
                default: 'any_creature'
            }
        ],
        generateJSON: '(params) => ({ type: "return_hand", target: params.target || "any_creature", timing: "on_play" })',
        generateText: '(params) => { const target = params.target || "any_creature"; if (target === "opponent_creature") return "Una creatura avversaria torna in mano al proprietario"; else return "Una creatura torna in mano al proprietario"; }'
    },
    
    {
        id: 'mill',
        name: '📖 Mill (scarta dal mazzo)',
        description: 'Fa scartare carte dal mazzo',
        params: [
            {
                name: 'amount',
                label: 'Quantità',
                type: 'number',
                min: 1,
                max: 20,
                default: 3
            },
            {
                name: 'target',
                label: 'Target',
                type: 'select',
                options: [
                    { value: 'opponent', label: 'Avversario' },
                    { value: 'self', label: 'Se stesso' }
                ],
                default: 'opponent'
            }
        ],
        generateJSON: '(params) => ({ type: "mill", amount: parseInt(params.amount) || 3, target: params.target || "opponent", timing: "on_play" })',
        generateText: '(params) => { const amount = params.amount || 3; const target = params.target || "opponent"; if (target === "opponent") return `L\'avversario mette le prime ${amount} carte del suo mazzo nel cimitero`; else return `Metti le prime ${amount} carte del tuo mazzo nel cimitero`; }'
    },
    
    {
        id: 'search',
        name: '🔍 Cerca nel mazzo',
        description: 'Cerca una carta nel mazzo e aggiungila alla mano',
        params: [
            {
                name: 'criteria',
                label: 'Criterio',
                type: 'select',
                options: [
                    { value: 'any', label: 'Qualsiasi carta' },
                    { value: 'monster', label: 'Mostro' },
                    { value: 'faction', label: 'Carta di una fazione specifica' }
                ],
                default: 'any'
            }
        ],
        generateJSON: '(params) => ({ type: "search", criteria: params.criteria || "any", timing: "on_play" })',
        generateText: '(params) => { const criteria = params.criteria || "any"; if (criteria === "monster") return "Cerca un mostro nel tuo mazzo e aggiungilo alla mano"; else if (criteria === "faction") return "Cerca una carta di una fazione specifica nel tuo mazzo e aggiungila alla mano"; else return "Cerca una carta nel tuo mazzo e aggiungila alla mano"; }'
    },
    
    {
        id: 'summon_token',
        name: '👻 Evoca Token',
        description: 'Evoca una creatura token',
        params: [
            {
                name: 'attack',
                label: 'Attack Token',
                type: 'number',
                min: 0,
                max: 10,
                default: 1
            },
            {
                name: 'hp',
                label: 'HP Token',
                type: 'number',
                min: 1,
                max: 10,
                default: 1
            },
            {
                name: 'amount',
                label: 'Quantità Token',
                type: 'number',
                min: 1,
                max: 5,
                default: 1
            }
        ],
        generateJSON: '(params) => ({ type: "summon_token", attack: parseInt(params.attack) || 1, hp: parseInt(params.hp) || 1, amount: parseInt(params.amount) || 1, timing: "on_play" })',
        generateText: '(params) => { const atk = params.attack || 1; const hp = params.hp || 1; const amount = params.amount || 1; if (amount > 1) return `Evoca ${amount} token ${atk}/${hp}`; else return `Evoca un token ${atk}/${hp}`; }'
    },
    
    {
        id: 'counter',
        name: '🚫 Contrasta',
        description: 'Contrasta una stregoneria o istantaneo avversario',
        params: [],
        generateJSON: '() => ({ type: "counter", target: "spell", timing: "instant" })',
        generateText: '() => "Contrasta una stregoneria o istantaneo avversario"'
    }
];

/**
 * Ottieni tutti gli effetti (da localStorage o default)
 */
export function getAllEffects() {
    const stored = localStorage.getItem('bellum_effects');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Errore parsing effetti:', e);
        }
    }
    return DEFAULT_EFFECTS;
}

/**
 * Salva effetti in localStorage
 */
export function saveEffects(effects) {
    localStorage.setItem('bellum_effects', JSON.stringify(effects));
}

/**
 * Aggiungi un nuovo effetto
 */
export function addEffect(effect) {
    const effects = getAllEffects();
    
    // Controlla se ID esiste già
    if (effects.find(e => e.id === effect.id)) {
        throw new Error(`Effetto con ID "${effect.id}" già esistente`);
    }
    
    effects.push(effect);
    saveEffects(effects);
    return effects;
}

/**
 * Elimina un effetto per ID
 */
export function deleteEffect(effectId) {
    const effects = getAllEffects();
    const filtered = effects.filter(e => e.id !== effectId);
    saveEffects(filtered);
    return filtered;
}

/**
 * Ottieni la configurazione di un effetto
 */
export function getEffectConfig(effectId) {
    const effects = getAllEffects();
    return effects.find(e => e.id === effectId);
}

/**
 * Genera il JSON per un effetto
 */
export function generateEffectJSON(effectId, params) {
    const effect = getEffectConfig(effectId);
    if (!effect) return null;
    
    try {
        const fn = new Function('params', `return ${effect.generateJSON}`);
        return fn(params || {});
    } catch (e) {
        console.error('Errore generazione JSON effetto:', e);
        return null;
    }
}

/**
 * Genera il testo descrittivo per un effetto
 */
export function generateEffectText(effectId, params) {
    const effect = getEffectConfig(effectId);
    if (!effect) return '';
    
    try {
        const fn = new Function('params', `return ${effect.generateText}`);
        return fn(params || {});
    } catch (e) {
        console.error('Errore generazione testo effetto:', e);
        return '';
    }
}

/**
 * Resetta effetti ai default
 */
export function resetEffectsToDefault() {
    localStorage.removeItem('bellum_effects');
    return DEFAULT_EFFECTS;
}

/**
 * Esporta effetti come JSON
 */
export function exportEffects() {
    return JSON.stringify(getAllEffects(), null, 2);
}

/**
 * Importa effetti da JSON
 */
export function importEffects(jsonString) {
    try {
        const effects = JSON.parse(jsonString);
        if (!Array.isArray(effects)) {
            throw new Error('Formato non valido');
        }
        saveEffects(effects);
        return effects;
    } catch (e) {
        console.error('Errore import effetti:', e);
        throw e;
    }
}