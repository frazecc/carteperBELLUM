/**
 * Bellum Penumbrum - Creatore Carte
 * Gestione creazione, modifica e eliminazione carte su Supabase
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/main/+esm.js';
import { getAllEffects, generateEffectJSON, generateEffectText, getEffectConfig } from './effects.js';

// ============================================
// CONFIGURAZIONE SUPABASE
// ============================================
const SUPABASE_URL = 'https://dgsqxnmrjfvklnjliplh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZwwwsHnjEWNbe2CnDKsTSA_8ljXZlOG';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// STATO DELL'APPLICAZIONE
// ============================================
const AppState = {
    currentImageFile: null,
    currentImageUrl: null,
    addedEffects: [],
    allCards: [],
    selectedCardId: null
};

// ============================================
// INIZIALIZZAZIONE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Creatore Carte inizializzato');
    
    initEffectSelector();
    setupEventListeners();
    loadAllCards();
});

// ============================================
// GESTIONE EFFETTI
// ============================================
function initEffectSelector() {
    const effectSelect = document.getElementById('effect-type');
    
    // Popola select con tutti gli effetti
    getAllEffects().forEach(effect => {
        const option = document.createElement('option');
        option.value = effect.id;
        option.textContent = effect.name;
        option.title = effect.description;
        effectSelect.appendChild(option);
    });
    
    // Listener cambio effetto
    effectSelect.addEventListener('change', (e) => {
        renderEffectParams(e.target.value);
    });
}

function renderEffectParams(effectId) {
    const paramsContainer = document.getElementById('effect-params');
    paramsContainer.innerHTML = '';
    
    const effect = getEffectConfig(effectId);
    if (!effect || !effect.params || effect.params.length === 0) {
        return;
    }
    
    effect.params.forEach(param => {
        const wrapper = document.createElement('div');
        
        const label = document.createElement('label');
        label.textContent = param.label;
        label.style.fontSize = '0.75rem';
        label.style.color = 'var(--text-secondary)';
        wrapper.appendChild(label);
        
        if (param.type === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `param-${param.name}`;
            input.min = param.min || 0;
            input.max = param.max || 99;
            input.value = param.default || 0;
            wrapper.appendChild(input);
        } else if (param.type === 'select') {
            const select = document.createElement('select');
            select.id = `param-${param.name}`;
            
            param.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            });
            
            wrapper.appendChild(select);
        }
        
        paramsContainer.appendChild(wrapper);
    });
}

function addEffect() {
    const effectSelect = document.getElementById('effect-type');
    const effectId = effectSelect.value;
    
    if (!effectId) {
        alert('Seleziona un effetto!');
        return;
    }
    
    const effect = getEffectConfig(effectId);
    const params = {};
    
    // Raccogli parametri
    effect.params?.forEach(param => {
        const input = document.getElementById(`param-${param.name}`);
        if (input) {
            params[param.name] = input.value;
        }
    });
    
    // Genera JSON e testo
    const effectJSON = generateEffectJSON(effectId, params);
    const effectText = generateEffectText(effectId, params);
    
    // Aggiungi alla lista
    AppState.addedEffects.push({
        id: effectId,
        name: effect.name,
        params,
        json: effectJSON,
        text: effectText
    });
    
    renderEffectsList();
    
    // Resetta select
    effectSelect.value = '';
    document.getElementById('effect-params').innerHTML = '';
}

function renderEffectsList() {
    const effectsList = document.getElementById('effects-list');
    effectsList.innerHTML = '';
    
    AppState.addedEffects.forEach((effect, index) => {
        const item = document.createElement('div');
        item.className = 'effect-item';
        
        const info = document.createElement('div');
        info.className = 'effect-info';
        
        const name = document.createElement('div');
        name.className = 'effect-name';
        name.textContent = effect.name;
        
        const details = document.createElement('div');
        details.className = 'effect-details';
        details.textContent = effect.text;
        
        info.appendChild(name);
        info.appendChild(details);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = 'Rimuovi';
        removeBtn.addEventListener('click', () => removeEffect(index));
        
        item.appendChild(info);
        item.appendChild(removeBtn);
        
        effectsList.appendChild(item);
    });
}

function removeEffect(index) {
    AppState.addedEffects.splice(index, 1);
    renderEffectsList();
}

// ============================================
// GESTIONE IMMAGINE
// ============================================
function handleImageUpload(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    // Verifica tipo file
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Formato immagine non valido. Usa PNG, JPEG o WebP.');
        event.target.value = '';
        return;
    }
    
    // Verifica dimensione (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Immagine troppo grande. Max 5MB.');
        event.target.value = '';
        return;
    }
    
    AppState.currentImageFile = file;
    
    // Mostra anteprima
    const reader = new FileReader();
    reader.onload = (e) => {
        AppState.currentImageUrl = e.target.result;
        
        const preview = document.getElementById('image-preview');
        preview.innerHTML = `<img src="${e.target.result}" alt="Anteprima">`;
        
        // Aggiorna anche anteprima carta
        updateCardPreview();
    };
    reader.readAsDataURL(file);
}

async function uploadImageToSupabase(cardId, factionCode) {
    if (!AppState.currentImageFile) return null;
    
    const filePath = `${factionCode}/${cardId}.png`;
    
    const { data, error } = await supabase.storage
        .from('card-images')
        .upload(filePath, AppState.currentImageFile, {
            upsert: true,
            contentType: AppState.currentImageFile.type
        });
    
    if (error) {
        console.error('Errore upload immagine:', error);
        throw error;
    }
    
    // Ottieni URL pubblico
    const { data: { publicUrl } } = supabase.storage
        .from('card-images')
        .getPublicUrl(filePath);
    
    return publicUrl;
}

// ============================================
// GESTIONE FORM
// ============================================
function setupEventListeners() {
    // Upload immagine
    document.getElementById('card-image').addEventListener('change', handleImageUpload);
    
    // Mostra/nascondi stats in base al tipo
    document.getElementById('card-type').addEventListener('change', (e) => {
        const statsRow = document.getElementById('stats-row');
        const type = e.target.value;
        
        if (['monster', 'mostrissimo'].includes(type)) {
            statsRow.style.display = 'grid';
        } else {
            statsRow.style.display = 'none';
        }
        
        updateCardPreview();
    });
    
    // Aggiorna anteprima in tempo reale
    ['card-name', 'card-type', 'faction', 'mana-cost', 'attack', 'hp', 'effect-text'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateCardPreview);
    });
    
    // Aggiungi effetto
    document.getElementById('btn-add-effect').addEventListener('click', addEffect);
    
    // Submit form
    document.getElementById('card-form').addEventListener('submit', handleFormSubmit);
    
    // Anteprima
    document.getElementById('btn-preview').addEventListener('click', updateCardPreview);
    
    // Reset form
    document.getElementById('card-form').addEventListener('reset', () => {
        setTimeout(() => {
            AppState.addedEffects = [];
            AppState.currentImageFile = null;
            AppState.currentImageUrl = null;
            renderEffectsList();
            document.getElementById('image-preview').innerHTML = '<p>Anteprima immagine</p>';
            updateCardPreview();
        }, 10);
    });
    
    // Ricarica carte
    document.getElementById('btn-refresh-cards').addEventListener('click', loadAllCards);
    
    // Cerca carte
    document.getElementById('search-cards').addEventListener('input', filterCards);
    document.getElementById('filter-faction').addEventListener('change', filterCards);
    
    // Modale
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-edit').addEventListener('click', editSelectedCard);
    document.getElementById('modal-delete').addEventListener('click', deleteSelectedCard);
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const messageEl = document.getElementById('form-message');
    messageEl.className = 'form-message';
    
    // Raccogli dati form
    const cardData = {
        name: document.getElementById('card-name').value.trim(),
        faction_id: parseInt(document.getElementById('faction').value),
        card_type: document.getElementById('card-type').value,
        mana_cost: parseInt(document.getElementById('mana-cost').value) || 0,
        attack: parseInt(document.getElementById('attack').value) || null,
        hp: parseInt(document.getElementById('hp').value) || null,
        effect_text: document.getElementById('effect-text').value.trim(),
        is_boss: document.getElementById('is-boss').checked,
        is_indrazzi: document.getElementById('is-indrazzi').checked
    };
    
    // Verifica immagine
    if (!AppState.currentImageFile) {
        showMessage('Devi caricare un\'immagine!', 'error');
        return;
    }
    
    // Genera effect_json
    if (AppState.addedEffects.length > 0) {
        if (AppState.addedEffects.length === 1) {
            cardData.effect_json = AppState.addedEffects[0].json;
        } else {
            cardData.effect_json = {
                effects: AppState.addedEffects.map(e => e.json)
            };
        }
    }
    
    try {
        // 1. Crea la carta (senza image_url)
        const { data: card, error: cardError } = await supabase
            .from('cards')
            .insert([cardData])
            .select()
            .single();
        
        if (cardError) {
            throw cardError;
        }
        
        // 2. Carica immagine
        const factionCodes = ['CHI', 'INF', 'PES', 'BUL', 'GRO', 'CLO', 'IND'];
        const factionCode = factionCodes[cardData.faction_id - 1];
        
        const imageUrl = await uploadImageToSupabase(card.id, factionCode);
        
        if (!imageUrl) {
            throw new Error('Upload immagine fallito');
        }
        
        // 3. Aggiorna carta con image_url
        const { error: updateError } = await supabase
            .from('cards')
            .update({ image_url: imageUrl })
            .eq('id', card.id);
        
        if (updateError) {
            throw updateError;
        }
        
        showMessage(`Carta "${card.name}" creata con successo!`, 'success');
        
        // Reset form
        document.getElementById('card-form').reset();
        AppState.addedEffects = [];
        AppState.currentImageFile = null;
        AppState.currentImageUrl = null;
        renderEffectsList();
        document.getElementById('image-preview').innerHTML = '<p>Anteprima immagine</p>';
        updateCardPreview();
        
        // Ricarica lista carte
        loadAllCards();
        
    } catch (error) {
        console.error('Errore creazione carta:', error);
        showMessage(`Errore: ${error.message}`, 'error');
    }
}

function showMessage(message, type) {
    const messageEl = document.getElementById('form-message');
    messageEl.textContent = message;
    messageEl.className = `form-message ${type}`;
    
    setTimeout(() => {
        messageEl.className = 'form-message';
    }, 5000);
}

// ============================================
// ANTEPRIMA CARTA
// ============================================
function updateCardPreview() {
    const name = document.getElementById('card-name').value || 'Nome Carta';
    const type = document.getElementById('card-type').value || 'Tipo';
    const mana = document.getElementById('mana-cost').value || '0';
    const attack = document.getElementById('attack').value || '0';
    const hp = document.getElementById('hp').value || '0';
    const effect = document.getElementById('effect-text').value || 'Testo effetto...';
    
    document.getElementById('preview-name').textContent = name;
    document.getElementById('preview-type').textContent = type;
    document.getElementById('preview-mana').textContent = `⚡${mana}`;
    document.getElementById('preview-effect').textContent = effect;
    
    // Stats
    const cardType = document.getElementById('card-type').value;
    const atkEl = document.getElementById('preview-atk');
    const hpEl = document.getElementById('preview-hp');
    
    if (['monster', 'mostrissimo'].includes(cardType)) {
        atkEl.style.display = 'inline';
        hpEl.style.display = 'inline';
        atkEl.textContent = `⚔${attack}`;
        hpEl.textContent = `❤${hp}`;
    } else {
        atkEl.style.display = 'none';
        hpEl.style.display = 'none';
    }
    
    // Immagine
    const imageEl = document.getElementById('preview-image');
    if (AppState.currentImageUrl) {
        imageEl.innerHTML = `<img src="${AppState.currentImageUrl}" alt="Anteprima">`;
    } else {
        imageEl.innerHTML = '<span>Immagine</span>';
    }
}

// ============================================
// GESTIONE CARTE ESISTENTI
// ============================================
async function loadAllCards() {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '<p>Caricamento...</p>';
    
    const { data, error } = await supabase
        .from('cards')
        .select(`
            *,
            factions (
                name,
                code,
                color_hex
            )
        `)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Errore caricamento carte:', error);
        grid.innerHTML = '<p>Errore nel caricamento carte</p>';
        return;
    }
    
    AppState.allCards = data;
    renderCardsGrid(data);
}

function renderCardsGrid(cards) {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';
    
    if (cards.length === 0) {
        grid.innerHTML = '<p>Nessuna carta trovata</p>';
        return;
    }
    
    cards.forEach(card => {
        const item = document.createElement('div');
        item.className = 'card-item';
        
        const name = document.createElement('div');
        name.className = 'card-name';
        name.textContent = card.name;
        
        const meta = document.createElement('div');
        meta.className = 'card-meta';
        meta.textContent = `${card.factions?.name || '???'} • ${card.card_type} • ⚡${card.mana_cost}`;
        
        item.appendChild(name);
        item.appendChild(meta);
        
        item.addEventListener('click', () => selectCard(card));
        
        grid.appendChild(item);
    });
}

function filterCards() {
    const searchTerm = document.getElementById('search-cards').value.toLowerCase();
    const factionFilter = document.getElementById('filter-faction').value;
    
    let filtered = AppState.allCards;
    
    if (searchTerm) {
        filtered = filtered.filter(card => 
            card.name.toLowerCase().includes(searchTerm) ||
            card.effect_text?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (factionFilter) {
        filtered = filtered.filter(card => card.faction_id === parseInt(factionFilter));
    }
    
    renderCardsGrid(filtered);
}

function selectCard(card) {
    AppState.selectedCardId = card.id;
    
    const modal = document.getElementById('card-modal');
    const title = document.getElementById('modal-title');
    
    title.textContent = card.name;
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('card-modal');
    modal.style.display = 'none';
    AppState.selectedCardId = null;
}

async function editSelectedCard() {
    if (!AppState.selectedCardId) return;
    
    const card = AppState.allCards.find(c => c.id === AppState.selectedCardId);
    if (!card) return;
    
    // Carica i dati nel form
    document.getElementById('card-name').value = card.name;
    document.getElementById('card-type').value = card.card_type;
    document.getElementById('faction').value = card.faction_id;
    document.getElementById('mana-cost').value = card.mana_cost;
    document.getElementById('attack').value = card.attack || '';
    document.getElementById('hp').value = card.hp || '';
    document.getElementById('effect-text').value = card.effect_text || '';
    document.getElementById('is-boss').checked = card.is_boss || false;
    document.getElementById('is-indrazzi').checked = card.is_indrazzi || false;
    
    // Parse effect_json
    if (card.effect_json) {
        // TODO: Implementare parsing e ricostruzione effetti
        console.log('Effect JSON:', card.effect_json);
    }
    
    // Carica immagine
    if (card.image_url) {
        const img = new Image();
        img.src = card.image_url;
        img.onload = () => {
            AppState.currentImageUrl = card.image_url;
            document.getElementById('image-preview').innerHTML = `<img src="${card.image_url}" alt="${card.name}">`;
        };
    }
    
    closeModal();
    
    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deleteSelectedCard() {
    if (!AppState.selectedCardId) return;
    
    const card = AppState.allCards.find(c => c.id === AppState.selectedCardId);
    if (!card) return;
    
    const confirmed = confirm(`Sei sicuro di voler eliminare "${card.name}"?`);
    if (!confirmed) return;
    
    try {
        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', AppState.selectedCardId);
        
        if (error) {
            throw error;
        }
        
        alert(`Carta "${card.name}" eliminata!`);
        closeModal();
        loadAllCards();
        
    } catch (error) {
        console.error('Errore eliminazione carta:', error);
        alert(`Errore: ${error.message}`);
    }
}

// ============================================
// FUNZIONI DI SUPPORTO
// ============================================

/**
 * Ottieni il codice fazione da un ID
 */
function getFactionCode(factionId) {
    const codes = ['CHI', 'INF', 'PES', 'BUL', 'GRO', 'CLO', 'IND'];
    return codes[factionId - 1] || 'IND';
}

/**
 * Combina più effetti in un unico JSON
 */
function combineEffects(effects) {
    if (effects.length === 0) return null;
    if (effects.length === 1) return effects[0].json;
    
    return {
        effects: effects.map(e => e.json)
    };
}

// Esporta funzioni globali per debugging
window.CardCreator = {
    AppState,
    supabase,
    loadAllCards,
    updateCardPreview,
    addEffect,
    removeEffect
};